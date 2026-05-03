import { round2 } from "../utils/layoutUtils";

function LayoutDiagram({ trialLayout }) {
  if (!trialLayout) return null;

  const layout = trialLayout;

  const entryway = String(layout.entrywaySide || layout.entryway || "SOUTH").toUpperCase();

  const replications = [...layout.replications];

  const shouldReverseReps =
    entryway === "NORTH" || entryway === "EAST";

  const orderedReps = shouldReverseReps
    ? [...replications].reverse()
    : replications;

  const isHorizontal =
    entryway === "NORTH" || entryway === "SOUTH";

  const roadsideLabelPosition = (() => {
    if (entryway === "NORTH") return "top";
    if (entryway === "SOUTH") return "bottom";
    if (entryway === "WEST") return "left";
    if (entryway === "EAST") return "right";
    return "bottom";
  })();

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

        <div>
          <strong>Entryway:</strong> {entryway}
        </div>

        <div>
          <strong>Replications:</strong> {layout.repDirection}
        </div>

        <div>
          <strong>Trials:</strong> {layout.trialDirection}
        </div>
      </div>

      {roadsideLabelPosition === "top" && (
        <div className="wf-roadside-label">ENTRYWAY {entryway}</div>
      )}

      <div
        className="wf-layout-replications"
        style={{
          display: "flex",
          flexDirection: isHorizontal ? "row" : "column",
          gap: "16px",
          alignItems: "flex-start",
          flexWrap: "nowrap",
        }}
      >
        {roadsideLabelPosition === "left" && (
          <div className="wf-roadside-label vertical">ENTRYWAY {entryway}</div>
        )}

        {orderedReps.map((rep) => (
          <div key={rep.replicationNo} className="wf-replication-block">
            <div className="wf-replication-label">
              REP {rep.replicationNo}
            </div>

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

                let displayRow =
                  rowIndex % 2 === 1 ? [...row].reverse() : row;

                return Array.from({ length: layout.plotsAcross }).map((_, colIndex) => {
                  const item = displayRow[colIndex];

                  return (
                    <div
                      key={`${rep.replicationNo}-${rowIndex}-${colIndex}`}
                      className={`wf-plot-cell ${
                        item ? "" : "wf-plot-cell-empty"
                      }`}
                    >
                      {item ? (
                        <>
                          <div className="wf-plot-number">
                            P{item.plot_no || item.entry_no}
                          </div>
                          <div className="wf-plot-name">
                            {item.variety_name}
                          </div>
                        </>
                      ) : null}
                    </div>
                  );
                });
              })}
            </div>
          </div>
        ))}

        {roadsideLabelPosition === "right" && (
          <div className="wf-roadside-label vertical">ENTRYWAY {entryway}</div>
        )}
      </div>

      {roadsideLabelPosition === "bottom" && (
        <div className="wf-roadside-label">ENTRYWAY {entryway}</div>
      )}
    </div>
  );
}

export default LayoutDiagram;