import { round2 } from "../utils/layoutUtils";

function LayoutDiagram({ trialLayout }) {
  if (!trialLayout) return null;

  const layout = trialLayout;

  return (
    <div className="wf-layout-diagram">
      <div className="wf-layout-meta">
        <div><strong>Trial:</strong> {layout.trialName || layout.trial_name || "-"}</div>
        <div>
          <strong>Plot Size:</strong> {round2(layout.plotWidth)} m ×{" "}
          {round2(layout.plotHeight)} m
        </div>
        <div>
          <strong>Replication Grid:</strong> {layout.plotsAcross} ×{" "}
          {layout.plotRowsDown}
        </div>
        <div>
          <strong>Replication Footprint:</strong>{" "}
          {round2(layout.replicationWidth)} m ×{" "}
          {round2(layout.replicationHeight)} m
        </div>
        {layout.trialWidth != null && layout.trialHeight != null && (
          <div>
            <strong>Trial Footprint:</strong>{" "}
            {round2(layout.trialWidth)} m × {round2(layout.trialHeight)} m
          </div>
        )}
        {layout.experimentWidth != null && layout.experimentHeight != null && (
          <div>
            <strong>Experiment Footprint:</strong>{" "}
            {round2(layout.experimentWidth)} m × {round2(layout.experimentHeight)} m
          </div>
        )}
        {layout.repDirection && (
          <div>
            <strong>Replications Direction:</strong> {layout.repDirection}
          </div>
        )}
        {layout.trialDirection && (
          <div>
            <strong>Trials Direction:</strong> {layout.trialDirection}
          </div>
        )}
      </div>

      <div
        className="wf-layout-replications"
        style={{
          display: "flex",
          flexDirection: layout.repDirection === "horizontal" ? "row" : "column",
          gap: "16px",
          alignItems: "flex-start",
          flexWrap: "nowrap",
        }}
      >
        {layout.replications.map((rep) => (
          <div key={rep.replicationNo} className="wf-replication-block">
            <div className="wf-replication-label">REP {rep.replicationNo}</div>

            <div
              className="wf-replication-grid"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${layout.plotsAcross}, minmax(80px, 1fr))`,
                gap: "8px",
              }}
            >
              {Array.from({ length: layout.plotRowsDown }).flatMap((_, rowIndex) => {
                const row = rep.rows?.[rowIndex] || [];
                const rowCells = [];

                for (let col = 0; col < layout.plotsAcross; col++) {
                  const item = row[col];

                  rowCells.push(
                    <div
                      key={`${rep.replicationNo}-${rowIndex}-${col}`}
                      className={`wf-plot-cell ${item ? "" : "wf-plot-cell-empty"}`}
                    >
                      {item ? (
                        <>
                          <div className="wf-plot-number">{item.entry_no}</div>
                          <div className="wf-plot-name">{item.variety_name}</div>
                        </>
                      ) : null}
                    </div>
                  );
                }

                return rowCells;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LayoutDiagram;