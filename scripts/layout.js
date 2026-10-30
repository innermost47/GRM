// Precompute a readable layout: each chapter in its own region, force layout inside it.
const fs = require("fs");
const { NODES, RELATIONS, CHAPTERS } = require("../src/model.js");

const W = 1600, H = 1000;
// [column, row, column span] on a 3 x 3 grid whose cells share the map's 16:10 shape
const CELLS = {
  charges: [0, 0, 1], light: [1, 0, 1], grain: [2, 0, 1],
  particles: [0, 1, 1], bounds: [1, 1, 1], notes: [2, 1, 1],
  cosmos: [0, 2, 1], holes: [1, 2, 1], life: [2, 2, 1],
};
const CW = W / 3, CH = H / 3;
const BASE = new Set(["c", "hbar", "kB", "e", "G"]);   // drawn in their chapter, their links hidden by default

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const items = [];
NODES.forEach(n => items.push({ key: "q:" + n.id, type: "q", ch: n.ch, id: n.id }));
RELATIONS.forEach(r => items.push({ key: "r:" + r.id, type: "r", ch: r.ch, id: r.id }));
const index = Object.fromEntries(items.map((it, i) => [it.key, i]));
const cellW = ch => CW * CELLS[ch][2];
const cellCenter = ch => [CELLS[ch][0] * CW + cellW(ch) / 2, CELLS[ch][1] * CH + CH / 2 + 14];
items.forEach(it => { const [cx, cy] = cellCenter(it.ch); it.x = cx + (rand() - 0.5) * cellW(it.ch) * 0.6; it.y = cy + (rand() - 0.5) * CH * 0.6; });

const edges = [];
RELATIONS.forEach(r => r.nodes.forEach(id => {
  if (BASE.has(id)) return;
  edges.push({ a: index["r:" + r.id], b: index["q:" + id], cross: r.ch !== NODES.find(n => n.id === id).ch });
}));

const ITER = 1600;
for (let it = 0; it < ITER; it++) {
  const cool = 1 - it / ITER;
  const fx = new Float64Array(items.length), fy = new Float64Array(items.length);
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const dx = items[i].x - items[j].x, dy = items[i].y - items[j].y;
      const d2 = dx * dx + dy * dy + 0.01, d = Math.sqrt(d2);
      const same = items[i].ch === items[j].ch;
      const f = (same ? 700 : 200) / d2 + (d < 30 ? (30 - d) * 0.9 : 0);
      fx[i] += f * dx / d; fy[i] += f * dy / d; fx[j] -= f * dx / d; fy[j] -= f * dy / d;
    }
  }
  for (const e of edges) {
    const A = items[e.a], B = items[e.b];
    const dx = B.x - A.x, dy = B.y - A.y, d = Math.sqrt(dx * dx + dy * dy) + 0.01;
    const k = e.cross ? 0.004 : 0.05, rest = e.cross ? 120 : 34;
    const f = k * (d - rest);
    fx[e.a] += f * dx / d; fy[e.a] += f * dy / d; fx[e.b] -= f * dx / d; fy[e.b] -= f * dy / d;
  }
  items.forEach((p, i) => {
    const [cx, cy] = cellCenter(p.ch);
    fx[i] += 0.012 * (cx - p.x); fy[i] += 0.02 * (cy - p.y);
    const step = 5 * cool + 0.2, len = Math.hypot(fx[i], fy[i]) || 1;
    p.x += Math.min(step, len) * fx[i] / len; p.y += Math.min(step, len) * fy[i] / len;
    const x0 = CELLS[p.ch][0] * CW, y0 = CELLS[p.ch][1] * CH;
    p.x = Math.max(x0 + 28, Math.min(x0 + cellW(p.ch) - 28, p.x));
    p.y = Math.max(y0 + 66, Math.min(y0 + CH - 30, p.y));
  });
}

const positions = {};
items.forEach(p => { positions[p.key] = [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]; });
const regions = CHAPTERS.map(c => ({ id: c.id, x: CELLS[c.id][0] * CW + 8, y: CELLS[c.id][1] * CH + 8, w: cellW(c.id) - 16, h: CH - 16 }));
fs.writeFileSync(__dirname + "/../data/layout.json", JSON.stringify({ W, H, positions, regions, base: [...BASE] }));
console.log("layout written", Object.keys(positions).length);
