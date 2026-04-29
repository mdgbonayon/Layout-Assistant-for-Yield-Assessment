function normalizeEntryway(entryway) {
  const value = String(entryway || "").toUpperCase();

  if (value.includes("EAST")) return "EAST";
  if (value.includes("WEST")) return "WEST";
  if (value.includes("SOUTH")) return "SOUTH";
  if (value.includes("NORTH")) return "NORTH";

  return "NORTH";
}

function getOrderedNumbers(count, shouldReverse = false) {
  const numbers = Array.from({ length: Number(count) }, (_, i) => i + 1);
  return shouldReverse ? numbers.reverse() : numbers;
}

function getRepOrder(replications, repDirection, entryway) {
  const side = normalizeEntryway(entryway);

  if (repDirection === "horizontal") {
    return getOrderedNumbers(replications, side === "EAST");
  }

  if (repDirection === "vertical") {
    return getOrderedNumbers(replications, side === "SOUTH");
  }

  return getOrderedNumbers(replications);
}

function getTrialOrder(numberOfTrials, trialDirection, entryway) {
  const side = normalizeEntryway(entryway);

  if (trialDirection === "horizontal") {
    return getOrderedNumbers(numberOfTrials, side === "EAST");
  }

  if (trialDirection === "vertical") {
    return getOrderedNumbers(numberOfTrials, side === "SOUTH");
  }

  return getOrderedNumbers(numberOfTrials);
}

function getCellPath({ rows, cols, entryway, repDirection }) {
  const side = normalizeEntryway(entryway);
  const path = [];

  const verticalSnakeFromTop = (startCol, endCol, stepCol) => {
    let colIndex = 0;

    for (let c = startCol; stepCol > 0 ? c <= endCol : c >= endCol; c += stepCol) {
      if (colIndex % 2 === 0) {
        for (let r = 1; r <= rows; r++) path.push({ row: r, col: c });
      } else {
        for (let r = rows; r >= 1; r--) path.push({ row: r, col: c });
      }
      colIndex++;
    }
  };

  const verticalSnakeFromBottom = (startCol, endCol, stepCol) => {
    let colIndex = 0;

    for (let c = startCol; stepCol > 0 ? c <= endCol : c >= endCol; c += stepCol) {
      if (colIndex % 2 === 0) {
        for (let r = rows; r >= 1; r--) path.push({ row: r, col: c });
      } else {
        for (let r = 1; r <= rows; r++) path.push({ row: r, col: c });
      }
      colIndex++;
    }
  };

  const horizontalSnakeFromTop = () => {
    for (let r = 1; r <= rows; r++) {
      if ((r - 1) % 2 === 0) {
        for (let c = 1; c <= cols; c++) path.push({ row: r, col: c });
      } else {
        for (let c = cols; c >= 1; c--) path.push({ row: r, col: c });
      }
    }
  };

  const horizontalSnakeFromBottom = () => {
    let rowIndex = 0;

    for (let r = rows; r >= 1; r--) {
      if (rowIndex % 2 === 0) {
        for (let c = 1; c <= cols; c++) path.push({ row: r, col: c });
      } else {
        for (let c = cols; c >= 1; c--) path.push({ row: r, col: c });
      }
      rowIndex++;
    }
  };

  if (repDirection === "horizontal") {
    if (side === "EAST") verticalSnakeFromTop(cols, 1, -1);
    else verticalSnakeFromBottom(1, cols, 1);
  } else {
    if (side === "SOUTH") horizontalSnakeFromBottom();
    else horizontalSnakeFromTop();
  }

  return path;
}

function getContinuousPlotNumberMap({
  replications,
  repDirection,
  entryway,
  plotsAcross,
  plotRowsDown,
}) {
  // IMPORTANT:
  // Plot numbering follows planting sequence by replication number,
  // not visual display order.
  const plantingRepOrder = getOrderedNumbers(replications);

  const cellPath = getCellPath({
    rows: Number(plotRowsDown),
    cols: Number(plotsAcross),
    entryway,
    repDirection,
  });

  const map = new Map();
  let plotNo = 1;

  for (const repNo of plantingRepOrder) {
    for (const cell of cellPath) {
      map.set(`${repNo}-${cell.row}-${cell.col}`, plotNo);
      plotNo++;
    }
  }

  return map;
}

module.exports = {
  normalizeEntryway,
  getRepOrder,
  getTrialOrder,
  getCellPath,
  getContinuousPlotNumberMap,
};