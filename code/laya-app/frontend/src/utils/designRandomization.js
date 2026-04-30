function shuffleArray(array) {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

export function generateRCBDAssignments(varieties, replicationsPerTrial) {
  const replications = [];

  for (let rep = 0; rep < Number(replicationsPerTrial); rep++) {
    replications.push({
      replicationNo: rep + 1,
      assignments: shuffleArray(varieties),
    });
  }

  return replications;
}

export function generateCRDAssignments(varieties, replicationsPerTrial) {
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

export function generateDesignAssignments({
  designType,
  varieties,
  replicationsPerTrial,
}) {
  if (designType === "CRD") {
    return generateCRDAssignments(varieties, replicationsPerTrial);
  }

  return generateRCBDAssignments(varieties, replicationsPerTrial);
}