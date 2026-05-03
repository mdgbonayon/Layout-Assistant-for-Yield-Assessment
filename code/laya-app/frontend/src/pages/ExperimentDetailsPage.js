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
// import html2canvas from "html2canvas";
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

function orderLayoutsByTrialOrder(layouts = []) {
  const firstLayout = layouts[0];

  if (!firstLayout?.trialOrder?.length) {
    return layouts;
  }

  return [...layouts].sort((a, b) => {
    const aTrial = Number(a.trial_number);
    const bTrial = Number(b.trial_number);

    return (
      firstLayout.trialOrder.indexOf(aTrial) -
      firstLayout.trialOrder.indexOf(bTrial)
    );
  });
}

function orderReplicationsByRepOrder(groupedReplications = [], repOrder = []) {
  if (!repOrder?.length) {
    return groupedReplications;
  }

  return [...groupedReplications].sort((a, b) => {
    return (
      repOrder.indexOf(Number(a.replicationNo)) -
      repOrder.indexOf(Number(b.replicationNo))
    );
  });
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

    const layouts = selectedBatch.layouts || [];
    const firstRawLayout = layouts[0];

    const orderedLayouts = firstRawLayout?.trialOrder?.length
      ? [...layouts].sort(
          (a, b) =>
            firstRawLayout.trialOrder.indexOf(Number(a.trial_number)) -
            firstRawLayout.trialOrder.indexOf(Number(b.trial_number))
        )
      : layouts;

    const firstLayout = orderedLayouts[0];

    const entryway = String(firstLayout?.entryway || "-").toUpperCase();
    const trialDirection = firstLayout?.trialDirection || "horizontal";
    const repDirection = firstLayout?.repDirection || "horizontal";

    const plotsAcross = Number(firstLayout?.plotsAcross || 1);
    const plotRowsDown = Number(firstLayout?.plotRowsDown || 1);
    const repCount = Number(experiment?.replications_per_trial || 1);
    const rowsPerPlot = Number(experiment?.rows_per_plot || 0);

    const repOrder = firstLayout?.repOrder?.length
      ? firstLayout.repOrder
      : Array.from({ length: repCount }, (_, i) => i + 1);

    const rowLength = Math.max(
      0,
      Number(experiment?.plants_per_row || 0) *
        Number(experiment?.plant_spacing || 0) -
        Number(experiment?.plant_spacing || 0)
    ).toFixed(2);

    const safeExperimentName = (experiment?.experiment_name || "experiment")
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "_");

    const plotGap = 1;
    const repGap = 1;
    const trialGap = 1;

    const rowLabelsOnTop = trialDirection === "horizontal";
    const rowLabelsOnLeft = trialDirection === "vertical";

    const blockLabelsOnLeft = repDirection === "vertical";
    const blockLabelsOnTop = repDirection === "horizontal";

    const plotGridWidth = plotsAcross + Math.max(0, plotsAcross - 1) * plotGap;
    const plotGridHeight = plotRowsDown + Math.max(0, plotRowsDown - 1) * plotGap;

    const repBlockWidth = plotGridWidth;
    const repBlockHeight = 1 + plotGridHeight;

    const trialBlockWidth =
      repDirection === "horizontal"
        ? repOrder.length * repBlockWidth +
          Math.max(0, repOrder.length - 1) * repGap
        : repBlockWidth;

    const trialBlockHeight =
      1 +
      (repDirection === "horizontal"
        ? repBlockHeight
        : repOrder.length * repBlockHeight +
          Math.max(0, repOrder.length - 1) * repGap);

    const fieldWidth =
      trialDirection === "horizontal"
        ? orderedLayouts.length * trialBlockWidth +
          Math.max(0, orderedLayouts.length - 1) * trialGap
        : trialBlockWidth;

    const fieldHeight =
      trialDirection === "vertical"
        ? orderedLayouts.length * trialBlockHeight +
          Math.max(0, orderedLayouts.length - 1) * trialGap
        : trialBlockHeight;

    let currentStartRow = 7;
    let currentStartCol = 2;

    const entrywayTopRow = entryway === "NORTH" ? currentStartRow++ : null;
    const topAxisRow =
      rowLabelsOnTop || blockLabelsOnTop ? currentStartRow++ : null;

    const entrywayLeftCol = entryway === "WEST" ? currentStartCol++ : null;
    const leftAxisCol =
      rowLabelsOnLeft || blockLabelsOnLeft ? currentStartCol++ : null;

    const layoutStartRow = currentStartRow;
    const layoutStartCol = currentStartCol;

    const lastLayoutRow = layoutStartRow + fieldHeight - 1;
    const lastLayoutCol = layoutStartCol + fieldWidth - 1;
    const headerEndCol = Math.max(lastLayoutCol + 3, 16);

    const cells = [];
    const spacerCols = new Set();
    const spacerRows = new Set();

    function addCell(row, col, rowSpan, colSpan, value, type = "normal") {
      cells.push({ row, col, rowSpan, colSpan, value, type });
    }

    function groupByRep(assignments = []) {
      const grouped = {};

      assignments.forEach((a) => {
        const repNo = Number(a.replication_no);
        if (!grouped[repNo]) grouped[repNo] = [];
        grouped[repNo].push(a);
      });

      return grouped;
    }

    function buildPdfGrid(assignments = []) {
      const grid = Array.from({ length: plotRowsDown }, () =>
        Array(plotsAcross).fill(null)
      );

      assignments.forEach((a) => {
        const r = Number(a.plot_row) - 1;
        const c = Number(a.plot_col) - 1;

        if (r >= 0 && r < plotRowsDown && c >= 0 && c < plotsAcross) {
          grid[r][c] = a;
        }
      });

      return grid;
    }

    function getTrialPosition(trialIndex) {
      return {
        row:
          trialDirection === "vertical"
            ? layoutStartRow + trialIndex * (trialBlockHeight + trialGap)
            : layoutStartRow,
        col:
          trialDirection === "horizontal"
            ? layoutStartCol + trialIndex * (trialBlockWidth + trialGap)
            : layoutStartCol,
      };
    }

    function getContinuousRowRange(trialIndex, localAxisIndex) {
      if (!rowsPerPlot) return "";

      const unitsPerTrial =
        trialDirection === "horizontal" ? plotsAcross : plotRowsDown;

      const axisIndex = Number(localAxisIndex) - 1;

      const reversedAxisIndex =
        entryway === "EAST" || entryway === "SOUTH"
          ? unitsPerTrial - 1 - axisIndex
          : axisIndex;

      let effectiveTrialIndex = trialIndex;

      if (entryway === "EAST" || entryway === "SOUTH") {
        effectiveTrialIndex = orderedLayouts.length - 1 - trialIndex;
      }

      const globalUnitIndex =
        effectiveTrialIndex * unitsPerTrial + reversedAxisIndex;

      const start = globalUnitIndex * rowsPerPlot + 1;
      const end = start + rowsPerPlot - 1;

      return `Rows ${start}-${end}`;
    }

    function getPhysicalBlockIndex({ rowIndex, colIndex }) {
      if (blockLabelsOnTop) {
        if (entryway === "NORTH") return plotsAcross - colIndex;
        return colIndex + 1;
      }

      if (entryway === "EAST") return plotRowsDown - rowIndex;
      return rowIndex + 1;
    }

    function getBlockNo(repNo, blockIndex) {
      const blocksPerRep = blockLabelsOnTop ? plotsAcross : plotRowsDown;
      return (Number(repNo) - 1) * blocksPerRep + Number(blockIndex);
    }

    function markSpacerCol(col) {
      spacerCols.add(col);
    }

    function markSpacerRow(row) {
      spacerRows.add(row);
    }

    addCell(1, 1, 1, headerEndCol, `${experiment?.experiment_name || "Experiment"} Layout`, "title");
    addCell(2, 1, 1, headerEndCol, `Location: ${experiment?.location || ""}`, "meta");
    addCell(
      3,
      1,
      1,
      headerEndCol,
      `${experiment?.replications_per_trial || 0} replications, ` +
        `${experiment?.varieties_per_replication || 0} plots/rep, ` +
        `${experiment?.rows_per_plot || 0} rows/plot, ` +
        `${experiment?.plants_per_row || 0} plants/row`,
      "meta"
    );
    addCell(
      4,
      1,
      1,
      headerEndCol,
      `Spacing: ${Number(experiment?.plant_spacing || 0).toFixed(2)}m x ` +
        `${Number(experiment?.row_spacing || 0).toFixed(2)}m | ` +
        `Row Length: ${rowLength}m | ` +
        `Alley: ${Number(experiment?.alleyway_spacing || 0).toFixed(2)}m`,
      "meta"
    );
    addCell(
      5,
      1,
      1,
      headerEndCol,
      `Entryway: ${entryway} | Replications: ${repDirection} | Trials: ${trialDirection}`,
      "meta"
    );

    if (topAxisRow) {
      if (rowLabelsOnTop) {
        orderedLayouts.forEach((layout, trialIndex) => {
          const { col: trialCol } = getTrialPosition(trialIndex);

          for (let c = 0; c < plotsAcross; c++) {
            const pdfCol = trialCol + c * (1 + plotGap);
            addCell(
              topAxisRow,
              pdfCol,
              1,
              1,
              getContinuousRowRange(trialIndex, c + 1),
              "axis"
            );

            if (c < plotsAcross - 1) markSpacerCol(pdfCol + 1);
          }
        });
      }

      if (blockLabelsOnTop) {
        repOrder.forEach((repNo, repIndex) => {
          const repCol = layoutStartCol + repIndex * (repBlockWidth + repGap);

          for (let c = 0; c < plotsAcross; c++) {
            const pdfCol = repCol + c * (1 + plotGap);
            const blockIndex = getPhysicalBlockIndex({
              rowIndex: 0,
              colIndex: c,
            });

            addCell(
              topAxisRow,
              pdfCol,
              1,
              1,
              `Blk ${getBlockNo(repNo, blockIndex)}`,
              "axis"
            );

            if (c < plotsAcross - 1) markSpacerCol(pdfCol + 1);
          }
        });
      }
    }

    if (leftAxisCol) {
      if (blockLabelsOnLeft) {
        repOrder.forEach((repNo, repIndex) => {
          const repRow =
            layoutStartRow + 1 + repIndex * (repBlockHeight + repGap);

          for (let r = 0; r < plotRowsDown; r++) {
            const pdfRow = repRow + 1 + r * (1 + plotGap);
            const blockIndex = getPhysicalBlockIndex({
              rowIndex: r,
              colIndex: 0,
            });

            addCell(
              pdfRow,
              leftAxisCol,
              1,
              1,
              `Blk ${getBlockNo(repNo, blockIndex)}`,
              "axis"
            );

            if (r < plotRowsDown - 1) markSpacerRow(pdfRow + 1);
          }
        });
      }

      if (rowLabelsOnLeft) {
        orderedLayouts.forEach((layout, trialIndex) => {
          const { row: trialRow } = getTrialPosition(trialIndex);
          const firstRepPlotStartRow = trialRow + 2;

          for (let r = 0; r < plotRowsDown; r++) {
            const pdfRow = firstRepPlotStartRow + r * (1 + plotGap);

            addCell(
              pdfRow,
              leftAxisCol,
              1,
              1,
              getContinuousRowRange(trialIndex, r + 1),
              "axis"
            );

            if (r < plotRowsDown - 1) markSpacerRow(pdfRow + 1);
          }
        });
      }
    }

    orderedLayouts.forEach((layout, trialIndex) => {
      const { row: baseRow, col: baseCol } = getTrialPosition(trialIndex);

      addCell(
        baseRow,
        baseCol,
        1,
        trialBlockWidth,
        layout.trial_name || `Trial ${layout.trial_number}`,
        "header"
      );

      const grouped = groupByRep(layout.assignments || []);

      repOrder.forEach((repNo, repIndex) => {
        const repRow =
          repDirection === "horizontal"
            ? baseRow + 1
            : baseRow + 1 + repIndex * (repBlockHeight + repGap);

        const repCol =
          repDirection === "horizontal"
            ? baseCol + repIndex * (repBlockWidth + repGap)
            : baseCol;

        addCell(repRow, repCol, 1, repBlockWidth, `REP ${repNo}`, "header");

        const grid = buildPdfGrid(grouped[repNo] || []);

        grid.forEach((row, r) => {
          row.forEach((plot, c) => {
            const pdfRow = repRow + 1 + r * (1 + plotGap);
            const pdfCol = repCol + c * (1 + plotGap);

            const plotNumber =
              plot?.plot_no ||
              plot?.plot_number ||
              plot?.plotNo ||
              plot?.plot_id ||
              plot?.id ||
              "-";

            addCell(
              pdfRow,
              pdfCol,
              1,
              1,
              plot ? `${plot.variety_name || ""}\nPlot ${plotNumber}` : "",
              plot ? "plot" : "empty"
            );

            if (c < plotsAcross - 1) markSpacerCol(pdfCol + 1);
          });

          if (r < plotRowsDown - 1) {
            markSpacerRow(repRow + 1 + r * (1 + plotGap) + 1);
          }
        });

        if (repDirection === "horizontal" && repIndex < repOrder.length - 1) {
          markSpacerCol(repCol + repBlockWidth);
        }

        if (repDirection === "vertical" && repIndex < repOrder.length - 1) {
          markSpacerRow(repRow + repBlockHeight);
        }
      });

      if (trialDirection === "horizontal" && trialIndex < orderedLayouts.length - 1) {
        markSpacerCol(baseCol + trialBlockWidth);
      }

      if (trialDirection === "vertical" && trialIndex < orderedLayouts.length - 1) {
        markSpacerRow(baseRow + trialBlockHeight);
      }
    });

    if (entryway === "NORTH") {
      addCell(
        entrywayTopRow,
        layoutStartCol,
        1,
        fieldWidth,
        "ENTRYWAY / ROAD SIDE: NORTH",
        "entryway"
      );
    }

    if (entryway === "SOUTH") {
      addCell(
        lastLayoutRow + 2,
        layoutStartCol,
        1,
        fieldWidth,
        "ENTRYWAY / ROAD SIDE: SOUTH",
        "entryway"
      );
    }

    if (entryway === "WEST") {
      addCell(
        layoutStartRow,
        entrywayLeftCol,
        fieldHeight,
        1,
        "ENTRYWAY / ROAD SIDE: WEST",
        "entryway-vertical"
      );
    }

    if (entryway === "EAST") {
      addCell(
        layoutStartRow,
        lastLayoutCol + 2,
        fieldHeight,
        1,
        "ENTRYWAY / ROAD SIDE: EAST",
        "entryway-vertical"
      );
    }

    const maxRow = Math.max(...cells.map((c) => c.row + c.rowSpan - 1), lastLayoutRow + 4);
    const maxCol = Math.max(...cells.map((c) => c.col + c.colSpan - 1), headerEndCol);

    const colWidths = {};
    const rowHeights = {};

    for (let c = 1; c <= maxCol; c++) colWidths[c] = 16;
    for (let r = 1; r <= maxRow; r++) rowHeights[r] = 8;

    for (let r = 1; r <= 5; r++) rowHeights[r] = r === 1 ? 9 : 6;
    for (let r = 7; r <= maxRow; r++) rowHeights[r] = 12;

    spacerCols.forEach((c) => {
      colWidths[c] = 2;
    });

    spacerRows.forEach((r) => {
      rowHeights[r] = 2;
    });

    if (leftAxisCol) colWidths[leftAxisCol] = 15;
    if (entrywayLeftCol) colWidths[entrywayLeftCol] = 6;

    if (entryway === "EAST") colWidths[lastLayoutCol + 2] = 6;

    function colX(col) {
      let x = 0;
      for (let c = 1; c < col; c++) x += colWidths[c] || 13;
      return x;
    }

    function rowY(row) {
      let y = 0;
      for (let r = 1; r < row; r++) y += rowHeights[r] || 8;
      return y;
    }

    function spanWidth(col, colSpan) {
      let w = 0;
      for (let c = col; c < col + colSpan; c++) w += colWidths[c] || 13;
      return w;
    }

    function spanHeight(row, rowSpan) {
      let h = 0;
      for (let r = row; r < row + rowSpan; r++) h += rowHeights[r] || 8;
      return h;
    }

    const contentWidth = spanWidth(1, maxCol);
    const contentHeight = spanHeight(1, maxRow);

    const pdf = new jsPDF({
      orientation: contentWidth >= contentHeight ? "landscape" : "portrait",
      unit: "mm",
      format: "legal",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 8;
    const scale = Math.min(
      (pageWidth - margin * 2) / contentWidth,
      (pageHeight - margin * 2) / contentHeight
    );

    const offsetX = (pageWidth - contentWidth * scale) / 2;
    const offsetY = (pageHeight - contentHeight * scale) / 2;

    function drawText(text, x, y, w, h, fontSize, bold = false, rotate = false) {
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      pdf.setFontSize(fontSize * scale);

      const lines = String(text || "").split("\n").slice(0, 2);

      if (rotate) {
        pdf.text(String(text || ""), x + w / 2, y + h / 2, {
          angle: 90,
          align: "center",
          baseline: "middle",
        });
        return;
      }

      const lineHeight = fontSize * scale * 0.38;
      const startY = y + h / 2 - ((lines.length - 1) * lineHeight) / 2;

      lines.forEach((line, index) => {
        pdf.text(line, x + w / 2, startY + index * lineHeight, {
          align: "center",
          baseline: "middle",
          maxWidth: w - 1.5,
        });
      });
    }

    function drawCell(cell) {
      const x = offsetX + colX(cell.col) * scale;
      const y = offsetY + rowY(cell.row) * scale;
      const w = spanWidth(cell.col, cell.colSpan) * scale;
      const h = spanHeight(cell.row, cell.rowSpan) * scale;

      if (cell.type === "title") {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14 * scale);
        pdf.text(String(cell.value || ""), x, y + 6 * scale);
        return;
      }

      if (cell.type === "meta") {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9 * scale);
        pdf.text(String(cell.value || ""), x, y + 4.5 * scale);
        return;
      }

      if (cell.type === "entryway" || cell.type === "entryway-vertical") {
        pdf.setFillColor(20, 83, 45);
        pdf.setDrawColor(0, 0, 0);
        pdf.rect(x, y, w, h, "FD");
        pdf.setTextColor(255, 255, 255);
        drawText(cell.value, x, y, w, h, 8, true, cell.type === "entryway-vertical");
        pdf.setTextColor(0, 0, 0);
        return;
      }

      if (cell.type === "header") {
        pdf.setFillColor(238, 247, 241);
        pdf.setDrawColor(0, 0, 0);
        pdf.rect(x, y, w, h, "FD");
        drawText(cell.value, x, y, w, h, 8, true);
        return;
      }

      if (cell.type === "axis") {
        pdf.setFillColor(248, 250, 248);
        pdf.setDrawColor(34, 34, 34);
        pdf.rect(x, y, w, h, "FD");
        drawText(cell.value, x, y, w, h, 7, true);
        return;
      }

      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(34, 34, 34);
      pdf.rect(x, y, w, h, "FD");

      if (cell.value) {
        const [varietyLine, plotLine] = String(cell.value).split("\n");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(Math.max(4.5, 6.5 * scale));
        pdf.text(varietyLine || "", x + w / 2, y + h * 0.42, {
          align: "center",
          baseline: "middle",
          maxWidth: w - 1,
        });

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(Math.max(4.2, 6 * scale));
        pdf.text(plotLine || "", x + w / 2, y + h * 0.67, {
          align: "center",
          baseline: "middle",
          maxWidth: w - 1,
        });
      }
    }

    cells.forEach(drawCell);

    pdf.save(`${safeExperimentName}_layout.pdf`);
  }

  async function handleExportExcel() {
    if (!selectedBatch?.layouts?.length) {
      alert("No selected layout available for export.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Field Layout");

    const layouts = selectedBatch.layouts || [];
    const firstRawLayout = layouts[0];

    const orderedLayouts = firstRawLayout?.trialOrder?.length
      ? [...layouts].sort(
          (a, b) =>
            firstRawLayout.trialOrder.indexOf(Number(a.trial_number)) -
            firstRawLayout.trialOrder.indexOf(Number(b.trial_number))
        )
      : layouts;

    const firstLayout = orderedLayouts[0];

    const entryway = String(firstLayout?.entryway || "-").toUpperCase();
    const trialDirection = firstLayout?.trialDirection || "horizontal";
    const repDirection = firstLayout?.repDirection || "horizontal";

    const plotsAcross = Number(firstLayout?.plotsAcross || 1);
    const plotRowsDown = Number(firstLayout?.plotRowsDown || 1);
    const repCount = Number(experiment?.replications_per_trial || 1);
    const rowsPerPlot = Number(experiment?.rows_per_plot || 0);

    const repOrder = firstLayout?.repOrder?.length
      ? firstLayout.repOrder
      : Array.from({ length: repCount }, (_, i) => i + 1);

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

    const plotGap = 1;
    const repGap = 1;
    const trialGap = 1;

    const spacerCols = new Set();
    const spacerRows = new Set();

    const rowLabelsOnTop = trialDirection === "horizontal";
    const rowLabelsOnLeft = trialDirection === "vertical";

    const blockLabelsOnLeft = repDirection === "vertical";
    const blockLabelsOnTop = repDirection === "horizontal";

    const plotGridWidth = plotsAcross + Math.max(0, plotsAcross - 1) * plotGap;
    const plotGridHeight = plotRowsDown + Math.max(0, plotRowsDown - 1) * plotGap;

    const repBlockWidth = plotGridWidth;
    const repBlockHeight = 1 + plotGridHeight;

    const trialBlockWidth =
      repDirection === "horizontal"
        ? repOrder.length * repBlockWidth +
          Math.max(0, repOrder.length - 1) * repGap
        : repBlockWidth;

    const trialBlockHeight =
      1 +
      (repDirection === "horizontal"
        ? repBlockHeight
        : repOrder.length * repBlockHeight +
          Math.max(0, repOrder.length - 1) * repGap);

    const fieldWidth =
      trialDirection === "horizontal"
        ? orderedLayouts.length * trialBlockWidth +
          Math.max(0, orderedLayouts.length - 1) * trialGap
        : trialBlockWidth;

    const fieldHeight =
      trialDirection === "vertical"
        ? orderedLayouts.length * trialBlockHeight +
          Math.max(0, orderedLayouts.length - 1) * trialGap
        : trialBlockHeight;

    const startRow = 7;
    const startCol = 2;

    let currentStartRow = startRow;
    let currentStartCol = startCol;

    const entrywayTopRow = entryway === "NORTH" ? currentStartRow++ : null;
    const topAxisRow = rowLabelsOnTop || blockLabelsOnTop ? currentStartRow++ : null;

    const entrywayLeftCol = entryway === "WEST" ? currentStartCol++ : null;
    const leftAxisCol = rowLabelsOnLeft || blockLabelsOnLeft ? currentStartCol++ : null;

    const layoutStartRow = currentStartRow;
    const layoutStartCol = currentStartCol;

    const lastLayoutRow = layoutStartRow + fieldHeight - 1;
    const lastLayoutCol = layoutStartCol + fieldWidth - 1;
    const headerEndCol = Math.max(lastLayoutCol + 3, 16);

    function groupByRep(assignments = []) {
      const grouped = {};

      assignments.forEach((a) => {
        const repNo = Number(a.replication_no);
        if (!grouped[repNo]) grouped[repNo] = [];
        grouped[repNo].push(a);
      });

      return grouped;
    }

    function buildGrid(assignments = []) {
      const grid = Array.from({ length: plotRowsDown }, () =>
        Array(plotsAcross).fill(null)
      );

      assignments.forEach((a) => {
        const r = Number(a.plot_row) - 1;
        const c = Number(a.plot_col) - 1;

        if (r >= 0 && r < plotRowsDown && c >= 0 && c < plotsAcross) {
          grid[r][c] = a;
        }
      });

      return grid;
    }

    function getTrialPosition(trialIndex) {
      return {
        row:
          trialDirection === "vertical"
            ? layoutStartRow + trialIndex * (trialBlockHeight + trialGap)
            : layoutStartRow,
        col:
          trialDirection === "horizontal"
            ? layoutStartCol + trialIndex * (trialBlockWidth + trialGap)
            : layoutStartCol,
      };
    }

    function getContinuousRowRange(trialIndex, localAxisIndex) {
      if (!rowsPerPlot) return "";

      const unitsPerTrial =
        trialDirection === "horizontal" ? plotsAcross : plotRowsDown;

      const axisIndex = Number(localAxisIndex) - 1;

      const reversedAxisIndex =
        entryway === "EAST" || entryway === "SOUTH"
          ? unitsPerTrial - 1 - axisIndex
          : axisIndex;

      let effectiveTrialIndex = trialIndex;

      if (entryway === "EAST" || entryway === "SOUTH") {
        effectiveTrialIndex = orderedLayouts.length - 1 - trialIndex;
      }

      const globalUnitIndex =
        effectiveTrialIndex * unitsPerTrial + reversedAxisIndex;

      const start = globalUnitIndex * rowsPerPlot + 1;
      const end = start + rowsPerPlot - 1;

      return `Rows ${start}-${end}`;
    }

    function getPhysicalBlockIndex({ rowIndex, colIndex }) {
      if (blockLabelsOnTop) {
        if (entryway === "NORTH") return plotsAcross - colIndex;
        return colIndex + 1;
      }

      if (entryway === "EAST") return plotRowsDown - rowIndex;
      return rowIndex + 1;
    }

    function getBlockNo(repNo, blockIndex) {
      const blocksPerRep = blockLabelsOnTop ? plotsAcross : plotRowsDown;
      return (Number(repNo) - 1) * blocksPerRep + Number(blockIndex);
    }

    function setThinBorder(cell) {
      cell.border = {
        top: { style: "thin", color: { argb: "FF222222" } },
        left: { style: "thin", color: { argb: "FF222222" } },
        bottom: { style: "thin", color: { argb: "FF222222" } },
        right: { style: "thin", color: { argb: "FF222222" } },
      };
    }

    function setMediumBorder(cell) {
      cell.border = {
        top: { style: "medium", color: { argb: "FF000000" } },
        left: { style: "medium", color: { argb: "FF000000" } },
        bottom: { style: "medium", color: { argb: "FF000000" } },
        right: { style: "medium", color: { argb: "FF000000" } },
      };
    }

    function stylePlot(cell) {
      cell.font = { size: 8 };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
        shrinkToFit: true,
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFFFF" },
      };
      setThinBorder(cell);
    }

    function styleHeader(cell) {
      cell.font = { bold: true, size: 9 };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEEF7F1" },
      };
      setMediumBorder(cell);
    }

    function styleAxisLabel(cell) {
      cell.font = { bold: true, size: 8 };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8FAF8" },
      };
      setThinBorder(cell);
    }

    function styleEntryway(cell) {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
        textRotation: cell.address.replace(/[0-9]/g, "") === "A" ? 90 : 0,
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF14532D" },
      };
      setMediumBorder(cell);
    }

    function markSpacerCol(col) {
      spacerCols.add(col);
    }

    function markSpacerRow(row) {
      spacerRows.add(row);
    }

    worksheet.mergeCells(1, 1, 1, headerEndCol);
    worksheet.getCell(1, 1).value = `${
      experiment?.experiment_name || "Experiment"
    } Layout`;
    worksheet.getCell(1, 1).font = { bold: true, size: 16 };

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

    worksheet.mergeCells(5, 1, 5, headerEndCol);
    worksheet.getCell(5, 1).value =
      `Entryway: ${entryway} | Replications: ${repDirection} | Trials: ${trialDirection}`;

    function drawTopAxisLabels() {
      if (!topAxisRow) return;

      if (rowLabelsOnTop) {
        orderedLayouts.forEach((layout, trialIndex) => {
          const { col: trialCol } = getTrialPosition(trialIndex);

          for (let c = 0; c < plotsAcross; c++) {
            const excelCol = trialCol + c * (1 + plotGap);

            const cell = worksheet.getCell(topAxisRow, excelCol);
            cell.value = getContinuousRowRange(trialIndex, c + 1);
            styleAxisLabel(cell);

            if (c < plotsAcross - 1) {
              markSpacerCol(excelCol + 1);
            }
          }
        });
      }

      if (blockLabelsOnTop) {
        repOrder.forEach((repNo, repIndex) => {
          const repCol = layoutStartCol + repIndex * (repBlockWidth + repGap);

          for (let c = 0; c < plotsAcross; c++) {
            const excelCol = repCol + c * (1 + plotGap);
            const blockIndex = getPhysicalBlockIndex({
              rowIndex: 0,
              colIndex: c,
            });

            const cell = worksheet.getCell(topAxisRow, excelCol);
            cell.value = `Blk ${getBlockNo(repNo, blockIndex)}`;
            styleAxisLabel(cell);

            if (c < plotsAcross - 1) {
              markSpacerCol(excelCol + 1);
            }
          }
        });
      }
    }

    function drawLeftAxisLabels() {
      if (!leftAxisCol) return;

      if (blockLabelsOnLeft) {
        repOrder.forEach((repNo, repIndex) => {
          const repRow = layoutStartRow + 1 + repIndex * (repBlockHeight + repGap);

          for (let r = 0; r < plotRowsDown; r++) {
            const excelRow = repRow + 1 + r * (1 + plotGap);
            const blockIndex = getPhysicalBlockIndex({
              rowIndex: r,
              colIndex: 0,
            });

            const cell = worksheet.getCell(excelRow, leftAxisCol);
            cell.value = `Blk ${getBlockNo(repNo, blockIndex)}`;
            styleAxisLabel(cell);

            if (r < plotRowsDown - 1) {
              markSpacerRow(excelRow + 1);
            }
          }
        });
      }

      if (rowLabelsOnLeft) {
        orderedLayouts.forEach((layout, trialIndex) => {
          const { row: trialRow } = getTrialPosition(trialIndex);
          const firstRepPlotStartRow = trialRow + 2;

          for (let r = 0; r < plotRowsDown; r++) {
            const excelRow = firstRepPlotStartRow + r * (1 + plotGap);

            const cell = worksheet.getCell(excelRow, leftAxisCol);
            cell.value = getContinuousRowRange(trialIndex, r + 1);
            styleAxisLabel(cell);

            if (r < plotRowsDown - 1) {
              markSpacerRow(excelRow + 1);
            }
          }
        });
      }
    }

    function drawTrial(layout, trialIndex) {
      const { row: baseRow, col: baseCol } = getTrialPosition(trialIndex);

      worksheet.mergeCells(baseRow, baseCol, baseRow, baseCol + trialBlockWidth - 1);
      const trialHeader = worksheet.getCell(baseRow, baseCol);
      trialHeader.value = layout.trial_name || `Trial ${layout.trial_number}`;
      styleHeader(trialHeader);

      const grouped = groupByRep(layout.assignments || []);

      repOrder.forEach((repNo, repIndex) => {
        const repRow =
          repDirection === "horizontal"
            ? baseRow + 1
            : baseRow + 1 + repIndex * (repBlockHeight + repGap);

        const repCol =
          repDirection === "horizontal"
            ? baseCol + repIndex * (repBlockWidth + repGap)
            : baseCol;

        worksheet.mergeCells(repRow, repCol, repRow, repCol + repBlockWidth - 1);
        const repHeader = worksheet.getCell(repRow, repCol);
        repHeader.value = `REP ${repNo}`;
        styleHeader(repHeader);

        const grid = buildGrid(grouped[repNo] || []);

        grid.forEach((row, r) => {
          row.forEach((plot, c) => {
            const excelRow = repRow + 1 + r * (1 + plotGap);
            const excelCol = repCol + c * (1 + plotGap);

            const cell = worksheet.getCell(excelRow, excelCol);
            const plotNumber =
              plot?.plot_no ||
              plot?.plot_number ||
              plot?.plotNo ||
              plot?.plot_id ||
              plot?.id ||
              "-";

            cell.value = plot
              ? `${plot.variety_name || ""}\nPlot ${plotNumber}`
              : "";
            stylePlot(cell);

            if (c < plotsAcross - 1) {
              markSpacerCol(excelCol + 1);
            }
          });

          if (r < plotRowsDown - 1) {
            markSpacerRow(repRow + 1 + r * (1 + plotGap) + 1);
          }
        });

        if (repDirection === "horizontal" && repIndex < repOrder.length - 1) {
          markSpacerCol(repCol + repBlockWidth);
        }

        if (repDirection === "vertical" && repIndex < repOrder.length - 1) {
          markSpacerRow(repRow + repBlockHeight);
        }
      });
    }

    drawTopAxisLabels();
    drawLeftAxisLabels();

    orderedLayouts.forEach((layout, trialIndex) => {
      drawTrial(layout, trialIndex);

      const { row: trialRow, col: trialCol } = getTrialPosition(trialIndex);

      if (trialDirection === "horizontal" && trialIndex < orderedLayouts.length - 1) {
        markSpacerCol(trialCol + trialBlockWidth);
      }

      if (trialDirection === "vertical" && trialIndex < orderedLayouts.length - 1) {
        markSpacerRow(trialRow + trialBlockHeight);
      }
    });

    if (entryway === "NORTH") {
      worksheet.mergeCells(entrywayTopRow, layoutStartCol, entrywayTopRow, lastLayoutCol);
      const cell = worksheet.getCell(entrywayTopRow, layoutStartCol);
      cell.value = "ENTRYWAY / ROAD SIDE: NORTH";
      styleEntryway(cell);
    }

    if (entryway === "SOUTH") {
      const row = lastLayoutRow + 2;
      worksheet.mergeCells(row, layoutStartCol, row, lastLayoutCol);
      const cell = worksheet.getCell(row, layoutStartCol);
      cell.value = "ENTRYWAY / ROAD SIDE: SOUTH";
      styleEntryway(cell);
    }

    if (entryway === "WEST") {
      worksheet.mergeCells(layoutStartRow, entrywayLeftCol, lastLayoutRow, entrywayLeftCol);
      const cell = worksheet.getCell(layoutStartRow, entrywayLeftCol);
      cell.value = "ENTRYWAY / ROAD SIDE: WEST";
      styleEntryway(cell);
    }

    if (entryway === "EAST") {
      const col = lastLayoutCol + 2;
      worksheet.mergeCells(layoutStartRow, col, lastLayoutRow, col);
      const cell = worksheet.getCell(layoutStartRow, col);
      cell.value = "ENTRYWAY / ROAD SIDE: EAST";
      styleEntryway(cell);
      worksheet.getColumn(col).width = 3;
    }

    for (let c = 1; c <= headerEndCol + 3; c++) {
      worksheet.getColumn(c).width = 9;
    }

    spacerCols.forEach((col) => {
      worksheet.getColumn(col).width = 0.8;
    });

    if (leftAxisCol) {
      worksheet.getColumn(leftAxisCol).width = 8.5;
    }

    for (let r = 1; r <= lastLayoutRow + 5; r++) {
      worksheet.getRow(r).height = 32;
    }

    spacerRows.forEach((row) => {
      worksheet.getRow(row).height = 5;
    });

    worksheet.getRow(1).height = 24;
    worksheet.getRow(2).height = 18;
    worksheet.getRow(3).height = 18;
    worksheet.getRow(4).height = 18;
    worksheet.getRow(5).height = 18;

    worksheet.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: {
        left: 0.2,
        right: 0.2,
        top: 0.35,
        bottom: 0.35,
        header: 0.15,
        footer: 0.15,
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

  const orderedSelectedLayouts = orderLayoutsByTrialOrder(
    selectedBatch?.layouts || []
  );

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
            Export Layout PDF
          </button>

          <button className="wf-btn wf-btn-secondary" onClick={handleExportExcel}>
            Export Layout Excel
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
                {orderedSelectedLayouts.map((layout) => {
                  const groupedReplications = orderReplicationsByRepOrder(
                    groupAssignmentsByReplication(layout.assignments),
                    layout.repOrder
                  );

                  const repFlexDirection =
                    layout.repDirection === "horizontal" ? "row" : "column";

                  return (
                    <div
                      key={layout.id}
                      className="wf-layout-trial-card wf-layout-trial-card-print"
                    >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3 style={{ marginTop: 0 }}>{layout.trial_name}</h3>
                      {layout.entryway && (
                        <div
                          style={{
                            padding: "6px 10px",
                            border: "1px solid #007f5f",
                            borderRadius: "999px",
                            color: "#005f46",
                            fontWeight: 700,
                            fontSize: "13px",
                            background: "#eefaf5",
                          }}
                        >
                          ENTRYWAY / ROAD SIDE: {layout.entryway}
                        </div>
                      )}
                    </div>

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