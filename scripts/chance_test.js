// Is each relation under test just a coincidence? Two checks.
// A. Random universes: every measured value is multiplied by a random factor; how often does the relation still hold?
// B. Sister formulas: same quantities, other simple constants; how many of them would hold just as well?
const M = require("../src/model.js");
const age = "c_ht1";
const rels = M.RELATIONS.filter(r => r.kind !== "failure" && (!r.group || r.id === age || r.id === "s_novoid" || r.id === "c_hde")).map(r => ({ ...r, tolNow: r.tol }));
const meas0 = M.MEASUREMENTS.filter(m => !m.modelDep);
const claims = rels.filter(r => r.kind === "claim");
const holds = (rs, ms, r) => { const f = M.solveNetwork(rs, ms, null, { fullCov: true }); const t = M.testRelation(rs, ms, r, null, M.testOptions(f)); return t.testable ? Math.abs(t.pull) < 2 : null; };

let seed = 12345;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const N = Number(process.argv[2] || 200);
for (const span of [0.3, 1.0]) {
  const count = Object.fromEntries(claims.map(r => [r.id, 0])), valid = Object.fromEntries(claims.map(r => [r.id, 0]));
  for (let k = 0; k < N; k++) {
    const meas = meas0.map(m => {
      if (m.base || M.nodeOf(m.node).scale === "lin") return m;
      return { ...m, value: m.value * Math.pow(10, (rand() * 2 - 1) * span) };
    });
    for (const r of claims) { const h = holds(rels, meas, r); if (h !== null) { valid[r.id]++; if (h) count[r.id]++; } }
  }
  console.log(`\nA. random universes, each value multiplied by up to x${Math.pow(10, span).toFixed(1)} (${N} draws)`);
  claims.forEach(r => console.log(`  ${r.id.padEnd(12)} tol=${(r.tol || "").padEnd(6)} ` + (valid[r.id] ? `holds by chance in ${(100 * count[r.id] / valid[r.id]).toFixed(1)} %` : "not testable")));
}

console.log("\nB. sister formulas: same quantities, another simple constant K");
const simple = [1/4, 1/3, 1/2, 2/3, 3/4, 1, 4/3, 3/2, 2, 3, 4, Math.PI, 2*Math.PI, 4*Math.PI, 1/Math.PI, 1/(2*Math.PI), 1/(4*Math.PI), 1/6, 6];
const label = k => ({ [1/(2*Math.PI)]: "1/2π", [1/(4*Math.PI)]: "1/4π", [1/Math.PI]: "1/π", [Math.PI]: "π", [2*Math.PI]: "2π", [4*Math.PI]: "4π" }[k] || +k.toFixed(4));
for (const r of claims) {
  if (r.type !== "prod" && r.id !== "c_ht1" && r.id !== "c_koide") continue;
  const hits = [];
  for (const K of simple) {
    let alt;
    if (r.id === "c_ht1") alt = { ...r, f: v => Math.log10(v.H0 * v.t0 / K) };
    else if (r.id === "c_koide") alt = { ...r, f: v => (v.me + v.mmu + v.mtau) / Math.pow(Math.sqrt(v.me) + Math.sqrt(v.mmu) + Math.sqrt(v.mtau), 2) - K };
    else alt = { ...r, K: K * (r.K / (r.id === "c_seesaw" ? 1e9 : 1)) * (r.id === "c_seesaw" ? 1e9 : 1) / (r.K / (r.id === "c_seesaw" ? 1e9 : 1)) };
    if (r.type === "prod") alt = { ...r, K: r.id === "c_seesaw" ? K * 1e9 : K };
    const rs = rels.map(x => (x.id === r.id ? alt : x));
    const h = holds(rs, meas0, alt);
    if (h) hits.push(label(K));
  }
  console.log(`  ${r.id.padEnd(12)} constants that hold: ${hits.join(", ") || "none"}  (out of ${simple.length})`);
}
