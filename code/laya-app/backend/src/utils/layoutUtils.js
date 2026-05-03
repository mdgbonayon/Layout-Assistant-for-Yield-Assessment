const { getOrientationForEntryway } = require("./orientationUtils");

function shuffleArray(array) {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function getPlotDimensions({
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

  return {
    plotWidth,
    plotHeight,
  };
}

function getGridCandidates(plotsPerRep) {
  const candidates = [];

  for (let plotRowsDown = 1; plotRowsDown <= plotsPerRep; plotRowsDown++) {
    const plotsAcross = Math.ceil(plotsPerRep / plotRowsDown);
    const totalSlots = plotsAcross * plotRowsDown;
    const emptySlots = totalSlots - plotsPerRep;

    candidates.push({
      plotsAcross,
      plotRowsDown,
      totalSlots,
      emptySlots,
    });
  }

  return candidates;
}

function computeReplicationSize({
  plotsAcross,
  plotRowsDown,
  plotWidth,
  plotHeight,
  alley,
}) {
  const replicationWidth =
    plotsAcross * plotWidth + Math.max(0, plotsAcross - 1) * alley;

  const replicationHeight =
    plotRowsDown * plotHeight + Math.max(0, plotRowsDown - 1) * alley;

  return {
    replicationWidth,
    replicationHeight,
  };
}

function computeExperimentSize({
  replicationWidth,
  replicationHeight,
  replicationsPerTrial,
  numberOfTrials,
  alley,
  trialGap,
  repDirection,
  trialDirection,
}) {
  let trialWidth = 0;
  let trialHeight = 0;

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

  let experimentWidth = 0;
  let experimentHeight = 0;

  if (trialDirection === "horizontal") {
    experimentWidth =
      numberOfTrials * trialWidth +
      Math.max(0, numberOfTrials - 1) * trialGap;
    experimentHeight = trialHeight;
  } else {
    experimentWidth = trialWidth;
    experimentHeight =
      numberOfTrials * trialHeight +
      Math.max(0, numberOfTrials - 1) * trialGap;
  }

  return {
    trialWidth,
    trialHeight,
    experimentWidth,
    experimentHeight,
  };
}

function scoreLayout({
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

  const hasRealFieldDimensions =
    Number(fieldWidth) < 999999 && Number(fieldHeight) < 999999;

  const fieldArea = hasRealFieldDimensions ? fieldWidth * fieldHeight : usedArea;
  const wastedArea = hasRealFieldDimensions
    ? Math.max(0, fieldArea - usedArea)
    : 0;

  const fieldRatio =
    fieldWidth > 0 && fieldHeight > 0 ? fieldWidth / fieldHeight : 1;

  const experimentRatio =
    experimentHeight > 0 ? experimentWidth / experimentHeight : 1;

  const aspectRatioDifference = Math.abs(fieldRatio - experimentRatio);

  // Stronger realism scoring for replication shape
  const replicationRatio =
    replicationHeight > 0 ? replicationWidth / replicationHeight : 1;

  const replicationAspectPenalty = Math.abs(Math.log(replicationRatio));

  let shapePenalty = 0;

  // Strongly discourage 1-row and 2-row replications unless necessary
  if (plotRowsDown === 1) shapePenalty += 25000;
  else if (plotRowsDown === 2) shapePenalty += 8000;

  // Discourage very wide single-strip layouts
  if (plotsAcross >= 12) shapePenalty += 6000;
  if (plotsAcross >= 16) shapePenalty += 8000;

  // Slightly discourage too many empty slots
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

function findBestExperimentLayout({
  plotsPerReplication,
  replicationsPerTrial,
  numberOfTrials,
  plotWidth,
  plotHeight,
  alley,
  fieldWidth,
  fieldHeight,
  trialGap,
  entryway,
}) {
  const gridCandidates = getGridCandidates(plotsPerReplication);

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

  return {
    best: bestOption,
    candidates,
  };
}

function getSnakeOrderedAssignments(assignments, plotsAcross) {
  const rows = [];

  for (let i = 0; i < assignments.length; i += plotsAcross) {
    const rowIndex = rows.length;
    const slice = assignments.slice(i, i + plotsAcross);

    if (rowIndex % 2 === 1) {
      slice.reverse();
    }

    rows.push(slice);
  }

  return rows.flat();
}

function generateRCBDAssignments(varieties, replicationsPerTrial) {
  const replications = [];

  for (let rep = 0; rep < Number(replicationsPerTrial); rep++) {
    replications.push({
      replicationNo: rep + 1,
      assignments: shuffleArray(varieties),
    });
  }

  return replications;
}

function generateCRDAssignments(varieties, replicationsPerTrial) {
  const fullPool = [];

  for (let rep = 0; rep < Number(replicationsPerTrial); rep++) {
    for (const variety of varieties) {
      fullPool.push({ ...variety });
    }
  }

  const shuffled = shuffleArray(fullPool);
  const chunkSize = varieties.length;
  const replications = [];

  for (let rep = 0; rep < Number(replicationsPerTrial); rep++) {
    const start = rep * chunkSize;
    const end = start + chunkSize;

    replications.push({
      replicationNo: rep + 1,
      assignments: shuffled.slice(start, end),
    });
  }

  return replications;
}

function generateDesignAssignments({
  designType,
  varieties,
  replicationsPerTrial,
}) {
  if (designType === "CRD") {
    return generateCRDAssignments(varieties, replicationsPerTrial);
  }

  return generateRCBDAssignments(varieties, replicationsPerTrial);
}

function buildBackendTrialLayout({
  designType,
  varieties,
  replicationsPerTrial,
  rowsPerPlot,
  plantsPerRow,
  rowSpacing,
  plantSpacing,
  alleywaySpacing,
  numberOfTrials = 1,
  fieldWidth = 999999,
  fieldLength = 999999,
  trialGap = null,
  entryway = null,
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
    fieldHeight: Number(fieldLength),
    trialGap: resolvedTrialGap,
    entryway,
  });

  const best = bestLayoutResult.best;

  const randomizedReplications = generateDesignAssignments({
    designType,
    varieties,
    replicationsPerTrial,
  });

  const replications = randomizedReplications.map((rep) => ({
    replicationNo: rep.replicationNo,
    assignments: getSnakeOrderedAssignments(
      rep.assignments,
      best.plotsAcross
    ),
    plotsAcross: best.plotsAcross,
    plotRowsDown: best.plotRowsDown,
    replicationWidth: best.replicationWidth,
    replicationHeight: best.replicationHeight,
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
    replications,
  };
}

module.exports = {
  shuffleArray,
  getPlotDimensions,
  getGridCandidates,
  computeReplicationSize,
  computeExperimentSize,
  scoreLayout,
  findBestExperimentLayout,
  getSnakeOrderedAssignments,
  generateRCBDAssignments,
  generateCRDAssignments,
  generateDesignAssignments,
  buildBackendTrialLayout,
};