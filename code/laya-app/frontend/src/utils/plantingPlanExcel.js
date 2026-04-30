import * as XLSX from "xlsx";

function formatValue(value) {
  return value ?? "";
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toISOString().split("T")[0];
  } catch {
    return value;
  }
}

function computeRowLength(plantsPerRow, plantSpacing) {
  const plants = Number(plantsPerRow || 0);
  const spacing = Number(plantSpacing || 0);

  if (plants <= 1) return "0.00";
  return ((plants - 1) * spacing).toFixed(2);
}

function safeSheetName(name, fallback = "Trial") {
  const cleaned = String(name || fallback).replace(/[\\/?*[\]:]/g, "").trim();
  return cleaned.slice(0, 31) || fallback;
}

export function downloadPlantingPlanExcel(reportData) {
  if (!reportData?.experiment || !Array.isArray(reportData?.trials)) {
    throw new Error("Invalid planting plan report data.");
  }

  const { experiment, trials } = reportData;
  const repCount = Number(experiment.replications_per_trial || 0);
  const isCRD = experiment.design_type === "CRD";

  const rowLength = computeRowLength(
    experiment.plants_per_row,
    experiment.plant_spacing
  );

  const workbook = XLSX.utils.book_new();

  trials.forEach((trial, index) => {
    const rows = [];

    rows.push([`${experiment.design_type} Planting Plan`]);
    rows.push(["Experiment", formatValue(experiment.experiment_name)]);
    rows.push(["Trial", formatValue(trial.trial_name)]);
    rows.push(["Location", formatValue(experiment.location)]);
    rows.push(["Date Planted", formatDate(experiment.date_planted)]);
    rows.push(["Season", formatValue(experiment.season)]);
    rows.push([]);

    rows.push([
      `${formatValue(experiment.replications_per_trial)} replications, ` +
        `${formatValue(experiment.varieties_per_replication)} plots/rep, ` +
        `${formatValue(experiment.rows_per_plot)} rows/plot, ` +
        `${formatValue(experiment.plants_per_row)} plants/row`,
    ]);

    rows.push([
      `Spacing: ${formatValue(experiment.row_spacing)}m x ${formatValue(
        experiment.plant_spacing
      )}m | Row Length: ${rowLength}m | Alley: ${formatValue(
        experiment.alleyway_spacing
      )}m`,
    ]);

    rows.push([]);

    const header = isCRD
      ? ["Entry No.", "Variety", "Plot Numbers", "Remarks"]
      : [
          "Entry No.",
          "Variety",
          ...Array.from({ length: repCount }, (_, i) => `Rep ${i + 1}`),
          "Remarks",
        ];

    rows.push(header);

    (trial.rows || []).forEach((row) => {
      if (isCRD) {
        rows.push([
          row.entry_no,
          row.variety_name,
          row.plot_numbers?.join(", ") || "",
          row.remarks || "",
        ]);
      } else {
        rows.push([
          row.entry_no,
          row.variety_name,
          ...Array.from({ length: repCount }, (_, i) => row.reps?.[i + 1] || ""),
          row.remarks || "",
        ]);
      }
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    worksheet["!cols"] = isCRD
      ? [{ wch: 12 }, { wch: 22 }, { wch: 30 }, { wch: 24 }]
      : [
          { wch: 12 },
          { wch: 22 },
          ...Array.from({ length: repCount }, () => ({ wch: 10 })),
          { wch: 24 },
        ];

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      safeSheetName(trial.trial_name, `Trial_${index + 1}`)
    );
  });

  const safeName = String(experiment.experiment_name || "planting_plan")
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_");

  XLSX.writeFile(workbook, `${safeName}_planting_plan.xlsx`);
}