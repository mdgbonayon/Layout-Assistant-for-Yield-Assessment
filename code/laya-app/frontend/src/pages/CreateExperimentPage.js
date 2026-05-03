import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import SectionCard from "../components/SectionCard";
import { useAuth } from "../context/AuthContext";
import {
  createExperiment,
  saveExperimentPolygon,
  fetchAllExperimentPolygons,
  generateLayout,
} from "../services/experimentService";
import FieldMap from "../components/FieldMap";
import {
  round2,
  getPlotDimensions,
  findBestExperimentLayout,
  buildTrialLayout,
} from "../utils/layoutUtils";
import LayoutDiagram from "../components/LayoutDiagram";
import { normalizeEntryway } from "../utils/orientationUtils";

function computeFieldFit(formData, polygonData) {
  if (!polygonData) return null;

  const trials = Number(formData.number_of_trials || 0);
  const reps = Number(formData.replications_per_trial || 0);
  const plotsPerRep = Number(formData.varieties_per_replication || 0);
  const rowsPerPlot = Number(formData.rows_per_plot || 0);
  const plantsPerRow = Number(formData.plants_per_row || 0);
  const plantSpacing = Number(formData.plant_spacing || 0);
  const rowSpacing = Number(formData.row_spacing || 0);
  const alley = Number(formData.alleyway_spacing || 0);
  const margin = Number(formData.field_margin || 0);
  const entryway = normalizeEntryway(polygonData.entryway);

  const { plotWidth, plotHeight } = getPlotDimensions({
    rowsPerPlot,
    plantsPerRow,
    rowSpacing,
    plantSpacing,
  });

  const usableWidth = Math.max(0, polygonData.widthMeters - margin * 2);
  const usableHeight = Math.max(0, polygonData.heightMeters - margin * 2);
  const usableArea = Math.max(0, polygonData.areaSqMeters);

  const layoutResult = findBestExperimentLayout({
    plotsPerReplication: plotsPerRep,
    replicationsPerTrial: reps,
    numberOfTrials: trials,
    plotWidth,
    plotHeight,
    alley,
    fieldWidth: usableWidth,
    fieldHeight: usableHeight,
    trialGap: alley,
    entryway,
  });

  const best = layoutResult.best;

  if (!best) return null;

  const requiredArea = best.experimentWidth * best.experimentHeight;
  const fitsByDimensions = best.fits;
  const fitsByArea = usableArea >= requiredArea;

  // Main rule:
  // width and height determine fit
  // area is only informational / warning
  const finalFits = fitsByDimensions;

  return {
    plotWidth,
    plotHeight,
    usableWidth,
    usableHeight,
    usableArea,
    requiredWidth: best.experimentWidth,
    requiredHeight: best.experimentHeight,
    requiredArea,
    fits: finalFits,
    fitsByDimensions,
    fitsByArea,
    areaWarning: fitsByDimensions && !fitsByArea,
    areaOnlyFailure: fitsByDimensions && !fitsByArea,
    layoutMode: `trials-${best.trialDirection}_reps-${best.repDirection}`,
    repOrientation: `${best.plotsAcross}x${best.plotRowsDown}`,
    plotsAcross: best.plotsAcross,
    plotRowsDown: best.plotRowsDown,
    replicationWidth: best.replicationWidth,
    replicationHeight: best.replicationHeight,
    repDirection: best.repDirection,
    trialDirection: best.trialDirection,
    trialWidth: best.trialWidth,
    trialHeight: best.trialHeight,
    experimentWidth: best.experimentWidth,
    experimentHeight: best.experimentHeight,
    score: best.score,
    candidateLayouts: layoutResult.candidates,
    entryway, 
  };
}

