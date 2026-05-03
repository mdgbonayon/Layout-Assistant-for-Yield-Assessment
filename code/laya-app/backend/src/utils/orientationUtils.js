function normalizeEntryway(entryway) {
  const value = String(entryway || "").toUpperCase();

  if (value.includes("EAST")) return "EAST";
  if (value.includes("WEST")) return "WEST";
  if (value.includes("SOUTH")) return "SOUTH";
  if (value.includes("NORTH")) return "NORTH";

  return "SOUTH";
}

function getOrderedNumbers(count, shouldReverse = false) {
  const numbers = Array.from({ length: Number(count) }, (_, i) => i + 1);
  return shouldReverse ? numbers.reverse() : numbers;
}

function getTrialOrder(numberOfTrials, trialDirection, entryway) {
  const side = normalizeEntryway(entryway);

  if (side === "EAST" || side === "SOUTH") {
    return getOrderedNumbers(numberOfTrials, true);
  }

  return getOrderedNumbers(numberOfTrials, false);
}

function getRepOrder(replications, repDirection, entryway) {
  const side = normalizeEntryway(entryway);

  if (side === "EAST" || side === "NORTH") {
    return getOrderedNumbers(replications, true);
  }

  return getOrderedNumbers(replications, false);
}

function getOrientationForEntryway(entryway) {
  const side = normalizeEntryway(entryway);

  if (side === "WEST" || side === "EAST") {
    return {
      repDirection: "vertical",
      trialDirection: "horizontal",
    };
  }

  return {
    repDirection: "horizontal",
    trialDirection: "vertical",
  };
}

function getCellPath({ rows, cols, entryway }) {
  const side = normalizeEntryway(entryway);
  const path = [];

  // SOUTH: start bottom-left, go upward, then snake by column
  if (side === "SOUTH") {
    for (let c = 1; c <= cols; c++) {
      const colIndex = c - 1;

      if (colIndex % 2 === 0) {
        for (let r = rows; r >= 1; r--) {
          path.push({ row: r, col: c });
        }
      } else {
        for (let r = 1; r <= rows; r++) {
          path.push({ row: r, col: c });
        }
      }
    }
  }

  // NORTH: start top-right, go downward, then snake by column
  if (side === "NORTH") {
    let colIndex = 0;

    for (let c = cols; c >= 1; c--) {
      if (colIndex % 2 === 0) {
        for (let r = 1; r <= rows; r++) {
          path.push({ row: r, col: c });
        }
      } else {
        for (let r = rows; r >= 1; r--) {
          path.push({ row: r, col: c });
        }
      }

      colIndex++;
    }
  }

  // WEST: start top-left, move left-to-right, snake by row
  if (side === "WEST") {
    for (let r = 1; r <= rows; r++) {
      const rowIndex = r - 1;

      if (rowIndex % 2 === 0) {
        for (let c = 1; c <= cols; c++) {
          path.push({ row: r, col: c });
        }
      } else {
        for (let c = cols; c >= 1; c--) {
          path.push({ row: r, col: c });
        }
      }
    }
  }

  // EAST: start bottom-right, move right-to-left, snake by row
  if (side === "EAST") {
    let rowIndex = 0;

    for (let r = rows; r >= 1; r--) {
      if (rowIndex % 2 === 0) {
        for (let c = cols; c >= 1; c--) {
          path.push({ row: r, col: c });
        }
      } else {
        for (let c = 1; c <= cols; c++) {
          path.push({ row: r, col: c });
        }
      }

      rowIndex++;
    }
  }

  return path;
}

function getContinuousPlotNumberMap({
  replications,
  entryway,
  plotsAcross,
  plotRowsDown,
  plotsPerReplication,
  startPlotNo = 1,
}) {
  const repOrder = getOrderedNumbers(replications);

  const cellPath = getCellPath({
    rows: Number(plotRowsDown),
    cols: Number(plotsAcross),
    entryway,
  }).slice(0, Number(plotsPerReplication));

  const map = new Map();
  let plotNo = Number(startPlotNo);

  for (const repNo of repOrder) {
    for (const cell of cellPath) {
      map.set(`${repNo}-${cell.row}-${cell.col}`, plotNo);
      plotNo++;
    }
  }

  return map;
}

module.exports = {
  normalizeEntryway,
  getOrderedNumbers,
  getTrialOrder,
  getRepOrder,
  getOrientationForEntryway,
  getCellPath,
  getContinuousPlotNumberMap,
};