export function normalizeEntryway(entryway) {
  const value = String(entryway || "").toUpperCase();

  if (value.includes("EAST")) return "EAST";
  if (value.includes("WEST")) return "WEST";
  if (value.includes("SOUTH")) return "SOUTH";
  if (value.includes("NORTH")) return "NORTH";

  return "SOUTH";
}

export function getOrderedNumbers(count, shouldReverse = false) {
  const numbers = Array.from({ length: Number(count) }, (_, i) => i + 1);
  return shouldReverse ? numbers.reverse() : numbers;
}

export function getTrialOrder(numberOfTrials, entryway) {
  const side = normalizeEntryway(entryway);
  return side === "EAST" || side === "SOUTH"
    ? getOrderedNumbers(numberOfTrials, true)
    : getOrderedNumbers(numberOfTrials, false);
}

export function getRepOrder(replications, entryway) {
  const side = normalizeEntryway(entryway);
  return side === "EAST" || side === "NORTH"
    ? getOrderedNumbers(replications, true)
    : getOrderedNumbers(replications, false);
}

export function getOrientationForEntryway(entryway) {
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