function parseVarieties(varietiesText) {
  return varietiesText
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function CreateExperimentPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [fieldPolygon, setFieldPolygon] = useState(null);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [existingPolygons, setExistingPolygons] = useState([]);
  const [overlappingPolygons, setOverlappingPolygons] = useState([]);

  const [formData, setFormData] = useState({
    experiment_name: "",
    design_type: "RCBD",
    crop: "",
    description: "",
    number_of_trials: 1,
    replications_per_trial: 1,
    varieties_per_replication: 1,
    rows_per_plot: 1,
    plants_per_row: 1,
    plant_spacing: 1,
    row_spacing: 1,
    alleyway_spacing: 0,
    field_margin: 0,
    location: "",
    date_planted: "",
    season: "",
  });

  const [trials, setTrials] = useState([
    {
      trial_name: "Trial 1",
      varietiesText: "",
    },
  ]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  useEffect(() => {
    async function loadExistingPolygons() {
      try {
        const data = await fetchAllExperimentPolygons();
        setExistingPolygons(data || []);
      } catch (loadError) {
        console.error("Failed to load existing polygons:", loadError);
      }
    }

    loadExistingPolygons();
  }, []);

  useEffect(() => {
    const trialCount = Number(formData.number_of_trials);

    setTrials((prevTrials) => {
      const updatedTrials = [];

      for (let i = 0; i < trialCount; i++) {
        const existingTrial = prevTrials[i];

        if (existingTrial) {
          updatedTrials.push({
            trial_name: existingTrial.trial_name || `Trial ${i + 1}`,
            varietiesText: existingTrial.varietiesText || "",
          });
        } else {
          updatedTrials.push({
            trial_name: `Trial ${i + 1}`,
            varietiesText: "",
          });
        }
      }

      return updatedTrials;
    });
  }, [formData.number_of_trials]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: [
        "number_of_trials",
        "replications_per_trial",
        "varieties_per_replication",
        "rows_per_plot",
        "plants_per_row",
        "plant_spacing",
        "row_spacing",
        "alleyway_spacing",
        "field_margin",
      ].includes(name)
        ? Number(value)
        : value,
    }));
  }

  function handleTrialNameChange(index, value) {
    setTrials((prev) =>
      prev.map((trial, i) =>
        i === index ? { ...trial, trial_name: value } : trial
      )
    );
  }

  function handleVarietiesTextChange(trialIndex, value) {
    setTrials((prev) =>
      prev.map((trial, i) =>
        i === trialIndex ? { ...trial, varietiesText: value } : trial
      )
    );
  }

  function validateStep1() {
    return (
      formData.experiment_name.trim() &&
      formData.design_type &&
      formData.crop.trim() &&
      Number(formData.number_of_trials) > 0 &&
      Number(formData.replications_per_trial) > 0 &&
      Number(formData.varieties_per_replication) > 0 &&
      Number(formData.rows_per_plot) > 0 &&
      Number(formData.plants_per_row) > 0
    );
  }

  function validateStep2() {
    const requiredCount = Number(formData.varieties_per_replication);

    return trials.every((trial) => {
      const parsedVarieties = parseVarieties(trial.varietiesText);
      return trial.trial_name.trim() && parsedVarieties.length === requiredCount;
    });
  }

  function handleNext() {
    setError("");

    if (step === 1 && !validateStep1()) {
      setError("Please complete all required experiment details.");
      return;
    }

    if (step === 2 && !validateStep2()) {
      setError(
        `Each trial must have exactly ${formData.varieties_per_replication} varieties.`
      );
      return;
    }

    setStep((prev) => Math.min(prev + 1, 4));
  }

  function handleBack() {
    setError("");
    setStep((prev) => Math.max(prev - 1, 1));
  }

  const reviewData = useMemo(
    () => ({
      ...formData,
      trials,
    }),
    [formData, trials]
  );

  const fitResult = useMemo(() => {
    return computeFieldFit(formData, fieldPolygon);
  }, [formData, fieldPolygon]);

  const fieldAwareTrialLayouts = useMemo(() => {
    if (!fieldPolygon || !fitResult) return [];

    return trials.map((trial) => {
      const varieties = parseVarieties(trial.varietiesText).map(
        (name, varietyIndex) => ({
          entry_no: varietyIndex + 1,
          variety_name: name,
        })
      );

      const layout = buildTrialLayout({
        designType: formData.design_type,
        varieties,
        rowsPerPlot: formData.rows_per_plot,
        plantsPerRow: formData.plants_per_row,
        rowSpacing: formData.row_spacing,
        plantSpacing: formData.plant_spacing,
        alleywaySpacing: formData.alleyway_spacing,
        replicationsPerTrial: formData.replications_per_trial,
        numberOfTrials: formData.number_of_trials,
        fieldWidth: fitResult.usableWidth,
        fieldHeight: fitResult.usableHeight,
        trialGap: formData.alleyway_spacing,
      });

      return {
        ...layout,
        trialName: trial.trial_name,
        entryway: fitResult.entryway,
      };
    });
  }, [trials, formData, fieldPolygon, fitResult]);

  async function handleSubmit() {
    try {
      setSubmitting(true);
      setError("");

      if (!fieldPolygon) {
        setError("Please draw a field polygon before creating the experiment.");
        setSubmitting(false);
        return;
      }

      if (!fitResult) {
        setError("Unable to evaluate field fit. Please redraw the polygon.");
        setSubmitting(false);
        return;
      }

      if (!fitResult.fits) {
        setError(
          "The drawn field does not fit this experiment using the best evaluated layout."
        );
        setSubmitting(false);
        return;
      }

      const payload = {
        ...formData,
        trials: trials.map((trial) => ({
          trial_name: trial.trial_name,
          varieties: parseVarieties(trial.varietiesText),
        })),
      };

      const createResponse = await createExperiment(payload);
      const experimentId = createResponse?.experiment?.id;

      if (!experimentId) {
        throw new Error(
          "Experiment was created but no experiment ID was returned."
        );
      }

      await saveExperimentPolygon(experimentId, {
        geojson: fieldPolygon.geojson,
        area_sq_m: fieldPolygon.areaSqMeters,
        width_m: fieldPolygon.widthMeters,
        height_m: fieldPolygon.heightMeters,
        fits: fitResult?.fits ?? null,
        required_width_m: fitResult?.requiredWidth ?? null,
        required_height_m: fitResult?.requiredHeight ?? null,
        required_area_sq_m: fitResult?.requiredArea ?? null,
      });

      try {
        await generateLayout(experimentId);
      } catch (layoutError) {
        const layoutMessage =
          layoutError?.response?.data?.message ||
          layoutError?.message ||
          "Layout generation failed after saving the experiment and polygon.";

        setError(
          `${layoutMessage} You can reopen the experiment and try generating the layout again.`
        );
        navigate(`/experiments/${experimentId}`);
        return;
      }

      window.alert(
        "Experiment created successfully, polygon saved, and field-aware layout generated."
      );
      navigate(`/experiments/${experimentId}`);
    } catch (submitError) {
      console.error("Create experiment failed:", submitError);

      const message =
        submitError?.response?.data?.message ||
        submitError?.message ||
        "Failed to create experiment.";

      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const leftActions = [
    <button
      key="dashboard"
      className="wf-btn wf-btn-secondary"
      onClick={() => navigate("/dashboard")}
    >
      Dashboard
    </button>,
    <button
      key="map"
      className="wf-btn wf-btn-secondary"
      onClick={() => navigate("/map-view")}
    >
      Map View
    </button>,
    ...(user?.role === "admin"
      ? [
          <button
            key="admin"
            className="wf-btn wf-btn-accent"
            onClick={() => navigate("/admin")}
          >
            Admin
          </button>,
        ]
      : []),
  ];

  const rightActions = [
    <div key="user" className="wf-user-box">
      <div>{user?.full_name || "User"}</div>
      <div>Role: {user?.role || "-"}</div>
    </div>,
    <button key="logout" className="wf-btn" onClick={handleLogout}>
      Logout
    </button>,
  ];

  return (
    <AppShell leftActions={leftActions} rightActions={rightActions}>
      <SectionCard title="Create Experiment Wizard">
        <div className="wf-stepper">
          <div className={`wf-step ${step === 1 ? "active" : ""}`}>
            <div className="wf-step-circle">1</div>
            <div className="wf-step-label">Experiment Details</div>
          </div>

          <div className="wf-step-line" />

          <div className={`wf-step ${step === 2 ? "active" : ""}`}>
            <div className="wf-step-circle">2</div>
            <div className="wf-step-label">Trial Details</div>
          </div>

          <div className="wf-step-line" />

          <div className={`wf-step ${step === 3 ? "active" : ""}`}>
            <div className="wf-step-circle">3</div>
            <div className="wf-step-label">Review</div>
          </div>

          <div className="wf-step-line" />

          <div className={`wf-step ${step === 4 ? "active" : ""}`}>
            <div className="wf-step-circle">4</div>
            <div className="wf-step-label">Draw Polygon</div>
          </div>
        </div>

        {step === 1 && (
          <div className="wf-form-grid">
            <div className="wf-form-group">
              <label className="wf-label">Experiment Name</label>
              <input
                className="wf-input"
                type="text"
                name="experiment_name"
                value={formData.experiment_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="wf-form-group">
              <label className="wf-label">Design Type</label>
              <select
                className="wf-select"
                name="design_type"
                value={formData.design_type}
                onChange={handleChange}
              >
                <option value="RCBD">RCBD</option>
                <option value="CRD">CRD</option>
              </select>
            </div>

            <div className="wf-form-group">
              <label className="wf-label">Crop</label>
              <input
                className="wf-input"
                type="text"
                name="crop"
                value={formData.crop}
                onChange={handleChange}
                required
              />
            </div>

            <div className="wf-form-group">
              <label className="wf-label">Description</label>
              <input
                className="wf-input"
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
              />
            </div>

            <div className="wf-form-group">
              <label className="wf-label">Location (optional)</label>
              <input
                className="wf-input"
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
              />
            </div>

            <div className="wf-form-group">
              <label className="wf-label">Date Planted (optional)</label>
              <input
                className="wf-input"
                type="date"
                name="date_planted"
                value={formData.date_planted}
                onChange={handleChange}
              />
            </div>

            <div className="wf-form-group">
              <label className="wf-label">Season (optional)</label>
              <input
                className="wf-input"
                type="text"
                name="season"
                value={formData.season}
                onChange={handleChange}
                placeholder="e.g. Wet Season"
              />
            </div>

            <div className="wf-form-group">
              <label className="wf-label">Number of Trials</label>
              <input
                className="wf-input"
                type="number"
                min="1"
                name="number_of_trials"
                value={formData.number_of_trials}
                onChange={handleChange}
              />
            </div>

            <div className="wf-form-group">
              <label className="wf-label">Replications per Trial</label>
              <input
                className="wf-input"
                type="number"
                min="1"
                name="replications_per_trial"
                value={formData.replications_per_trial}
                onChange={handleChange}
              />
            </div>

            <div className="wf-form-group">
              <label className="wf-label">Varieties per Replication</label>
              <input
                className="wf-input"
                type="number"
                min="1"
                name="varieties_per_replication"
                value={formData.varieties_per_replication}
                onChange={handleChange}
              />
            </div>

            <div className="wf-form-group">
              <label className="wf-label">Rows per Plot</label>
              <input
                className="wf-input"
                type="number"
                min="1"
                name="rows_per_plot"
                value={formData.rows_per_plot}
                onChange={handleChange}
              />
            </div>

            <div className="wf-form-group">
              <label className="wf-label">Plants per Row</label>
              <input
                className="wf-input"
                type="number"
                min="1"
                name="plants_per_row"
                value={formData.plants_per_row}
                onChange={handleChange}
              />
            </div>

            <div className="wf-form-group">
              <label className="wf-label">Plant Spacing</label>
              <input
                className="wf-input"
                type="number"
                step="0.01"
                min="0"
                name="plant_spacing"
                value={formData.plant_spacing}
                onChange={handleChange}
              />
            </div>

            <div className="wf-form-group">
              <label className="wf-label">Row Spacing</label>
              <input
                className="wf-input"
                type="number"
                step="0.01"
                min="0"
                name="row_spacing"
                value={formData.row_spacing}
                onChange={handleChange}
              />
            </div>

            <div className="wf-form-group">
              <label className="wf-label">Alleyway Spacing</label>
              <input
                className="wf-input"
                type="number"
                step="0.01"
                min="0"
                name="alleyway_spacing"
                value={formData.alleyway_spacing}
                onChange={handleChange}
              />
            </div>

            <div className="wf-form-group">
              <label className="wf-label">Field Margin</label>
              <input
                className="wf-input"
                type="number"
                step="0.01"
                min="0"
                name="field_margin"
                value={formData.field_margin}
                onChange={handleChange}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            {trials.map((trial, trialIndex) => {
              const parsedVarieties = parseVarieties(trial.varietiesText);
              const requiredCount = Number(formData.varieties_per_replication);
              const isValidCount = parsedVarieties.length === requiredCount;

              return (
                <div key={trialIndex} className="wf-trial-card">
                  <div className="wf-form-group" style={{ marginBottom: "14px" }}>
                    <label className="wf-label">Trial Name</label>
                    <input
                      className="wf-input"
                      type="text"
                      value={trial.trial_name}
                      onChange={(e) =>
                        handleTrialNameChange(trialIndex, e.target.value)
                      }
                    />
                  </div>

                  <div className="wf-form-group">
                    <label className="wf-label">
                      Varieties for {trial.trial_name}
                    </label>
                    <textarea
                      className="wf-textarea"
                      value={trial.varietiesText}
                      onChange={(e) =>
                        handleVarietiesTextChange(trialIndex, e.target.value)
                      }
                      placeholder="Enter varieties separated by commas or new lines"
                      style={{ minHeight: "140px" }}
                    />
                  </div>

                  <div
                    className="wf-muted"
                    style={{
                      marginTop: "10px",
                      color: isValidCount
                        ? "var(--success)"
                        : "var(--brand-maroon)",
                      fontWeight: 600,
                    }}
                  >
                    {parsedVarieties.length} / {requiredCount} varieties entered
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {step === 3 && (
          <div className="wf-summary-grid">
            <div className="wf-summary-box">
              <h4>Experiment Details</h4>
              <p><strong>Name:</strong> {reviewData.experiment_name}</p>
              <p><strong>Design Type:</strong> {reviewData.design_type}</p>
              <p><strong>Crop:</strong> {reviewData.crop}</p>
              <p><strong>Description:</strong> {reviewData.description || "-"}</p>
              <p><strong>Location:</strong> {reviewData.location || "-"}</p>
              <p><strong>Date Planted:</strong> {reviewData.date_planted || "-"}</p>
              <p><strong>Season:</strong> {reviewData.season || "-"}</p>
              <p><strong>Trials:</strong> {reviewData.number_of_trials}</p>
              <p><strong>Replications:</strong> {reviewData.replications_per_trial}</p>
            </div>

            <div className="wf-summary-box">
              <h4>Plot Configuration</h4>
              <p><strong>Varieties per Replication:</strong> {reviewData.varieties_per_replication}</p>
              <p><strong>Rows per Plot:</strong> {reviewData.rows_per_plot}</p>
              <p><strong>Plants per Row:</strong> {reviewData.plants_per_row}</p>
              <p><strong>Plant Spacing:</strong> {reviewData.plant_spacing}</p>
              <p><strong>Row Spacing:</strong> {reviewData.row_spacing}</p>
              <p><strong>Alleyway Spacing:</strong> {reviewData.alleyway_spacing}</p>
              <p><strong>Field Margin:</strong> {reviewData.field_margin}</p>
            </div>

            <div className="wf-summary-box" style={{ gridColumn: "1 / -1" }}>
              <h4>Trials and Varieties</h4>
              {reviewData.trials.map((trial, index) => (
                <div key={index} style={{ marginBottom: "14px" }}>
                  <strong>{trial.trial_name}</strong>
                  <ul style={{ marginTop: "8px" }}>
                    {parseVarieties(trial.varietiesText).map((variety, i) => (
                      <li key={i}>{variety}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <>
            <div className="wf-fit-grid">
              <div className="wf-fit-panel">
                <FieldMap
                  onPolygonCreated={setFieldPolygon}
                  existingPolygons={existingPolygons}
                  onOverlapDetected={setOverlappingPolygons}
                />
              </div>

              <div className="wf-fit-panel">
                <h4 style={{ marginTop: 0 }}>Field Fit Check</h4>

                <div className="wf-fit-stat">
                  <strong>Polygon Area:</strong>{" "}
                  {fieldPolygon ? `${round2(fieldPolygon.areaSqMeters)} m²` : "-"}
                </div>

                <div className="wf-fit-stat">
                  <strong>Polygon Width:</strong>{" "}
                  {fieldPolygon ? `${round2(fieldPolygon.widthMeters)} m` : "-"}
                </div>

                <div className="wf-fit-stat">
                  <strong>Polygon Height:</strong>{" "}
                  {fieldPolygon ? `${round2(fieldPolygon.heightMeters)} m` : "-"}
                </div>

                <hr className="wf-divider" />

                <div className="wf-fit-stat">
                  <strong>Required Width:</strong>{" "}
                  {fitResult ? `${round2(fitResult.requiredWidth)} m` : "-"}
                </div>

                <div className="wf-fit-stat">
                  <strong>Required Height:</strong>{" "}
                  {fitResult ? `${round2(fitResult.requiredHeight)} m` : "-"}
                </div>

                <div className="wf-fit-stat">
                  <strong>Required Area:</strong>{" "}
                  {fitResult ? `${round2(fitResult.requiredArea)} m²` : "-"}
                </div>

                <hr className="wf-divider" />

                <div className="wf-fit-stat">
                  <strong>Usable Width after Margins:</strong>{" "}
                  {fitResult ? `${round2(fitResult.usableWidth)} m` : "-"}
                </div>

                <div className="wf-fit-stat">
                  <strong>Usable Height after Margins:</strong>{" "}
                  {fitResult ? `${round2(fitResult.usableHeight)} m` : "-"}
                </div>

                <div className="wf-fit-stat">
                  <strong>Field Margin:</strong> {round2(formData.field_margin)} m
                </div>

                <div className="wf-fit-stat">
                  <strong>Plots Across:</strong>{" "}
                  {fitResult ? fitResult.plotsAcross : "-"}
                </div>

                <div className="wf-fit-stat">
                  <strong>Plot Rows Down:</strong>{" "}
                  {fitResult ? fitResult.plotRowsDown : "-"}
                </div>

                <div className="wf-fit-stat">
                  <strong>Replication Footprint:</strong>{" "}
                  {fitResult
                    ? `${round2(fitResult.replicationWidth)} m × ${round2(
                        fitResult.replicationHeight
                      )} m`
                    : "-"}
                </div>

                <div className="wf-fit-stat">
                  <strong>Replications Direction:</strong>{" "}
                  {fitResult ? fitResult.repDirection : "-"}
                </div>

                <div className="wf-fit-stat">
                  <strong>Trials Direction:</strong>{" "}
                  {fitResult ? fitResult.trialDirection : "-"}
                </div>

                {!fieldPolygon && (
                  <div className="wf-error" style={{ marginTop: "12px" }}>
                    A field polygon is required before creating the experiment.
                  </div>
                )}

                {fieldPolygon && fitResult && (
                  <div className={`wf-fit-result ${fitResult.fits ? "ok" : "bad"}`}>
                    {fitResult.fits
                      ? "Fits: The field can accommodate this experiment using the best evaluated layout."
                      : "Does not fit: The field is too small for the best evaluated layout dimensions or area."}
                  </div>
                )}

                {fitResult?.areaWarning && (
                  <div className="wf-overlap-box" style={{ marginTop: "12px" }}>
                    <strong>Note:</strong> The field fits by dimensions, but the polygon
                    area is smaller than the rectangular footprint estimate. Review the
                    drawn boundary and actual field shape before final field implementation.
                  </div>
                )}

                {overlappingPolygons.length > 0 && (
                  <div className="wf-overlap-box">
                    <strong>Warning:</strong> The drawn field overlaps with existing
                    experiment area(s).
                    <ul className="wf-overlap-list">
                      {overlappingPolygons.map((item) => (
                        <li key={item.id}>
                          {item.experiment_name} ({item.crop}, {item.design_type})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!fieldPolygon && (
                  <div className="wf-empty" style={{ marginTop: "12px" }}>
                    Draw a polygon on the map to analyze field capacity.
                  </div>
                )}
              </div>
            </div>

            {fieldPolygon && fitResult && (
              <div className="wf-summary-box" style={{ marginTop: "18px" }}>
                <h4 style={{ marginTop: 0, marginBottom: "14px" }}>
                  Field-Aware Layout Preview
                </h4>

                <div style={{ marginBottom: "14px", color: "var(--text-muted)" }}>
                  This preview uses the actual polygon width and height after margins.
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection:
                      fitResult.trialDirection === "vertical" ? "column" : "row",
                    gap: "18px",
                    alignItems: "flex-start",
                    overflowX: "auto",
                    overflowY: "hidden",
                    maxWidth: "100%",
                    paddingBottom: "10px",
                  }}
                >
                  {fieldAwareTrialLayouts.map((trialLayout, index) => (
                    <div
                      key={`${trialLayout.trialName}-${index}`}
                      style={{
                        width: "fit-content",
                        minWidth: "900px",
                        flex: "0 0 auto",
                        transform: "scale(0.72)",
                        transformOrigin: "top left",
                        marginRight: "-250px",
                        marginBottom: "-120px",
                      }}
                    >
                      <LayoutDiagram trialLayout={trialLayout} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {error && <div className="wf-error">{error}</div>}

        <div className="wf-wizard-actions">
          <button
            className="wf-btn wf-btn-secondary"
            type="button"
            onClick={() => navigate("/dashboard")}
          >
            Cancel
          </button>

          <div className="wf-wizard-actions-right">
            {step > 1 && (
              <button
                className="wf-btn wf-btn-secondary"
                type="button"
                onClick={handleBack}
              >
                Back
              </button>
            )}

            {step < 4 && (
              <button
                className="wf-btn wf-btn-primary"
                type="button"
                onClick={handleNext}
              >
                Next
              </button>
            )}

            {step === 4 && (
              <button
                className="wf-btn wf-btn-primary"
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !fitResult?.fits}
                title={
                  !fitResult?.fits
                    ? "The field must fit the best evaluated layout before you can create the experiment."
                    : ""
                }
              >
                {submitting ? "Creating..." : "Create Experiment"}
              </button>
            )}
          </div>
        </div>
      </SectionCard>
    </AppShell>
  );
}

export default CreateExperimentPage;