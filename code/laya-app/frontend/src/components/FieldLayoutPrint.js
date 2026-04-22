import "./FieldLayoutPrint.css";

function groupByReplicationAndTrial(layouts = []) {
  const result = {};

  layouts.forEach((trialLayout) => {
    const trialName = trialLayout.trial_name || "Unnamed Trial";

    (trialLayout.assignments || []).forEach((a) => {
      const rep = a.replication_no || 0;

      if (!result[rep]) result[rep] = {};
      if (!result[rep][trialName]) result[rep][trialName] = [];

      result[rep][trialName].push(a);
    });
  });

  return result;
}

function buildGrid(assignments = []) {
  const grid = [];

  assignments.forEach((a) => {
    const r = Number(a.plot_row) - 1;
    const c = Number(a.plot_col) - 1;

    if (r < 0 || c < 0) return;

    if (!grid[r]) grid[r] = [];
    grid[r][c] = a;
  });

  return grid;
}

export default function FieldLayoutPrint({ layouts = [], experiment = {} }) {
  const grouped = groupByReplicationAndTrial(layouts);
  const trialNames = layouts.map((l) => l.trial_name || "Unnamed Trial");

  const rowLength = Math.max(
    0,
    Number(experiment.plants_per_row || 0) *
      Number(experiment.plant_spacing || 0) -
      Number(experiment.plant_spacing || 0)
  ).toFixed(2);

  return (
    <div className="print-container">
      <div style={{ marginBottom: "18px" }}>
        <div style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>
          {experiment.experiment_name || "Experiment"}
        </div>

        <div style={{ fontSize: "15px", marginBottom: "6px" }}>
          <strong>Location:</strong> {experiment.location || ""}
        </div>

        <div style={{ fontSize: "15px", marginBottom: "6px" }}>
          {experiment.replications_per_trial || 0} replications,{" "}
          {experiment.varieties_per_replication || 0} plots/rep,{" "}
          {experiment.rows_per_plot || 0} rows/plot,{" "}
          {experiment.plants_per_row || 0} plants/row
        </div>

        <div style={{ fontSize: "15px" }}>
          <strong>Spacing:</strong> {Number(experiment.plant_spacing || 0).toFixed(2)}m x{" "}
          {Number(experiment.row_spacing || 0).toFixed(2)}m |{" "}
          <strong>Row Length:</strong> {rowLength}m |{" "}
          <strong>Alley:</strong> {Number(experiment.alleyway_spacing || 0).toFixed(2)}m
        </div>
      </div>

      <div className="print-row header">
        <div className="rep-label"></div>
        {trialNames.map((t) => (
          <div key={t} className="trial-header">
            {t}
          </div>
        ))}
      </div>

      {Object.keys(grouped).map((rep) => (
        <div key={rep} className="print-row">
          <div className="rep-label">REP {rep}</div>

          {trialNames.map((trialName) => {
            const assignments = grouped[rep]?.[trialName] || [];
            const grid = buildGrid(assignments);

            return (
              <div key={trialName} className="trial-block">
                {grid.map((row = [], rIdx) => (
                  <div key={rIdx} className="plot-row">
                    {row.map((plot, cIdx) => (
                      <div key={cIdx} className="plot-box">
                        <div className="plot-name">{plot?.variety_name || ""}</div>
                        <div className="plot-meta">P{plot?.plot_no || ""}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}