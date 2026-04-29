const pool = require("../config/database");
const { buildBackendTrialLayout } = require("../utils/layoutUtils");
const logActivity = require("../utils/logActivity");
const {
  getContinuousPlotNumberMap,
  getRepOrder,
  getTrialOrder,
} = require("../utils/orientationUtils");

function getOperationalEntrywaySide(entryway) {
  if (!entryway) return null;

  const value = String(entryway).toUpperCase();

  if (value.includes("EAST")) return "EAST";
  if (value.includes("WEST")) return "WEST";
  if (value.includes("SOUTH")) return "SOUTH";
  if (value.includes("NORTH")) return "NORTH";

  return value;
}

async function getExperimentPolygonDimensions(client, experimentId) {
  const polygonResult = await client.query(
    `SELECT 
        width_m, 
        height_m, 
        area_sq_m,
        ST_AsGeoJSON(geom) AS geojson
     FROM experiment_polygons
     WHERE experiment_id = $1
     ORDER BY id DESC
     LIMIT 1`,
    [experimentId]
  );

  if (polygonResult.rows.length === 0) {
    return null;
  }

  const polygon = polygonResult.rows[0];

  let entryway = null;

  try {
    const geo = JSON.parse(polygon.geojson);

    const coords = geo.coordinates?.[0];

    if (coords && coords.length >= 4) {
      const p1 = coords[0];
      const p2 = coords[1];

      const edgeMidLng = (p1[0] + p2[0]) / 2;
      const edgeMidLat = (p1[1] + p2[1]) / 2;

      const uniqueCoords = coords.slice(0, -1);

      const centerLng =
        uniqueCoords.reduce((sum, p) => sum + p[0], 0) / uniqueCoords.length;

      const centerLat =
        uniqueCoords.reduce((sum, p) => sum + p[1], 0) / uniqueCoords.length;

      const dx = edgeMidLng - centerLng;
      const dy = edgeMidLat - centerLat;

      const horizontal = dx > 0 ? "EAST" : "WEST";
      const vertical = dy > 0 ? "NORTH" : "SOUTH";

      if (Math.abs(dx) > Math.abs(dy) * 2) {
        entryway = horizontal;
      } else if (Math.abs(dy) > Math.abs(dx) * 2) {
        entryway = vertical;
      } else {
        entryway = `${vertical}${horizontal}`;
      }
    }
  } catch (err) {
    console.error("Error parsing polygon geojson:", err);
  }

  return {
    ...polygon,
    entryway,
  };
}

