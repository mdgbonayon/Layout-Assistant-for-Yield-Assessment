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
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function formatEntryway(entryway) {
  const normalized = normalizeEntryway(entryway);

  const labels = {
    north: "NORTH",
    south: "SOUTH",
    east: "EAST",
    west: "WEST",
    northeast: "NORTH EAST",
    northwest: "NORTH WEST",
    southeast: "SOUTH EAST",
    southwest: "SOUTH WEST",
  };

  return labels[normalized] || String(entryway || "").toUpperCase();
}

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

function EntrywayIndicator({ entryway }) {
  const normalized = normalizeEntryway(entryway);

  if (!normalized || normalized === "-") return null;

  return (
    <div className={`entryway-indicator entryway-${normalized}`}>
      <div className="entryway-title">ENTRYWAY</div>
      <div className="entryway-side">{formatEntryway(entryway)}</div>
    </div>
  );
}

export default function FieldLayoutPrint({ layouts = [], experiment = {} }) {
  const orderedLayouts = orderLayoutsByTrialOrder(layouts);
  const firstLayout = orderedLayouts[0];

  const entryway = firstLayout?.entryway || experiment.entryway || "-";
  const normalizedEntryway = normalizeEntryway(entryway);

  const repDirection = firstLayout?.repDirection || "-";
  const trialDirection = firstLayout?.trialDirection || "-";

  const plotsAcross = Number(firstLayout?.plotsAcross || 1);
  const plotRowsDown = Number(firstLayout?.plotRowsDown || 1);
  const repCount = Number(experiment.replications_per_trial || 1);

  const repOrder = firstLayout?.repOrder?.length
    ? firstLayout.repOrder
    : Array.from({ length: repCount }, (_, i) => i + 1);

  const rowLength = Math.max(
    0,
    Number(experiment.plants_per_row || 0) *
      Number(experiment.plant_spacing || 0) -
      Number(experiment.plant_spacing || 0)
  ).toFixed(2);

  const fieldDirection =
    firstLayout?.trialDirection === "vertical" ? "column" : "row";

  return (
    <div className="print-container">
      <div className="print-header">
        <div className="print-title">
          {experiment.experiment_name || "Experiment"}
        </div>

        <div className="print-meta">
          <strong>Location:</strong> {experiment.location || ""}
        </div>

        <div className="print-meta">
          {experiment.replications_per_trial || 0} replications,{" "}
          {experiment.varieties_per_replication || 0} plots/rep,{" "}
          {experiment.rows_per_plot || 0} rows/plot,{" "}
          {experiment.plants_per_row || 0} plants/row
        </div>

        <div className="print-meta">
          <strong>Spacing:</strong>{" "}
          {Number(experiment.plant_spacing || 0).toFixed(2)}m x{" "}
          {Number(experiment.row_spacing || 0).toFixed(2)}m |{" "}
          <strong>Row Length:</strong> {rowLength}m |{" "}
          <strong>Alley:</strong>{" "}
          {Number(experiment.alleyway_spacing || 0).toFixed(2)}m
        </div>

        <div className="print-meta">
          <strong>Entryway:</strong> {formatEntryway(entryway)} |{" "}
          <strong>Replications:</strong> {repDirection} |{" "}
          <strong>Trials:</strong> {trialDirection}
        </div>
      </div>

      <div className={`field-wrapper field-entry-${normalizedEntryway}`}>
        <EntrywayIndicator entryway={entryway} />

        <div
          className="field-layout"
          style={{
            flexDirection: fieldDirection,
          }}
        >
          {orderedLayouts.map((layout) => {
            const grouped = groupAssignmentsByReplication(
              layout.assignments || []
            );

            return (
              <div
                key={layout.id || layout.trial_id}
                className="trial-print-block"
              >
                <div className="trial-header">
                  {layout.trial_name || `Trial ${layout.trial_number}`}
                </div>

                <div
                  className="replications-print-wrap"
                  style={{
                    flexDirection:
                      layout.repDirection === "horizontal" ? "row" : "column",
                  }}
                >
                  {repOrder.map((repNo) => {
                    const repAssignments = grouped[repNo] || [];
                    const grid = buildGrid(
                      repAssignments,
                      plotRowsDown,
                      plotsAcross
                    );

                    return (
                      <div key={repNo} className="replication-print-block">
                        <div className="rep-label">REP {repNo}</div>

                        <div className="trial-block">
                          {grid.map((row, rIdx) => (
                            <div key={rIdx} className="plot-row">
                              {row.map((plot, cIdx) => (
                                <div
                                  key={`${repNo}-${rIdx}-${cIdx}`}
                                  className={`plot-box ${
                                    plot ? "" : "plot-box-empty"
                                  }`}
                                >
                                  {plot && (
                                    <>
                                      <div className="plot-name">
                                        {plot.variety_name || ""}
                                      </div>
                                      <div className="plot-meta">
                                        P{plot.plot_no || ""}
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
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
    </div>
  );
}