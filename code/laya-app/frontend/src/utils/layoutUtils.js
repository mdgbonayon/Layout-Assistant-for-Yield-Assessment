import { generateDesignAssignments } from "./designRandomization";
import { getOrientationForEntryway } from "./orientationUtils";

export function round2(value) {
  return Number(value || 0).toFixed(2);
}

export function getPlotDimensions({
  rowsPerPlot,
  plantsPerRow,
  rowSpacing,
  plantSpacing,
}) {
  const plotWidth = Math.max(0, (Number(rowsPerPlot) - 1) * Number(rowSpacing));
  const plotHeight = Math.max(
    0,
    (Number(plantsPerRow) - 1) * Number(plantSpacing)
  );

  return { plotWidth, plotHeight };
}

export function getGridCandidates(plotsPerRep) {
  const candidates = [];

  for (let plotRowsDown = 1; plotRowsDown <= plotsPerRep; plotRowsDown++) {
    const plotsAcross = Math.ceil(plotsPerRep / plotRowsDown);
    const totalSlots = plotsAcross * plotRowsDown;

    candidates.push({
      plotsAcross,
      plotRowsDown,
      totalSlots,
      emptySlots: totalSlots - plotsPerRep,
    });
  }

  return candidates;
}

export function computeReplicationSize({
  plotsAcross,
  plotRowsDown,
  plotWidth,
  plotHeight,
  alley,
}) {
  return {
    replicationWidth:
      plotsAcross * plotWidth + Math.max(0, plotsAcross - 1) * alley,
    replicationHeight:
      plotRowsDown * plotHeight + Math.max(0, plotRowsDown - 1) * alley,
  };
}

export function computeExperimentSize({
  replicationWidth,
  replicationHeight,
  replicationsPerTrial,
  numberOfTrials,
  alley,
  trialGap,
  repDirection,
  trialDirection,
}) {
  let trialWidth;
  let trialHeight;

  if (repDirection === "vertical") {
    trialWidth = replicationWidth;
    trialHeight =
      replicationsPerTrial * replicationHeight +
      Math.max(0, replicationsPerTrial - 1) * alley;
  } else {
    trialWidth =
      replicationsPerTrial * replicationWidth +
      Math.max(0, replicationsPerTrial - 1) * alley;
    trialHeight = replicationHeight;
  }

  let experimentWidth;
  let experimentHeight;

  if (trialDirection === "horizontal") {
    experimentWidth =
      numberOfTrials * trialWidth + Math.max(0, numberOfTrials - 1) * trialGap;
    experimentHeight = trialHeight;
  } else {
    experimentWidth = trialWidth;
    experimentHeight =
      numberOfTrials * trialHeight + Math.max(0, numberOfTrials - 1) * trialGap;
  }

  return { trialWidth, trialHeight, experimentWidth, experimentHeight };
}

export function scoreLayout({
  experimentWidth,
  experimentHeight,
  fieldWidth,
  fieldHeight,
  emptySlots,
  plotsAcross,
  plotRowsDown,
  replicationWidth,
  replicationHeight,
}) {
  const fitsByDimensions =
    experimentWidth <= fieldWidth && experimentHeight <= fieldHeight;

  const overflowWidth = Math.max(0, experimentWidth - fieldWidth);
  const overflowHeight = Math.max(0, experimentHeight - fieldHeight);

  const overflowArea =
    overflowWidth * Math.max(fieldHeight, experimentHeight) +
    overflowHeight * Math.max(fieldWidth, experimentWidth);

  const usedArea = experimentWidth * experimentHeight;
  const fieldArea = fieldWidth * fieldHeight;
  const wastedArea = Math.max(0, fieldArea - usedArea);

  const fieldRatio =
    fieldWidth > 0 && fieldHeight > 0 ? fieldWidth / fieldHeight : 1;

  const experimentRatio =
    experimentHeight > 0 ? experimentWidth / experimentHeight : 1;

  const aspectRatioDifference = Math.abs(fieldRatio - experimentRatio);

  const replicationRatio =
    replicationHeight > 0 ? replicationWidth / replicationHeight : 1;

  const replicationAspectPenalty = Math.abs(Math.log(replicationRatio));

  let shapePenalty = 0;

  if (plotRowsDown === 1) shapePenalty += 25000;
  else if (plotRowsDown === 2) shapePenalty += 8000;

  if (plotsAcross >= 12) shapePenalty += 6000;
  if (plotsAcross >= 16) shapePenalty += 8000;

  shapePenalty += emptySlots * 2000;

  let score = 0;
  if (fitsByDimensions) score += 1000000;

  score -= overflowArea * 10000;
  score -= aspectRatioDifference * 1000;
  score -= wastedArea;
  score -= replicationAspectPenalty * 5000;
  score -= shapePenalty;

  return {
    fits: fitsByDimensions,
    fitsByDimensions,
    overflowWidth,
    overflowHeight,
    overflowArea,
    usedArea,
    wastedArea,
    aspectRatioDifference,
    replicationAspectPenalty,
    shapePenalty,
    score,
  };
}