async function createExperiment(req, res) {
  const client = await pool.connect();

  try {
    const {
      experiment_name,
      design_type,
      crop,
      description,
      number_of_trials,
      replications_per_trial,
      varieties_per_replication,
      rows_per_plot,
      plants_per_row,
      plant_spacing,
      row_spacing,
      alleyway_spacing,
      field_margin,
      trials,
      location,
      date_planted,
      season,
    } = req.body;

    if (
      !experiment_name ||
      !design_type ||
      !crop ||
      !number_of_trials ||
      !replications_per_trial ||
      !varieties_per_replication ||
      !rows_per_plot ||
      !plants_per_row ||
      plant_spacing == null ||
      row_spacing == null ||
      alleyway_spacing == null ||
      field_margin == null
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!["CRD", "RCBD"].includes(design_type)) {
      return res.status(400).json({ message: "Invalid design type" });
    }

    if (!Array.isArray(trials) || trials.length !== Number(number_of_trials)) {
      return res.status(400).json({
        message: "Trials array must match number_of_trials",
      });
    }

    await client.query("BEGIN");

    const experimentResult = await client.query(
      `INSERT INTO experiments (
        created_by,
        experiment_name,
        design_type,
        crop,
        description,
        number_of_trials,
        replications_per_trial,
        varieties_per_replication,
        rows_per_plot,
        plants_per_row,
        plant_spacing,
        row_spacing,
        alleyway_spacing,
        field_margin,
        location,
        date_planted,
        season,
        status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'active')
      RETURNING *`,
      [
        req.user.id,
        experiment_name,
        design_type,
        crop,
        description || null,
        number_of_trials,
        replications_per_trial,
        varieties_per_replication,
        rows_per_plot,
        plants_per_row,
        plant_spacing,
        row_spacing,
        alleyway_spacing,
        field_margin,
        location || null,
        date_planted || null,
        season || null,
      ]
    );

    const experiment = experimentResult.rows[0];
    const createdTrials = [];

    for (let i = 0; i < trials.length; i++) {
      const trial = trials[i];

      const trialResult = await client.query(
        `INSERT INTO trials (experiment_id, trial_number, trial_name)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [experiment.id, i + 1, trial.trial_name || `Trial ${i + 1}`]
      );

      const createdTrial = trialResult.rows[0];

      if (!Array.isArray(trial.varieties)) {
        throw new Error(`Trial ${i + 1} varieties must be an array`);
      }

      if (trial.varieties.length !== Number(varieties_per_replication)) {
        throw new Error(
          `Trial ${i + 1} must have exactly ${varieties_per_replication} varieties`
        );
      }

      const savedVarieties = [];

      for (let j = 0; j < trial.varieties.length; j++) {
        const varietyName = String(trial.varieties[j]).trim();

        if (!varietyName) {
          throw new Error(`Trial ${i + 1} has an empty variety name`);
        }

        const varietyResult = await client.query(
          `INSERT INTO varieties (trial_id, entry_no, variety_name)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [createdTrial.id, j + 1, varietyName]
        );

        savedVarieties.push(varietyResult.rows[0]);
      }

      createdTrials.push({
        ...createdTrial,
        varieties: savedVarieties,
      });
    }

    await client.query("COMMIT");

    await logActivity({
      userId: req.user.id,
      action: "CREATE_EXPERIMENT",
      entityType: "experiment",
      entityId: experiment.id,
      details: `${req.user.full_name} created experiment "${experiment.experiment_name}" with ${createdTrials.length} trials`,
    });

    res.status(201).json({
      message:
        "Experiment created successfully. Save polygon next, then generate the field-aware layout.",
      experiment: {
        ...experiment,
        active_layout_batch_id: null,
      },
      trials: createdTrials,
      initial_layout_batch_id: null,
      generated_layouts: [],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create experiment error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  } finally {
    client.release();
  }
}

async function getExperiments(req, res) {
  try {
    let result;

    if (req.user.role === "admin") {
      result = await pool.query(
        `SELECT e.*, u.full_name AS created_by_name
         FROM experiments e
         JOIN users u ON e.created_by = u.id
         WHERE e.status != 'deleted'
         ORDER BY e.created_at DESC`
      );
    } else {
      result = await pool.query(
        `SELECT e.*, u.full_name AS created_by_name
         FROM experiments e
         JOIN users u ON e.created_by = u.id
         WHERE e.created_by = $1 AND e.status != 'deleted'
         ORDER BY e.created_at DESC`,
        [req.user.id]
      );
    }

    res.json(result.rows);
  } catch (error) {
    console.error("Get experiments error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

async function getExperimentById(req, res) {
  const { id } = req.params;

  try {
    const experimentResult = await pool.query(
      `SELECT * FROM experiments WHERE id = $1`,
      [id]
    );

    if (experimentResult.rows.length === 0) {
      return res.status(404).json({ message: "Experiment not found" });
    }

    const experiment = experimentResult.rows[0];

    if (req.user.role !== "admin" && experiment.created_by !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const trialsResult = await pool.query(
      `SELECT * FROM trials WHERE experiment_id = $1 ORDER BY trial_number`,
      [id]
    );

    const trials = [];

    for (const trial of trialsResult.rows) {
      const varietiesResult = await pool.query(
        `SELECT * FROM varieties WHERE trial_id = $1 ORDER BY entry_no`,
        [trial.id]
      );

      trials.push({
        ...trial,
        varieties: varietiesResult.rows,
      });
    }

    res.json({
      experiment,
      trials,
    });
  } catch (error) {
    console.error("Get experiment by id error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

async function generateLayout(req, res) {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const experimentResult = await client.query(
      `SELECT * FROM experiments WHERE id = $1`,
      [id]
    );

    if (experimentResult.rows.length === 0) {
      return res.status(404).json({ message: "Experiment not found" });
    }

    const experiment = experimentResult.rows[0];

    if (req.user.role !== "admin" && experiment.created_by !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const polygon = await getExperimentPolygonDimensions(client, experiment.id);

    if (!polygon) {
      return res.status(400).json({
        message:
          "No saved field polygon found. Please draw and save the polygon first.",
      });
    }

    const entryway = polygon.entryway || null;

    const fieldWidthRaw = Number(polygon.width_m || 0);
    const fieldLengthRaw = Number(polygon.height_m || 0);
    const margin = Number(experiment.field_margin || 0);

    const usableFieldWidth = Math.max(0, fieldWidthRaw - margin * 2);
    const usableFieldLength = Math.max(0, fieldLengthRaw - margin * 2);

    const trialsResult = await client.query(
      `SELECT * FROM trials WHERE experiment_id = $1 ORDER BY trial_number`,
      [id]
    );

    await client.query("BEGIN");

    const generationBatchId = `batch_${Date.now()}`;
    const allLayouts = [];

    for (const trial of trialsResult.rows) {
      const varietiesResult = await client.query(
        `SELECT * FROM varieties WHERE trial_id = $1 ORDER BY entry_no`,
        [trial.id]
      );

      const varieties = varietiesResult.rows;

      const builtLayout = buildBackendTrialLayout({
        designType: experiment.design_type,
        varieties,
        replicationsPerTrial: experiment.replications_per_trial,
        rowsPerPlot: experiment.rows_per_plot,
        plantsPerRow: experiment.plants_per_row,
        rowSpacing: experiment.row_spacing,
        plantSpacing: experiment.plant_spacing,
        alleywaySpacing: experiment.alleyway_spacing,
        numberOfTrials: experiment.number_of_trials,
        fieldWidth: usableFieldWidth,
        fieldLength: usableFieldLength,
        trialGap: experiment.alleyway_spacing,
      });

      const entrywaySide = getOperationalEntrywaySide(
        entryway,
        builtLayout.repDirection
      );

      const repOrder = getRepOrder(
        experiment.replications_per_trial,
        builtLayout.repDirection,
        entryway
      );

      const trialOrder = getTrialOrder(
        experiment.number_of_trials,
        builtLayout.trialDirection,
        entryway
      );

      if (!builtLayout.fitsField) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message:
            `Experiment does not fit the saved field dimensions. ` +
            `Required footprint: ${Number(builtLayout.experimentWidth).toFixed(
              2
            )} m × ` +
            `${Number(builtLayout.experimentHeight).toFixed(2)} m. ` +
            `Usable field: ${Number(usableFieldWidth).toFixed(2)} m × ` +
            `${Number(usableFieldLength).toFixed(2)} m.`,
          details: {
            usableFieldWidth,
            usableFieldLength,
            experimentWidth: builtLayout.experimentWidth,
            experimentHeight: builtLayout.experimentHeight,
            plotsAcross: builtLayout.plotsAcross,
            plotRowsDown: builtLayout.plotRowsDown,
            repDirection: builtLayout.repDirection,
            trialDirection: builtLayout.trialDirection,
          },
        });
      }

      const layoutResult = await client.query(
        `INSERT INTO layouts (
          experiment_id,
          trial_id,
          design_type,
          generated_by,
          generation_batch_id,
          plots_across,
          plot_rows_down,
          replication_width,
          replication_height,
          rep_direction,
          trial_direction,
          trial_width,
          trial_height,
          experiment_width,
          experiment_height,
          fits_field,
          layout_score
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        )
        RETURNING *`,
        [
          experiment.id,
          trial.id,
          experiment.design_type,
          req.user.id,
          generationBatchId,
          builtLayout.plotsAcross,
          builtLayout.plotRowsDown,
          builtLayout.replicationWidth,
          builtLayout.replicationHeight,
          builtLayout.repDirection,
          builtLayout.trialDirection,
          builtLayout.trialWidth,
          builtLayout.trialHeight,
          builtLayout.experimentWidth,
          builtLayout.experimentHeight,
          builtLayout.fitsField,
          builtLayout.score,
        ]
      );

      const layout = layoutResult.rows[0];
      const savedAssignments = [];

      const plotNumberMap = getContinuousPlotNumberMap({
        replications: experiment.replications_per_trial,
        repDirection: builtLayout.repDirection,
        entryway,
        plotsAcross: builtLayout.plotsAcross,
        plotRowsDown: builtLayout.plotRowsDown,
      });

      
      for (const replication of builtLayout.replications) {
        for (let i = 0; i < replication.assignments.length; i++) {
          const assignment = replication.assignments[i];
          const localPlotRow = Math.floor(i / builtLayout.plotsAcross) + 1;
          const plotCol = (i % builtLayout.plotsAcross) + 1;
          const plotNo = plotNumberMap.get(
            `${replication.replicationNo}-${localPlotRow}-${plotCol}`
          );

          const plotRow = localPlotRow;

          await client.query(
            `INSERT INTO plot_assignments
            (layout_id, replication_no, plot_no, plot_row, plot_col, variety_id, remarks)
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              layout.id,
              replication.replicationNo,
              plotNo,
              plotRow,
              plotCol,
              assignment.id,
              null,
            ]
          );

          savedAssignments.push({
            replication_no: replication.replicationNo,
            plot_no: plotNo,
            plot_row: plotRow,
            plot_col: plotCol,
            variety_id: assignment.id,
            variety_name: assignment.variety_name,
            entry_no: assignment.entry_no,
          });
        }
      }

      allLayouts.push({
        layout,
        assignments: savedAssignments,
        entryway,
        entrywaySide,
        repOrder,
        trialOrder,
        trial,
        plotsAcross: builtLayout.plotsAcross,
        plotRowsDown: builtLayout.plotRowsDown,
        replicationWidth: builtLayout.replicationWidth,
        replicationHeight: builtLayout.replicationHeight,
        repDirection: builtLayout.repDirection,
        trialDirection: builtLayout.trialDirection,
        trialWidth: builtLayout.trialWidth,
        trialHeight: builtLayout.trialHeight,
        experimentWidth: builtLayout.experimentWidth,
        experimentHeight: builtLayout.experimentHeight,
        fitsField: builtLayout.fitsField,
        score: builtLayout.score,
      });
    }

    await client.query(
      `UPDATE experiments
       SET active_layout_batch_id = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [generationBatchId, experiment.id]
    );

    await client.query("COMMIT");

    await logActivity({
      userId: req.user.id,
      action: "GENERATE_LAYOUT",
      entityType: "experiment",
      entityId: experiment.id,
      details: `${req.user.full_name} generated a layout for experiment "${experiment.experiment_name}"`,
    });

    res.json({
      message: "Layouts generated successfully using saved polygon dimensions",
      experiment_id: experiment.id,
      design_type: experiment.design_type,
      layouts: allLayouts,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Generate layout error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  } finally {
    client.release();
  }
}

async function getExperimentLayouts(req, res) {
  try {
    const { id } = req.params;

    const experimentResult = await pool.query(
      `SELECT * FROM experiments WHERE id = $1`,
      [id]
    );

    if (experimentResult.rows.length === 0) {
      return res.status(404).json({ message: "Experiment not found" });
    }

    const experiment = experimentResult.rows[0];

    if (req.user.role !== "admin" && experiment.created_by !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const polygon = await getExperimentPolygonDimensions(pool, id);
    const entryway = polygon?.entryway || null;

    const layoutsResult = await pool.query(
      `SELECT 
          l.*,
          t.trial_name,
          t.trial_number
       FROM layouts l
       JOIN trials t ON l.trial_id = t.id
       WHERE l.experiment_id = $1
       ORDER BY l.generated_at DESC, t.trial_number ASC`,
      [id]
    );

    const grouped = {};

    for (const layout of layoutsResult.rows) {
      const entrywaySide = getOperationalEntrywaySide(
        entryway,
        layout.rep_direction
      );

      const repOrder = getRepOrder(
        experiment.replications_per_trial,
        layout.rep_direction,
        entryway
      );

      const trialOrder = getTrialOrder(
        experiment.number_of_trials,
        layout.trial_direction,
        entryway
      );

      const assignmentsResult = await pool.query(
        `SELECT 
            pa.*,
            v.variety_name,
            v.entry_no
         FROM plot_assignments pa
         JOIN varieties v ON pa.variety_id = v.id
         WHERE pa.layout_id = $1
         ORDER BY pa.plot_no`,
        [layout.id]
      );

      const batchId =
        layout.generation_batch_id || `legacy_${layout.generated_at}`;

      if (!grouped[batchId]) {
        grouped[batchId] = {
          generation_batch_id: batchId,
          generated_at: layout.generated_at,
          layouts: [],
        };
      }

      grouped[batchId].layouts.push({
        ...layout,
        entryway,
        entrywaySide,
        repOrder,
        trialOrder,
        plotsAcross: layout.plots_across,
        plotRowsDown: layout.plot_rows_down,
        replicationWidth: layout.replication_width,
        replicationHeight: layout.replication_height,
        repDirection: layout.rep_direction,
        trialDirection: layout.trial_direction,
        trialWidth: layout.trial_width,
        trialHeight: layout.trial_height,
        experimentWidth: layout.experiment_width,
        experimentHeight: layout.experiment_height,
        fitsField: layout.fits_field,
        score: layout.layout_score,
        assignments: assignmentsResult.rows,
      });
    }

    const batches = Object.values(grouped).sort(
      (a, b) => new Date(b.generated_at) - new Date(a.generated_at)
    );

    res.json({
      experiment_id: Number(id),
      active_layout_batch_id: experiment.active_layout_batch_id || null,
      batches,
    });
  } catch (error) {
    console.error("Get experiment layouts error:", error);
    res.status(500).json({ message: "Server error" });
  }
}
async function deleteLayoutBatch(req, res) {
  try {
    const { id, batchId } = req.params;

    const experimentResult = await pool.query(
      `SELECT * FROM experiments WHERE id = $1`,
      [id]
    );

    if (experimentResult.rows.length === 0) {
      return res.status(404).json({ message: "Experiment not found" });
    }

    const experiment = experimentResult.rows[0];

    if (req.user.role !== "admin" && experiment.created_by !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const batchResult = await pool.query(
      `SELECT 1
       FROM layouts
       WHERE experiment_id = $1
         AND generation_batch_id = $2
       LIMIT 1`,
      [id, batchId]
    );

    if (batchResult.rows.length === 0) {
      return res.status(404).json({ message: "Layout batch not found" });
    }

    await pool.query(
      `DELETE FROM layouts
       WHERE experiment_id = $1
         AND generation_batch_id = $2`,
      [id, batchId]
    );

    let newActiveBatchId = experiment.active_layout_batch_id;

    if (experiment.active_layout_batch_id === batchId) {
      const newestRemainingBatch = await pool.query(
        `SELECT generation_batch_id
         FROM layouts
         WHERE experiment_id = $1
         GROUP BY generation_batch_id
         ORDER BY MAX(generated_at) DESC
         LIMIT 1`,
        [id]
      );

      newActiveBatchId =
        newestRemainingBatch.rows.length > 0
          ? newestRemainingBatch.rows[0].generation_batch_id
          : null;

      await pool.query(
        `UPDATE experiments
         SET active_layout_batch_id = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [newActiveBatchId, id]
      );
    }

    await logActivity({
      userId: req.user.id,
      action: "DELETE_LAYOUT_BATCH",
      entityType: "experiment",
      entityId: experiment.id,
      details: `${req.user.full_name} deleted a layout batch for experiment "${experiment.experiment_name}"`,
    });

    res.json({
      message: "Layout batch deleted successfully",
      active_layout_batch_id: newActiveBatchId,
    });
  } catch (error) {
    console.error("Delete layout batch error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

async function deleteAllLayouts(req, res) {
  try {
    const { id } = req.params;

    const experimentResult = await pool.query(
      `SELECT * FROM experiments WHERE id = $1`,
      [id]
    );

    if (experimentResult.rows.length === 0) {
      return res.status(404).json({ message: "Experiment not found" });
    }

    const experiment = experimentResult.rows[0];

    if (req.user.role !== "admin" && experiment.created_by !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    await pool.query(
      `DELETE FROM layouts
       WHERE experiment_id = $1`,
      [id]
    );

    await pool.query(
      `UPDATE experiments
       SET active_layout_batch_id = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    await logActivity({
      userId: req.user.id,
      action: "DELETE_ALL_LAYOUTS",
      entityType: "experiment",
      entityId: experiment.id,
      details: `${req.user.full_name} deleted all layouts for experiment "${experiment.experiment_name}"`,
    });

    res.json({
      message: "All layouts deleted successfully",
      active_layout_batch_id: null,
    });
  } catch (error) {
    console.error("Delete all layouts error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

async function setActiveLayoutBatch(req, res) {
  try {
    const { id, batchId } = req.params;

    const experimentResult = await pool.query(
      `SELECT * FROM experiments WHERE id = $1`,
      [id]
    );

    if (experimentResult.rows.length === 0) {
      return res.status(404).json({ message: "Experiment not found" });
    }

    const experiment = experimentResult.rows[0];

    if (req.user.role !== "admin" && experiment.created_by !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const batchResult = await pool.query(
      `SELECT 1
       FROM layouts
       WHERE experiment_id = $1
         AND generation_batch_id = $2
       LIMIT 1`,
      [id, batchId]
    );

    if (batchResult.rows.length === 0) {
      return res.status(404).json({ message: "Layout batch not found" });
    }

    await pool.query(
      `UPDATE experiments
       SET active_layout_batch_id = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [batchId, id]
    );

    res.json({
      message: "Active layout batch updated successfully",
      active_layout_batch_id: batchId,
    });
  } catch (error) {
    console.error("Set active layout batch error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

async function submitDeletionRequests(req, res) {
  const client = await pool.connect();

  try {
    const { experiment_ids, reason } = req.body;

    if (!Array.isArray(experiment_ids) || experiment_ids.length === 0) {
      return res.status(400).json({
        message: "experiment_ids must be a non-empty array",
      });
    }

    await client.query("BEGIN");

    const createdRequests = [];

    for (const experimentId of experiment_ids) {
      const experimentResult = await client.query(
        `SELECT *
         FROM experiments
         WHERE id = $1`,
        [experimentId]
      );

      if (experimentResult.rows.length === 0) {
        throw new Error(`Experiment ${experimentId} not found`);
      }

      const experiment = experimentResult.rows[0];

      if (req.user.role !== "admin" && experiment.created_by !== req.user.id) {
        throw new Error(`Access denied for experiment ${experimentId}`);
      }

      if (experiment.status === "deleted") {
        continue;
      }

      const existingPending = await client.query(
        `SELECT id
         FROM deletion_requests
         WHERE experiment_id = $1
           AND status = 'pending'
         LIMIT 1`,
        [experimentId]
      );

      if (existingPending.rows.length > 0) {
        continue;
      }

      await client.query(
        `UPDATE experiments
         SET status = 'pending_deletion',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [experimentId]
      );

      const requestResult = await client.query(
        `INSERT INTO deletion_requests (experiment_id, requested_by, reason, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING *`,
        [experimentId, req.user.id, reason || null]
      );

      createdRequests.push(requestResult.rows[0]);

      await logActivity({
        userId: req.user.id,
        action: "REQUEST_DELETE_EXPERIMENT",
        entityType: "experiment",
        entityId: experiment.id,
        details: `${req.user.full_name} requested deletion of experiment "${experiment.experiment_name}"`,
      });
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "Deletion request(s) submitted successfully",
      requests: createdRequests,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Submit deletion requests error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  } finally {
    client.release();
  }
}

async function getPlantingPlanReport(req, res) {
  try {
    const { id } = req.params;

    const experimentResult = await pool.query(
      `SELECT *
       FROM experiments
       WHERE id = $1`,
      [id]
    );

    if (experimentResult.rows.length === 0) {
      return res.status(404).json({ message: "Experiment not found" });
    }

    const experiment = experimentResult.rows[0];

    if (req.user.role !== "admin" && experiment.created_by !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!experiment.active_layout_batch_id) {
      return res.status(400).json({
        message: "No active layout found for this experiment",
      });
    }

    const layoutsResult = await pool.query(
      `SELECT
         l.id,
         l.trial_id,
         l.generation_batch_id,
         l.generated_at,
         t.trial_name,
         t.trial_number
       FROM layouts l
       JOIN trials t ON l.trial_id = t.id
       WHERE l.experiment_id = $1
         AND l.generation_batch_id = $2
       ORDER BY t.trial_number ASC`,
      [id, experiment.active_layout_batch_id]
    );

    const reportTrials = [];

    for (const layout of layoutsResult.rows) {
      const assignmentsResult = await pool.query(
        `SELECT
           pa.replication_no,
           pa.plot_no,
           pa.remarks,
           v.id AS variety_id,
           v.entry_no,
           v.variety_name
         FROM plot_assignments pa
         JOIN varieties v ON pa.variety_id = v.id
         WHERE pa.layout_id = $1
         ORDER BY v.entry_no ASC, pa.replication_no ASC, pa.plot_no ASC`,
        [layout.id]
      );

      let plantingRows = [];

      if (experiment.design_type === "CRD") {
        const groupedByEntry = {};

        for (const row of assignmentsResult.rows) {
          if (!groupedByEntry[row.entry_no]) {
            groupedByEntry[row.entry_no] = {
              entry_no: row.entry_no,
              variety_id: row.variety_id,
              variety_name: row.variety_name,
              remarks: row.remarks || "",
              plot_numbers: [],
              reps: {},
            };
          }

          groupedByEntry[row.entry_no].plot_numbers.push(row.plot_no);

          if (!groupedByEntry[row.entry_no].reps[row.replication_no]) {
            groupedByEntry[row.entry_no].reps[row.replication_no] = [];
          }

          groupedByEntry[row.entry_no].reps[row.replication_no].push(row.plot_no);

          if (!groupedByEntry[row.entry_no].remarks && row.remarks) {
            groupedByEntry[row.entry_no].remarks = row.remarks;
          }
        }

        plantingRows = Object.values(groupedByEntry)
          .map((row) => ({
            ...row,
            plot_numbers: row.plot_numbers.sort((a, b) => a - b),
          }))
          .sort((a, b) => a.entry_no - b.entry_no);
      } else {
        const groupedByEntry = {};

        for (const row of assignmentsResult.rows) {
          if (!groupedByEntry[row.entry_no]) {
            groupedByEntry[row.entry_no] = {
              entry_no: row.entry_no,
              variety_id: row.variety_id,
              variety_name: row.variety_name,
              remarks: row.remarks || "",
              reps: {},
            };
          }

          groupedByEntry[row.entry_no].reps[row.replication_no] = row.plot_no;

          if (!groupedByEntry[row.entry_no].remarks && row.remarks) {
            groupedByEntry[row.entry_no].remarks = row.remarks;
          }
        }

        plantingRows = Object.values(groupedByEntry).sort(
          (a, b) => a.entry_no - b.entry_no
        );
      }

      reportTrials.push({
        trial_id: layout.trial_id,
        trial_name: layout.trial_name,
        trial_number: layout.trial_number,
        generated_at: layout.generated_at,
        rows: plantingRows,
      });
    }

    res.json({
      experiment: {
        id: experiment.id,
        experiment_name: experiment.experiment_name,
        design_type: experiment.design_type,
        crop: experiment.crop,
        description: experiment.description,
        number_of_trials: experiment.number_of_trials,
        replications_per_trial: experiment.replications_per_trial,
        varieties_per_replication: experiment.varieties_per_replication,
        rows_per_plot: experiment.rows_per_plot,
        plants_per_row: experiment.plants_per_row,
        plant_spacing: experiment.plant_spacing,
        row_spacing: experiment.row_spacing,
        alleyway_spacing: experiment.alleyway_spacing,
        field_margin: experiment.field_margin,
        location: experiment.location,
        date_planted: experiment.date_planted,
        season: experiment.season,
        active_layout_batch_id: experiment.active_layout_batch_id,
      },
      trials: reportTrials,
    });
  } catch (error) {
    console.error("Get planting plan report error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

async function updatePlantingPlanRemark(req, res) {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { trial_id, entry_no, remarks } = req.body;

    if (!trial_id || !entry_no) {
      return res.status(400).json({
        message: "trial_id and entry_no are required",
      });
    }

    await client.query("BEGIN");

    const experimentResult = await client.query(
      `SELECT *
       FROM experiments
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (experimentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Experiment not found" });
    }

    const experiment = experimentResult.rows[0];

    if (req.user.role !== "admin" && experiment.created_by !== req.user.id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Access denied" });
    }

    if (!experiment.active_layout_batch_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "No active layout found" });
    }

    const layoutsResult = await client.query(
      `SELECT l.id
       FROM layouts l
       WHERE l.experiment_id = $1
         AND l.trial_id = $2
         AND l.generation_batch_id = $3`,
      [id, trial_id, experiment.active_layout_batch_id]
    );

    if (layoutsResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Active layout for trial not found" });
    }

    const layoutId = layoutsResult.rows[0].id;

    const updateResult = await client.query(
      `UPDATE plot_assignments pa
       SET remarks = $1
       FROM varieties v
       WHERE pa.variety_id = v.id
         AND pa.layout_id = $2
         AND v.entry_no = $3
       RETURNING pa.id`,
      [remarks || "", layoutId, entry_no]
    );

    await client.query("COMMIT");

    res.json({
      message: "Remark updated successfully",
      updated_count: updateResult.rows.length,
      trial_id,
      entry_no,
      remarks: remarks || "",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update planting plan remark error:", error);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
}

module.exports = {
  createExperiment,
  getExperiments,
  getExperimentById,
  generateLayout,
  getExperimentLayouts,
  deleteLayoutBatch,
  deleteAllLayouts,
  setActiveLayoutBatch,
  submitDeletionRequests,
  getPlantingPlanReport,
  updatePlantingPlanRemark,
};