import "./FieldLayoutPrint.css";

function orderLayoutsByTrialOrder(layouts = []) {
  const firstLayout = layouts[0];

  if (!firstLayout?.trialOrder?.length) return layouts;

  return [...layouts].sort((a, b) => {
    return (
      firstLayout.trialOrder.indexOf(Number(a.trial_number)) -
      firstLayout.trialOrder.indexOf(Number(b.trial_number))
    );
  });
}

function normalizeEntryway(entryway) {
  return String(entryway || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function formatEntryway(entryway) {
  const normalized = normalizeEntryway(entryway);

  const labels = {
    NORTH: "NORTH",
    SOUTH: "SOUTH",
    EAST: "EAST",
    WEST: "WEST",
    NORTHEAST: "NORTH EAST",
    NORTHWEST: "NORTH WEST",
    SOUTHEAST: "SOUTH EAST",
    SOUTHWEST: "SOUTH WEST",
  };

  return labels[normalized] || String(entryway || "-").toUpperCase();
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

function getPlotNumber(plot) {
  return (
    plot?.plot_no ||
    plot?.plot_number ||
    plot?.plotNo ||
    plot?.plot_id ||
    plot?.id ||
    "-"
  );
}

export default function FieldLayoutPrint({ layouts = [], experiment = {} }) {
  const orderedLayouts = orderLayoutsByTrialOrder(layouts);
  const firstLayout = orderedLayouts[0];

  if (!firstLayout) {
    return <div className="excel-pdf-container">No layout available.</div>;
  }

  const entryway = normalizeEntryway(
    firstLayout?.entryway || experiment?.entryway || "-"
  );

  const entrywayLabel = formatEntryway(entryway);

  const trialDirection = firstLayout?.trialDirection || "horizontal";
  const repDirection = firstLayout?.repDirection || "horizontal";

  const plotsAcross = Number(firstLayout?.plotsAcross || 1);
  const plotRowsDown = Number(firstLayout?.plotRowsDown || 1);
  const repCount = Number(experiment?.replications_per_trial || 1);
  const rowsPerPlot = Number(experiment?.rows_per_plot || 0);

  const repOrder = firstLayout?.repOrder?.length
    ? firstLayout.repOrder
    : Array.from({ length: repCount }, (_, i) => i + 1);

  const rowLabelsOnTop = trialDirection === "horizontal";
  const rowLabelsOnLeft = trialDirection === "vertical";

  const blockLabelsOnTop = repDirection === "horizontal";
  const blockLabelsOnLeft = repDirection === "vertical";

  const showTopAxis = rowLabelsOnTop || blockLabelsOnTop;
  const showLeftAxis = rowLabelsOnLeft || blockLabelsOnLeft;

  const rowLength = Math.max(
    0,
    Number(experiment?.plants_per_row || 0) *
      Number(experiment?.plant_spacing || 0) -
      Number(experiment?.plant_spacing || 0)
  ).toFixed(2);

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

  function renderTopAxisForTrial(trialIndex) {
    if (!showTopAxis) return null;

    return (
      <div className="pdf-top-axis-row">
        {showLeftAxis && <div className="pdf-axis-corner" />}

        <div
          className="pdf-top-axis-main"
          style={{
            gridTemplateColumns:
              repDirection === "horizontal"
                ? `repeat(${repOrder.length}, auto)`
                : "auto",
          }}
        >
          {repOrder.map((repNo) => (
            <div
              key={`top-axis-${trialIndex}-${repNo}`}
              className="pdf-rep-axis"
              style={{
                gridTemplateColumns: `repeat(${plotsAcross}, var(--plot-w))`,
              }}
            >
              {Array.from({ length: plotsAcross }, (_, c) => {
                const blockIndex = getPhysicalBlockIndex({
                  rowIndex: 0,
                  colIndex: c,
                });

                const label = blockLabelsOnTop
                  ? `Blk ${getBlockNo(repNo, blockIndex)}`
                  : rowLabelsOnTop
                    ? getContinuousRowRange(trialIndex, c + 1)
                    : "";

                return (
                  <div key={c} className="pdf-axis-cell">
                    {label}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderLeftAxis(repNo, trialIndex, shouldShowLabels) {
    if (!showLeftAxis) return null;

    return (
      <div className="pdf-left-axis">
        {Array.from({ length: plotRowsDown }, (_, r) => {
          const blockIndex = getPhysicalBlockIndex({
            rowIndex: r,
            colIndex: 0,
          });

          const label = shouldShowLabels
            ? blockLabelsOnLeft
              ? `Blk ${getBlockNo(repNo, blockIndex)}`
              : getContinuousRowRange(trialIndex, r + 1)
            : "";

          return (
            <div
              key={`${repNo}-${trialIndex}-${r}`}
              className={`pdf-axis-cell pdf-left-axis-cell ${
                shouldShowLabels ? "" : "pdf-axis-placeholder"
              }`}
            >
              {label}
            </div>
          );
        })}
      </div>
    );
  }

  function renderEntryway() {
    if (!entryway || entryway === "-") return null;

    return (
      <div className="pdf-entryway">
        ENTRYWAY / ROAD SIDE: {entrywayLabel}
      </div>
    );
  }

  return (
    <div className="excel-pdf-container">
      <div className="excel-pdf-header">
        <div className="excel-pdf-title">
          {experiment?.experiment_name || "Experiment"} Layout
        </div>

        <div className="excel-pdf-meta">Location: {experiment?.location || ""}</div>

        <div className="excel-pdf-meta">
          {experiment?.replications_per_trial || 0} replications,{" "}
          {experiment?.varieties_per_replication || 0} plots/rep,{" "}
          {experiment?.rows_per_plot || 0} rows/plot,{" "}
          {experiment?.plants_per_row || 0} plants/row
        </div>

        <div className="excel-pdf-meta">
          Spacing: {Number(experiment?.plant_spacing || 0).toFixed(2)}m x{" "}
          {Number(experiment?.row_spacing || 0).toFixed(2)}m | Row Length:{" "}
          {rowLength}m | Alley:{" "}
          {Number(experiment?.alleyway_spacing || 0).toFixed(2)}m
        </div>

        <div className="excel-pdf-meta">
          Entryway: {entrywayLabel} | Replications: {repDirection} | Trials:{" "}
          {trialDirection}
        </div>
      </div>

      {(entryway === "NORTH" ||
        entryway === "NORTHEAST" ||
        entryway === "NORTHWEST") &&
        renderEntryway()}

      <div
        className="pdf-layout-body"
        style={{
          flexDirection: trialDirection === "vertical" ? "column" : "row",
        }}
      >
        {orderedLayouts.map((layout, trialIndex) => {
          const grouped = groupByRep(layout.assignments || []);

          const shouldShowTopAxis =
            showTopAxis &&
            (trialDirection === "horizontal" || trialIndex === 0);

          return (
            <div
              key={layout.id || layout.trial_number}
              className="pdf-trial-block"
            >
              {shouldShowTopAxis && renderTopAxisForTrial(trialIndex)}

              <div className="pdf-trial-title-row">
                {showLeftAxis && <div className="pdf-axis-corner" />}
                <div className="pdf-trial-title">
                  {layout.trial_name || `Trial ${layout.trial_number}`}
                </div>
              </div>

              <div
                className="pdf-replications"
                style={{
                  flexDirection:
                    repDirection === "horizontal" ? "row" : "column",
                }}
              >
                {repOrder.map((repNo, repIndex) => {
                  const grid = buildGrid(
                    grouped[repNo] || [],
                    plotRowsDown,
                    plotsAcross
                  );

                  const shouldShowLeftLabels =
                    showLeftAxis &&
                    (trialDirection === "vertical"
                      ? true
                      : trialIndex === 0) &&
                    (repDirection === "vertical" || repIndex === 0);

                  return (
                    <div key={repNo} className="pdf-rep-section">
                      <div className="pdf-rep-title-row">
                        {showLeftAxis && <div className="pdf-axis-corner" />}
                        <div className="pdf-rep-title">REP {repNo}</div>
                      </div>

                      <div className="pdf-rep-content">
                        {renderLeftAxis(repNo, trialIndex, shouldShowLeftLabels)}

                        <div className="pdf-plot-grid">
                          {grid.map((row, r) => (
                            <div key={r} className="pdf-plot-row">
                              {row.map((plot, c) => (
                                <div
                                  key={`${repNo}-${r}-${c}`}
                                  className={`pdf-plot-cell ${
                                    plot ? "" : "pdf-plot-empty"
                                  }`}
                                >
                                  {plot && (
                                    <>
                                      <div className="pdf-variety">
                                        {plot.variety_name || ""}
                                      </div>
                                      <div className="pdf-plot-no">
                                        Plot {getPlotNumber(plot)}
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {(entryway === "SOUTH" ||
        entryway === "SOUTHEAST" ||
        entryway === "SOUTHWEST") &&
        renderEntryway()}
    </div>
  );
}