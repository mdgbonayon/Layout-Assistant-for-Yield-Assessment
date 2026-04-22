const pool = require("../config/database");

async function saveExperimentPolygon(req, res) {
  try {
    const { id } = req.params;
    const {
      geojson,
      area_sq_m,
      width_m,
      height_m,
      fits,
      required_width_m,
      required_height_m,
      required_area_sq_m,
    } = req.body;

    if (!geojson) {
      return res.status(400).json({ message: "geojson is required" });
    }

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

    const geometry = geojson?.type === "Feature" ? geojson.geometry : geojson;

    const result = await pool.query(
      `INSERT INTO experiment_polygons (
        experiment_id,
        geom,
        area_sq_m,
        width_m,
        height_m,
        fits,
        required_width_m,
        required_height_m,
        required_area_sq_m,
        updated_at
      )
      VALUES (
        $1,
        ST_SetSRID(ST_GeomFromGeoJSON($2), 4326),
        $3, $4, $5, $6, $7, $8, $9,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (experiment_id)
      DO UPDATE SET
        geom = ST_SetSRID(ST_GeomFromGeoJSON($2), 4326),
        area_sq_m = $3,
        width_m = $4,
        height_m = $5,
        fits = $6,
        required_width_m = $7,
        required_height_m = $8,
        required_area_sq_m = $9,
        updated_at = CURRENT_TIMESTAMP
      RETURNING
        id,
        experiment_id,
        area_sq_m,
        width_m,
        height_m,
        fits,
        required_width_m,
        required_height_m,
        required_area_sq_m,
        ST_AsGeoJSON(geom) AS geojson`,
      [
        id,
        JSON.stringify(geometry),
        area_sq_m ?? null,
        width_m ?? null,
        height_m ?? null,
        fits ?? null,
        required_width_m ?? null,
        required_height_m ?? null,
        required_area_sq_m ?? null,
      ]
    );

    res.status(201).json({
      message: "Polygon saved successfully",
      polygon: result.rows[0],
    });
  } catch (error) {
    console.error("Save polygon error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

async function getExperimentPolygon(req, res) {
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

    const result = await pool.query(
      `SELECT
        id,
        experiment_id,
        area_sq_m,
        width_m,
        height_m,
        fits,
        required_width_m,
        required_height_m,
        required_area_sq_m,
        created_at,
        updated_at,
        ST_AsGeoJSON(geom) AS geojson
      FROM experiment_polygons
      WHERE experiment_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Polygon not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get experiment polygon error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

async function getAllExperimentPolygons(req, res) {
  try {
    const result = await pool.query(
      `SELECT
        ep.id,
        ep.experiment_id,
        ep.area_sq_m,
        ep.width_m,
        ep.height_m,
        ep.fits,
        ep.required_width_m,
        ep.required_height_m,
        ep.required_area_sq_m,
        ep.created_at,
        ep.updated_at,
        ST_AsGeoJSON(ep.geom) AS geojson,
        e.experiment_name,
        e.design_type,
        e.crop,
        e.status,
        e.created_by
      FROM experiment_polygons ep
      JOIN experiments e ON ep.experiment_id = e.id
      WHERE e.status != 'deleted'
      ORDER BY ep.updated_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get all polygons error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  saveExperimentPolygon,
  getExperimentPolygon,
  getAllExperimentPolygons,
};