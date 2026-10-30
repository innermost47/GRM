// Run the two tests of the network from the command line: node scripts/check.js [standard]
const M = require("../src/model.js");
const preset = process.argv[2] === "standard" ? "standard" : "anthony";
const age = preset === "standard" ? "s_lcdm" : "c_ht1";
const rels = M.RELATIONS.filter(r => r.kind !== "failure" && (!r.group || r.id === age || r.id === "s_novoid"))
  .map(r => ({ ...r, tolNow: r.tol }));
const meas = M.MEASUREMENTS.filter(m => preset === "standard" || !m.modelDep);
const fit = M.solveNetwork(rels, meas, null, { fullCov: true });
const opt = M.testOptions(fit);
console.log(`Preset: ${preset} | ${M.NODES.length} quantities, ${rels.length} relations, ${meas.length} measurements\n`);
console.log("Test 2: each measurement hidden, then predicted by the rest");
meas.forEach((m, k) => {
  if (m.base) return;
  const l = M.testMeasurement(rels, meas, k, fit.x, opt);
  console.log("  " + m.id.padEnd(14) + (l.reachable ? `${l.pull >= 0 ? "+" : ""}${l.pull.toFixed(2)} sigma` : "no other path"));
});
console.log("\nTest 1: each relation removed, then judged by the rest");
rels.filter(r => r.kind !== "identity").forEach(r => {
  const t = M.testRelation(rels, meas, r, fit.x, opt);
  console.log("  " + r.id.padEnd(16) + r.kind.padEnd(10) + (t.testable ? `${t.pull >= 0 ? "+" : ""}${t.pull.toFixed(2)} sigma` : "not testable"));
});
