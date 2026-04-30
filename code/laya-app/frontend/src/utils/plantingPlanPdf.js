import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

function buildColumnStyles(repCount, isCRD) {
  if (isCRD) {
    return {
      0: { cellWidth: 20 },
      1: { cellWidth: 45 },
      2: { cellWidth: 55, halign: "center" },
      3: { cellWidth: 45 },
    };
  }

  const styles = {
    0: { cellWidth: 20 },
    1: { cellWidth: 34 },
    [repCount + 2]: { cellWidth: 36 },
  };

  for (let i = 0; i < repCount; i++) {
    styles[i + 2] = {
      cellWidth: repCount <= 4 ? 18 : repCount <= 6 ? 14 : 11,
      halign: "center",
    };
  }

  return styles;
}

export function downloadPlantingPlanPdf(reportData) {
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

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const left = 14;
  const right = 14;

  const themeGreen = [31, 122, 99];
  const darkText = [30, 41, 59];
  const lightRow = [244, 248, 246];
  const whiteRow = [252, 252, 252];

  trials.forEach((trial, trialIndex) => {
    if (trialIndex > 0) {
      doc.addPage();
    }

    let y = 18;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...darkText);

    doc.setFontSize(20);
    doc.text(`${experiment.design_type} Planting Plan`, left, y);
    y += 10;

    doc.setFontSize(12);
    doc.text(`Trial: ${formatValue(trial.trial_name)}`, left, y);
    y += 8;

    doc.text(`Location: ${formatValue(experiment.location)}`, left, y);
    y += 8;

    doc.text(`Date Planted: ${formatDate(experiment.date_planted)}`, left, y);
    y += 8;

    doc.text(`Season: ${formatValue(experiment.season)}`, left, y);
    y += 10;

    doc.text(
      `${formatValue(experiment.replications_per_trial)} replications, ` +
        `${formatValue(experiment.varieties_per_replication)} plots/rep, ` +
        `${formatValue(experiment.rows_per_plot)} rows/plot, ` +
        `${formatValue(experiment.plants_per_row)} plants/row`,
      left,
      y
    );
    y += 8;

    doc.text(
      `Spacing: ${formatValue(experiment.row_spacing)}m x ${formatValue(
        experiment.plant_spacing
      )}m | Row Length: ${rowLength}m | Alley: ${formatValue(
        experiment.alleyway_spacing
      )}m`,
      left,
      y
    );
    y += 8;

    const head = isCRD
      ? [["Entry No.", "Variety", "Plot Numbers", "Remarks"]]
      : [
          [
            "Entry No.",
            "Variety",
            ...Array.from({ length: repCount }, (_, i) => `Rep ${i + 1}`),
            "Remarks",
          ],
        ];

    const body = (trial.rows || []).map((row) => {
      if (isCRD) {
        return [
          row.entry_no,
          row.variety_name,
          row.plot_numbers?.join(", ") || "",
          row.remarks || "",
        ];
      }

      return [
        row.entry_no,
        row.variety_name,
        ...Array.from({ length: repCount }, (_, i) => row.reps?.[i + 1] || ""),
        row.remarks || "",
      ];
    });

    autoTable(doc, {
      startY: y + 2,
      head,
      body,
      margin: { left, right, bottom: 16 },
      styles: {
        font: "helvetica",
        fontSize: isCRD ? 10 : repCount <= 4 ? 10 : repCount <= 6 ? 9 : 8,
        cellPadding: 3,
        textColor: darkText,
        lineColor: [220, 225, 223],
        lineWidth: 0.2,
        valign: "middle",
      },
      headStyles: {
        fillColor: themeGreen,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "left",
      },
      alternateRowStyles: {
        fillColor: lightRow,
      },
      bodyStyles: {
        fillColor: whiteRow,
      },
      columnStyles: buildColumnStyles(repCount, isCRD),
      didDrawPage: () => {
        doc.setDrawColor(...themeGreen);
        doc.setLineWidth(0.5);
        doc.line(left, 10, pageWidth - right, 10);

        doc.setFontSize(9);
        doc.setTextColor(110, 110, 110);
        doc.text(
          `Experiment: ${formatValue(experiment.experiment_name)}`,
          left,
          pageHeight - 8
        );
        doc.text(
          `Page ${doc.getCurrentPageInfo().pageNumber}`,
          pageWidth - right - 12,
          pageHeight - 8
        );
      },
    });
  });

  const safeName = String(experiment.experiment_name || "planting_plan")
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_");

  doc.save(`${safeName}_planting_plan.pdf`);
}