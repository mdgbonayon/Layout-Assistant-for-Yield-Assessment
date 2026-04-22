const { buildBackendTrialLayout } = require("../utils/layoutUtils");

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateRCBD(varieties, replications) {
  const assignments = [];
  let globalPlotNo = 1;

  for (let rep = 1; rep <= replications; rep++) {
    const shuffled = shuffle(varieties);

    shuffled.forEach((variety, index) => {
      assignments.push({
        replication_no: rep,
        plot_no: globalPlotNo++,
        plot_row: rep,
        plot_col: index + 1,
        variety_id: variety.id,
        variety_name: variety.variety_name,
      });
    });
  }

  return assignments;
}

function generateCRD(varieties, replications) {
  const expanded = [];

  for (let rep = 1; rep <= replications; rep++) {
    for (const variety of varieties) {
      expanded.push({
        replication_no: rep,
        variety_id: variety.id,
        variety_name: variety.variety_name,
      });
    }
  }

  const shuffled = shuffle(expanded);

  return shuffled.map((item, index) => ({
    replication_no: item.replication_no,
    plot_no: index + 1,
    plot_row: null,
    plot_col: index + 1,
    variety_id: item.variety_id,
    variety_name: item.variety_name,
  }));
}

module.exports = {
  generateRCBD,
  generateCRD,
};