export function findBestExperimentLayout({
  plotsPerReplication,
  replicationsPerTrial,
  numberOfTrials,
  plotWidth,
  plotHeight,
  alley,
  fieldWidth,
  fieldHeight,
  trialGap,
  entryway = "SOUTH",
}) {
  const gridCandidates = getGridCandidates(Number(plotsPerReplication));
  const forcedOrientation = getOrientationForEntryway(entryway);

  const orientationCandidates = [
    {
      repDirection: forcedOrientation.repDirection,
      trialDirection: forcedOrientation.trialDirection,
    },
  ];

  let bestOption = null;
  const candidates = [];

  for (const grid of gridCandidates) {
    const { replicationWidth, replicationHeight } = computeReplicationSize({
      plotsAcross: grid.plotsAcross,
      plotRowsDown: grid.plotRowsDown,
      plotWidth,
      plotHeight,
      alley,
    });

    for (const orientation of orientationCandidates) {
      const size = computeExperimentSize({
        replicationWidth,
        replicationHeight,
        replicationsPerTrial,
        numberOfTrials,
        alley,
        trialGap,
        repDirection: orientation.repDirection,
        trialDirection: orientation.trialDirection,
      });

      const scoring = scoreLayout({
        experimentWidth: size.experimentWidth,
        experimentHeight: size.experimentHeight,
        fieldWidth,
        fieldHeight,
        emptySlots: grid.emptySlots,
        plotsAcross: grid.plotsAcross,
        plotRowsDown: grid.plotRowsDown,
        replicationWidth,
        replicationHeight,
      });

      const candidate = {
        plotsAcross: grid.plotsAcross,
        plotRowsDown: grid.plotRowsDown,
        totalSlots: grid.totalSlots,
        emptySlots: grid.emptySlots,
        replicationWidth,
        replicationHeight,
        repDirection: orientation.repDirection,
        trialDirection: orientation.trialDirection,
        ...size,
        ...scoring,
      };

      candidates.push(candidate);

      if (!bestOption || candidate.score > bestOption.score) {
        bestOption = candidate;
      }
    }
  }

  return { best: bestOption, candidates };
}

export function getSnakeGrid(items, plotsAcross) {
  const rows = [];

  for (let i = 0; i < items.length; i += plotsAcross) {
    const rowIndex = rows.length;
    const slice = items.slice(i, i + plotsAcross);

    if (rowIndex % 2 === 1) slice.reverse();

    rows.push(slice);
  }

  return rows;
}

export function buildTrialLayout({
  designType,
  varieties,
  rowsPerPlot,
  plantsPerRow,
  rowSpacing,
  plantSpacing,
  alleywaySpacing,
  replicationsPerTrial,
  numberOfTrials = 1,
  fieldWidth = 999999,
  fieldHeight = 999999,
  trialGap = null,
  entryway = "SOUTH",
}) {
  const { plotWidth, plotHeight } = getPlotDimensions({
    rowsPerPlot,
    plantsPerRow,
    rowSpacing,
    plantSpacing,
  });

  const alley = Number(alleywaySpacing) || 0;
  const resolvedTrialGap = trialGap !== null ? Number(trialGap) : alley;

  const bestLayoutResult = findBestExperimentLayout({
    plotsPerReplication: varieties.length,
    replicationsPerTrial: Number(replicationsPerTrial),
    numberOfTrials: Number(numberOfTrials),
    plotWidth,
    plotHeight,
    alley,
    fieldWidth: Number(fieldWidth),
    fieldHeight: Number(fieldHeight),
    trialGap: resolvedTrialGap,
    entryway,
  });

  const best = bestLayoutResult.best;

  const randomizedReplications = generateDesignAssignments({
    designType,
    varieties,
    replicationsPerTrial,
  });

  const replications = randomizedReplications.map((replication) => ({
    replicationNo: replication.replicationNo,
    assignments: replication.assignments,
    rows: getSnakeGrid(replication.assignments, best.plotsAcross),
  }));

  return {
    plotWidth,
    plotHeight,
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
    fitsField: best.fits,
    score: best.score,
    evaluatedCandidates: bestLayoutResult.candidates,
    entryway,
    replications,
  };
}