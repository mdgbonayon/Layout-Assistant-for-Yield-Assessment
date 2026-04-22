import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

import AppShell from "../components/AppShell";
import SectionCard from "../components/SectionCard";
import PlaceholderPanel from "../components/PlaceholderPanel";
import { useAuth } from "../context/AuthContext";
import {
  fetchExperimentById,
  generateLayout,
  fetchLayouts,
  setActiveLayoutBatch,
  deleteLayoutBatch,
  deleteAllLayouts,
} from "../services/experimentService";

import { getPlotDimensions } from "../utils/layoutUtils";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import FieldLayoutPrint from "../components/FieldLayoutPrint";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";


function buildGrid(assignments, plotsAcross, plotRowsDown) {
  const grid = Array.from({ length: plotRowsDown }, () =>
    Array(plotsAcross).fill(null)
  );

  assignments.forEach((a) => {
    const rowIndex = Number(a.plot_row) - 1;
    const colIndex = Number(a.plot_col) - 1;

    if (
      rowIndex >= 0 &&
      rowIndex < plotRowsDown &&
      colIndex >= 0 &&
      colIndex < plotsAcross
    ) {
      grid[rowIndex][colIndex] = a;
    }
  });

  return grid;
}

function groupAssignmentsByReplication(assignments = []) {
  const grouped = {};

  for (const assignment of assignments) {
    const rep = assignment.replication_no || 0;
    if (!grouped[rep]) grouped[rep] = [];
    grouped[rep].push(assignment);
  }

  return Object.entries(grouped)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([replicationNo, items]) => ({
      replicationNo: Number(replicationNo),
      items: items.sort((a, b) => {
        if (Number(a.plot_row) !== Number(b.plot_row)) {
          return Number(a.plot_row) - Number(b.plot_row);
        }
        return Number(a.plot_col) - Number(b.plot_col);
      }),
    }));
}

function ExperimentDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [experiment, setExperiment] = useState(null);
  const [trials, setTrials] = useState([]);

  const [batches, setBatches] = useState([]);
  const [activeBatchId, setActiveBatchId] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadingLayouts, setLoadingLayouts] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activatingBatchId, setActivatingBatchId] = useState(null);
  const [deletingBatchId, setDeletingBatchId] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [error, setError] = useState("");

  async function handleExportPDF() {
    if (!selectedBatch?.layouts?.length) {
      alert("No selected layout available for export.");
      return;
    }

    const element = document.getElementById("print-layout");

    if (!element) {
      alert("Layout not ready for export.");
      return;
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 8;
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const widthScale = maxWidth / imgWidth;
    const heightScale = maxHeight / imgHeight;
    const scale = Math.min(widthScale, heightScale);

    const renderWidth = imgWidth * scale;
    const renderHeight = imgHeight * scale;

    const x = (pageWidth - renderWidth) / 2;
    const y = (pageHeight - renderHeight) / 2;

    pdf.addImage(imgData, "PNG", x, y, renderWidth, renderHeight);

    const safeExperimentName = (experiment?.experiment_name || "experiment")
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "_");

    pdf.save(`${safeExperimentName}_layout.pdf`);
  }

  async function handleExportExcel() {
    if (!selectedBatch?.layouts?.length) {
      alert("No selected layout available for export.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Field Layout", {
      views: [{ state: "frozen", xSplit: 1, ySplit: 6 }],
    });

    const layouts = selectedBatch.layouts;

    const safeExperimentName = (experiment?.experiment_name || "experiment")
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "_");

    const rowLength = Math.max(
      0,
      Number(experiment?.plants_per_row || 0) *
        Number(experiment?.plant_spacing || 0) -
        Number(experiment?.plant_spacing || 0)
    ).toFixed(2);

    const trialGapCols = 1;
    const repGapRows = 1;
    const repLabelCol = 1;
    const startRow = 7;
    const startCol = 2;

    const plotsAcross = Number(layouts[0]?.plotsAcross || 1);
    const plotRowsDown = Number(layouts[0]?.plotRowsDown || 1);
    const repCount = Number(experiment?.replications_per_trial || 1);

    function groupAssignmentsByReplication(assignments = []) {
      const grouped = {};
      for (const a of assignments) {
        const rep = Number(a.replication_no || 0);
        if (!grouped[rep]) grouped[rep] = [];
        grouped[rep].push(a);
      }
      return grouped;
    }

    function buildGrid(assignments = [], rowsDown, colsAcross) {
      const grid = Array.from({ length: rowsDown }, () =>
        Array(colsAcross).fill(null)
      );

      assignments.forEach((a) => {
        const r = Number(a.plot_row) - 1;
        const c = Number(a.plot_col) - 1;
        if (r >= 0 && r < rowsDown && c >= 0 && c < colsAcross) {
          grid[r][c] = a;
        }
      });

      return grid;
    }

    const totalTrialCols =
      layouts.length * plotsAcross + (layouts.length - 1) * trialGapCols;

    const lastLayoutCol = startCol + totalTrialCols - 1;
    const headerEndCol = Math.max(lastLayoutCol, 20);

    // Header rows
    worksheet.mergeCells(1, 1, 1, headerEndCol);
    worksheet.getCell(1, 1).value = `${experiment?.experiment_name || "Experiment"} Layout`;
    worksheet.getCell(1, 1).font = { bold: true, size: 16 };
    worksheet.getCell(1, 1).alignment = {
      horizontal: "left",
      vertical: "middle",
    };

    worksheet.mergeCells(2, 1, 2, headerEndCol);
    worksheet.getCell(2, 1).value = `Location: ${experiment?.location || ""}`;

    worksheet.mergeCells(3, 1, 3, headerEndCol);
    worksheet.getCell(3, 1).value =
      `${experiment?.replications_per_trial || 0} replications, ` +
      `${experiment?.varieties_per_replication || 0} plots/rep, ` +
      `${experiment?.rows_per_plot || 0} rows/plot, ` +
      `${experiment?.plants_per_row || 0} plants/row`;

    worksheet.mergeCells(4, 1, 4, headerEndCol);
    worksheet.getCell(4, 1).value =
      `Spacing: ${Number(experiment?.plant_spacing || 0).toFixed(2)}m x ` +
      `${Number(experiment?.row_spacing || 0).toFixed(2)}m | ` +
      `Row Length: ${rowLength}m | ` +
      `Alley: ${Number(experiment?.alleyway_spacing || 0).toFixed(2)}m`;

    for (let rowNo = 2; rowNo <= 4; rowNo++) {
      worksheet.getCell(rowNo, 1).font = { size: 11 };
      worksheet.getCell(rowNo, 1).alignment = {
        horizontal: "left",
        vertical: "middle",
      };
    }

    // Trial headers
    layouts.forEach((layout, trialIndex) => {
      const trialStartCol = startCol + trialIndex * (plotsAcross + trialGapCols);
      const trialEndCol = trialStartCol + plotsAcross - 1;

      worksheet.mergeCells(6, trialStartCol, 6, trialEndCol);
      const headerCell = worksheet.getCell(6, trialStartCol);
      headerCell.value = layout.trial_name || `Trial ${trialIndex + 1}`;
      headerCell.font = { bold: true, size: 12 };
      headerCell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };
    });

    // Draw replications and plots
    for (let repNo = 1; repNo <= repCount; repNo++) {
      const repStartRow =
        startRow + (repNo - 1) * (plotRowsDown + repGapRows);

      const repLabelCell = worksheet.getCell(repStartRow + 1, repLabelCol);
      repLabelCell.value = `REP ${repNo}`;
      repLabelCell.font = { bold: true, size: 11 };
      repLabelCell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      layouts.forEach((layout, trialIndex) => {
        const grouped = groupAssignmentsByReplication(layout.assignments || []);
        const repAssignments = grouped[repNo] || [];
        const grid = buildGrid(repAssignments, plotRowsDown, plotsAcross);

        const trialStartCol = startCol + trialIndex * (plotsAcross + trialGapCols);

        for (let r = 0; r < plotRowsDown; r++) {
          for (let c = 0; c < plotsAcross; c++) {
            const row = repStartRow + r;
            const col = trialStartCol + c;
            const cell = worksheet.getCell(row, col);
            const plot = grid[r][c];

            cell.value = plot ? `${plot.variety_name}\nP${plot.plot_no}` : "";

            cell.alignment = {
              horizontal: "center",
              vertical: "middle",
              wrapText: true,
            };

            cell.border = {
              top: { style: "thin", color: { argb: "FF999999" } },
              left: { style: "thin", color: { argb: "FF999999" } },
              bottom: { style: "thin", color: { argb: "FF999999" } },
              right: { style: "thin", color: { argb: "FF999999" } },
            };

            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF3F3F3" },
            };

            cell.font = { size: 9 };
          }
        }
      });
    }

    // Column widths
    worksheet.getColumn(repLabelCol).width = 10;

    for (let i = 0; i < totalTrialCols; i++) {
      const colIndex = startCol + i;
      const offsetWithinBlock = i % (plotsAcross + trialGapCols);
      const isGapColumn =
        offsetWithinBlock === plotsAcross && i !== totalTrialCols - 1;

      worksheet.getColumn(colIndex).width = isGapColumn ? 3 : 14;
    }

    // Row heights
    worksheet.getRow(1).height = 24;
    worksheet.getRow(2).height = 18;
    worksheet.getRow(3).height = 18;
    worksheet.getRow(4).height = 18;
    worksheet.getRow(5).height = 8;
    worksheet.getRow(6).height = 20;

    const totalRepRows =
      repCount * plotRowsDown + (repCount - 1) * repGapRows;

    for (let i = 0; i < totalRepRows; i++) {
      const rowIndex = startRow + i;
      const offsetWithinBlock = i % (plotRowsDown + repGapRows);
      const isGapRow =
        offsetWithinBlock === plotRowsDown && i !== totalRepRows - 1;

      worksheet.getRow(rowIndex).height = isGapRow ? 8 : 32;
    }

    // Page setup
    worksheet.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `${safeExperimentName}_layout.xlsx`
    );
  }

  function handleLogout() {
    logout();
    navigate("/login");
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
  ];

  if (user?.role === "admin") {
    leftActions.push(
      <button
        key="admin"
        className="wf-btn wf-btn-accent"
        onClick={() => navigate("/admin")}
      >
        Admin
      </button>
    );
  }

  const rightActions = [
    <div key="user" className="wf-user-box">
      <div>{user?.full_name || "User"}</div>
      <div>Role: {user?.role || "-"}</div>
    </div>,
    <button key="logout" className="wf-btn" onClick={handleLogout}>
      Logout
    </button>,
  ];

  const loadExperiment = useCallback(async () => {
    try {
      const data = await fetchExperimentById(id);
      setExperiment(data.experiment);
      setTrials(data.trials || []);
    } catch (err) {
      console.error("Failed to load experiment:", err);
      setError(err.message || "Failed to load experiment.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadLayouts = useCallback(async () => {
    try {
      setLoadingLayouts(true);

      const data = await fetchLayouts(id);
      const loadedBatches = data.batches || [];
      const loadedActiveBatchId = data.active_layout_batch_id || null;

      setBatches(loadedBatches);
      setActiveBatchId(loadedActiveBatchId);

      if (loadedBatches.length === 0) {
        setSelectedBatchId(null);
      } else {
        setSelectedBatchId((prev) => {
          const prevStillExists = loadedBatches.some(
            (batch) => batch.generation_batch_id === prev
          );

          if (prevStillExists) return prev;

          if (
            loadedActiveBatchId &&
            loadedBatches.some(
              (batch) => batch.generation_batch_id === loadedActiveBatchId
            )
          ) {
            return loadedActiveBatchId;
          }

          return loadedBatches[0].generation_batch_id;
        });
      }
    } catch (err) {
      console.error("Failed to load layouts:", err);
      setBatches([]);
      setActiveBatchId(null);
      setSelectedBatchId(null);
    } finally {
      setLoadingLayouts(false);
    }
  }, [id]);

  useEffect(() => {
    loadExperiment();
    loadLayouts();
  }, [loadExperiment, loadLayouts]);

  async function handleGenerateLayout() {
    try {
      setGenerating(true);
      setError("");
      await generateLayout(id);
      await loadLayouts();
    } catch (err) {
      console.error("Generate layout failed:", err);
      setError(err.message || "Failed to generate layout.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSetActive(batchId) {
    try {
      setActivatingBatchId(batchId);
      setError("");
      await setActiveLayoutBatch(id, batchId);
      await loadLayouts();
      setSelectedBatchId(batchId);
    } catch (err) {
      console.error("Set active layout failed:", err);
      setError(err.message || "Failed to set active layout.");
    } finally {
      setActivatingBatchId(null);
    }
  }

  async function handleDeleteBatch(batchId) {
    const confirmed = window.confirm(
      "Delete this layout batch? This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      setDeletingBatchId(batchId);
      setError("");
      await deleteLayoutBatch(id, batchId);
      await loadLayouts();
    } catch (err) {
      console.error("Delete layout batch failed:", err);
      setError(err.message || "Failed to delete layout batch.");
    } finally {
      setDeletingBatchId(null);
    }
  }

  async function handleDeleteAll() {
    const confirmed = window.confirm(
      "Delete all layouts for this experiment? This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      setDeletingAll(true);
      setError("");
      await deleteAllLayouts(id);
      await loadLayouts();
    } catch (err) {
      console.error("Delete all layouts failed:", err);
      setError(err.message || "Failed to delete all layouts.");
    } finally {
      setDeletingAll(false);
    }
  }

  const selectedBatch = useMemo(() => {
    return batches.find(
      (batch) => batch.generation_batch_id === selectedBatchId
    );
  }, [batches, selectedBatchId]);

  const plotMeta = useMemo(() => {
    if (!experiment) {
      return {
        plotWidth: 0,
        plotHeight: 0,
      };
    }

    return getPlotDimensions({
      rowsPerPlot: experiment.rows_per_plot,
      plantsPerRow: experiment.plants_per_row,
      rowSpacing: experiment.row_spacing,
      plantSpacing: experiment.plant_spacing,
    });
  }, [experiment]);

  if (loading) {
    return (
      <AppShell leftActions={leftActions} rightActions={rightActions}>
        <div className="wf-loading">Loading experiment...</div>
      </AppShell>
    );
  }

  if (!experiment) {
    return (
      <AppShell leftActions={leftActions} rightActions={rightActions}>
        <SectionCard title="Experiment">
          <div className="wf-empty">Experiment not found.</div>
        </SectionCard>
      </AppShell>
    );
  }

  const selectedTrialDirection =
    selectedBatch?.layouts?.[0]?.trialDirection === "vertical"
      ? "column"
      : "row";

  return (
    <AppShell leftActions={leftActions} rightActions={rightActions}>
      <SectionCard title="Experiment Summary">
        <div className="wf-summary-grid">
          <div className="wf-summary-box">
            <h4>Experiment Details</h4>
            <p><strong>Name:</strong> {experiment.experiment_name}</p>
            <p><strong>Crop:</strong> {experiment.crop}</p>
            <p><strong>Design Type:</strong> {experiment.design_type}</p>
            <p><strong>Description:</strong> {experiment.description || "-"}</p>
            <p><strong>Number of Trials:</strong> {experiment.number_of_trials}</p>
            <p><strong>Replications per Trial:</strong> {experiment.replications_per_trial}</p>
            <p><strong>Location:</strong> {experiment.location || "-"}</p>
            <p><strong>Date Planted:</strong> {experiment.date_planted || "-"}</p>
            <p><strong>Season:</strong> {experiment.season || "-"}</p>
          </div>

          <div className="wf-summary-box">
            <h4>Plot Configuration</h4>
            <p><strong>Varieties per Replication:</strong> {experiment.varieties_per_replication}</p>
            <p><strong>Rows per Plot:</strong> {experiment.rows_per_plot}</p>
            <p><strong>Plants per Row:</strong> {experiment.plants_per_row}</p>
            <p><strong>Plant Spacing:</strong> {experiment.plant_spacing}</p>
            <p><strong>Row Spacing:</strong> {experiment.row_spacing}</p>
            <p><strong>Alleyway Spacing:</strong> {experiment.alleyway_spacing}</p>
            <p><strong>Field Margin:</strong> {experiment.field_margin}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Trials">
        {trials.length === 0 ? (
          <PlaceholderPanel text="No trials found." />
        ) : (
          <div className="wf-summary-grid">
            {trials.map((trial) => (
              <div key={trial.id} className="wf-summary-box">
                <h4>{trial.trial_name}</h4>
                {trial.varieties?.length ? (
                  <ul style={{ margin: 0, paddingLeft: "18px" }}>
                    {trial.varieties.map((v) => (
                      <li key={v.id}>
                        {v.entry_no}. {v.variety_name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="wf-empty">No varieties.</div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Layout History">
        <div className="wf-layout-toolbar">
          <button
            className="wf-btn wf-btn-primary"
            onClick={handleGenerateLayout}
            disabled={generating}
          >
            {generating ? "Generating..." : "Generate New Layout"}
          </button>

          <button
            className="wf-btn wf-btn-secondary"
            onClick={() => navigate(`/experiments/${id}/planting-plan`)}
            disabled={!activeBatchId}
          >
            Generate Planting Plan Report
          </button>

          <button className="wf-btn wf-btn-secondary" onClick={handleExportPDF}>
            Export PDF
          </button>

          <button className="wf-btn wf-btn-secondary" onClick={handleExportExcel}>
            Export Excel
          </button>

          <button
            className="wf-btn wf-btn-danger"
            onClick={handleDeleteAll}
            disabled={deletingAll || batches.length === 0}
          >
            {deletingAll ? "Deleting All..." : "Delete All Layouts"}
          </button>
        </div>

        {loadingLayouts && <div className="wf-loading">Loading layout history...</div>}

        {!loadingLayouts && batches.length === 0 && (
          <div className="wf-empty">No layouts generated yet.</div>
        )}

        {!loadingLayouts && batches.length > 0 && (
          <div className="wf-layout-history-list">
            {batches.map((batch) => {
              const isActive = batch.generation_batch_id === activeBatchId;
              const isSelected = batch.generation_batch_id === selectedBatchId;

              return (
                <div key={batch.generation_batch_id} className="wf-layout-history-item">
                  <div className="wf-layout-history-item-left">
                    <div className="wf-layout-history-item-title">
                      {new Date(batch.generated_at).toLocaleString()}
                    </div>
                    <div className="wf-layout-history-item-meta">
                      {batch.layouts?.length || 0} trial layout(s)
                    </div>
                  </div>

                  <div className="wf-layout-history-item-actions">
                    <span
                      className={`wf-badge ${
                        isActive ? "wf-badge-active" : "wf-badge-muted"
                      }`}
                    >
                      {isActive ? "ACTIVE" : "HISTORY"}
                    </span>

                    <button
                      className="wf-btn wf-btn-secondary"
                      onClick={() => setSelectedBatchId(batch.generation_batch_id)}
                    >
                      {isSelected ? "Viewing" : "View"}
                    </button>

                    {!isActive && (
                      <button
                        className="wf-btn wf-btn-primary"
                        onClick={() => handleSetActive(batch.generation_batch_id)}
                        disabled={activatingBatchId === batch.generation_batch_id}
                      >
                        {activatingBatchId === batch.generation_batch_id
                          ? "Setting..."
                          : "Set Active"}
                      </button>
                    )}

                    <button
                      className="wf-btn wf-btn-danger"
                      onClick={() => handleDeleteBatch(batch.generation_batch_id)}
                      disabled={deletingBatchId === batch.generation_batch_id}
                    >
                      {deletingBatchId === batch.generation_batch_id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && <div className="wf-error">{error}</div>}
      </SectionCard>

      <SectionCard title="Selected Layout">
        {!selectedBatch ? (
          <PlaceholderPanel text="Select a layout batch to view." />
        ) : (
          <>
            <div className="wf-selected-layout-header">
              <div className="wf-selected-layout-meta">
                <strong>{new Date(selectedBatch.generated_at).toLocaleString()}</strong>
                <span
                  className={`wf-badge ${
                    selectedBatch.generation_batch_id === activeBatchId
                      ? "wf-badge-active"
                      : "wf-badge-muted"
                  }`}
                >
                  {selectedBatch.generation_batch_id === activeBatchId
                    ? "ACTIVE LAYOUT"
                    : "HISTORY LAYOUT"}
                </span>
              </div>
            </div>

            <div className="wf-print-layout">
              <div className="wf-print-layout-header">
                <div>
                  <h2 className="wf-print-title">Field Layout Design</h2>
                  <div className="wf-print-subtitle">
                    {experiment.experiment_name} — {experiment.crop} —{" "}
                    {experiment.design_type}
                  </div>
                  <div className="wf-print-subtitle">
                    Batch: {selectedBatch.generation_batch_id}
                  </div>
                </div>

                {/* <div className="wf-print-legend">
                  <div className="wf-print-north">↑ N</div>
                  <div><strong>Legend</strong></div>
                  <div>Filled box = assigned plot</div>
                  <div>Dashed box = empty slot</div>
                  <div>
                    Trials: {selectedBatch.layouts?.[0]?.trialDirection || "-"}
                  </div>
                  <div>
                    Replications: {selectedBatch.layouts?.[0]?.repDirection || "-"}
                  </div>
                </div> */}
              </div>

              <div
                className="wf-layout-grid wf-layout-grid-print"
                style={{
                  display: "flex",
                  flexDirection: selectedTrialDirection,
                  gap: "24px",
                  alignItems: "flex-start",
                  flexWrap: "nowrap",
                }}
              >
                {selectedBatch.layouts.map((layout) => {
                  const groupedReplications = groupAssignmentsByReplication(
                    layout.assignments
                  );

                  const repFlexDirection =
                    layout.repDirection === "horizontal" ? "row" : "column";

                  return (
                    <div
                      key={layout.id}
                      className="wf-layout-trial-card wf-layout-trial-card-print"
                    >
                      <h3 style={{ marginTop: 0 }}>{layout.trial_name}</h3>

                    <div
                      className="wf-layout-meta"
                      style={{
                        marginBottom: "20px",
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                        gap: "12px",
                        padding: "14px 16px",
                        border: "1px solid #d6ddd8",
                        borderRadius: "12px",
                        background: "#f9fbfa",
                        alignItems: "start",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "13px", color: "#5b6b63", marginBottom: "4px" }}>
                          Replication Grid
                        </div>
                        <div style={{ fontWeight: 600 }}>
                          {layout.plotsAcross} × {layout.plotRowsDown}
                        </div>
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "13px", color: "#5b6b63", marginBottom: "4px" }}>
                          Plot Size
                        </div>
                        <div style={{ fontWeight: 600 }}>
                          {plotMeta.plotWidth.toFixed(2)} m × {plotMeta.plotHeight.toFixed(2)} m
                        </div>
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "13px", color: "#5b6b63", marginBottom: "4px" }}>
                          Replication Size
                        </div>
                        <div style={{ fontWeight: 600 }}>
                          {Number(layout.replicationWidth || 0).toFixed(2)} m ×{" "}
                          {Number(layout.replicationHeight || 0).toFixed(2)} m
                        </div>
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "13px", color: "#5b6b63", marginBottom: "4px" }}>
                          Trial Size
                        </div>
                        <div style={{ fontWeight: 600 }}>
                          {Number(layout.trialWidth || 0).toFixed(2)} m ×{" "}
                          {Number(layout.trialHeight || 0).toFixed(2)} m
                        </div>
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "13px", color: "#5b6b63", marginBottom: "4px" }}>
                          Experiment Size
                        </div>
                        <div style={{ fontWeight: 600 }}>
                          {Number(layout.experimentWidth || 0).toFixed(2)} m ×{" "}
                          {Number(layout.experimentHeight || 0).toFixed(2)} m
                        </div>
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "13px", color: "#5b6b63", marginBottom: "4px" }}>
                          Replications
                        </div>
                        <div style={{ fontWeight: 600 }}>{layout.repDirection || "-"}</div>
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "13px", color: "#5b6b63", marginBottom: "4px" }}>
                          Trials
                        </div>
                        <div style={{ fontWeight: 600 }}>{layout.trialDirection || "-"}</div>
                      </div>
                    </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: repFlexDirection,
                          gap: "18px",
                          alignItems: "flex-start",
                        }}
                      >
                        {groupedReplications.map((rep) => {
                          const grid = buildGrid(
                            rep.items,
                            Number(layout.plotsAcross || 0),
                            Number(layout.plotRowsDown || 0)
                          );

                          return (
                            <div
                              key={rep.replicationNo}
                              className="wf-replication-print-block"
                              style={{ marginBottom: "18px" }}
                            >
                              <div
                                className="wf-layout-rep-title"
                                style={{ marginTop: "16px", marginBottom: "8px" }}
                              >
                                Replication {rep.replicationNo}
                              </div>

                              <div className="wf-layout-grid-rows">
                                {grid.map((row, rowIndex) => (
                                  <div
                                    key={`${rep.replicationNo}-row-${rowIndex}`}
                                    className="wf-plot-grid"
                                    style={{
                                      gridTemplateColumns: `repeat(${layout.plotsAcross}, 1fr)`,
                                    }}
                                  >
                                    {row.map((plot, colIndex) =>
                                      plot ? (
                                        <div
                                          key={`${rep.replicationNo}-${rowIndex}-${colIndex}`}
                                          className="wf-plot-card"
                                        >
                                          <div className="wf-plot-variety">
                                            {plot.variety_name}
                                          </div>
                                          <div className="wf-plot-meta">
                                            Plot #{plot.plot_no}
                                          </div>
                                          <div className="wf-plot-meta">
                                            Entry {plot.entry_no || "-"}
                                          </div>
                                          <div className="wf-plot-meta">
                                            Row {plot.plot_row}, Col {plot.plot_col}
                                          </div>
                                        </div>
                                      ) : (
                                        <div
                                          key={`${rep.replicationNo}-${rowIndex}-${colIndex}`}
                                          className="wf-plot-card wf-plot-card-empty"
                                        />
                                      )
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
            
          </>
        )}
      </SectionCard>
      {selectedBatch && (
        <div
          style={{
            position: "absolute",
            left: "-9999px",
            top: 0,
            background: "#fff",
            padding: "16px",
            width: "1122px",
          }}
        >
          <div id="print-layout">
            <FieldLayoutPrint
              layouts={selectedBatch.layouts || []}
              experiment={experiment}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default ExperimentDetailsPage;