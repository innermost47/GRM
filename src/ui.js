// ===== Interface =====
const KIND = {
  identity: { label: "Identité", plural: "Identités", color: "var(--k-identity)" },
  standard: { label: "Physique établie", plural: "Physique établie", color: "var(--k-standard)" },
  zero: { label: "Zéro de symétrie", plural: "Zéros", color: "var(--k-zero)" },
  claim: { label: "Relation à l'essai", plural: "Relations à l'essai", color: "var(--k-claim)" },
  failure: { label: "Échec du carnet", plural: "Échecs", color: "var(--k-failure)" },
};
const TYPE_LABEL = { prod: "produit fixe", sum: "somme nulle", fn: "équation propre" };
const CH = Object.fromEntries(CHAPTERS.map(c => [c.id, c]));
const REL = Object.fromEntries(RELATIONS.map(r => [r.id, r]));
const BASE = new Set(LAYOUT.base);
const NS = "http://www.w3.org/2000/svg";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const PRESETS = {
  anthony: { label: "H × âge = 1", age: "c_ht1", local: "c_kbc", de: "c_hde", modelDep: false, failures: false,
    note: "L'âge suit la relation à l'essai H × âge = 1, et le vide local est branché : l'expansion mesurée autour de la Voie lactée n'est pas celle de l'univers entier. Les deux valeurs de Planck qui supposent le modèle standard (H₀ et Ω_Λ) sont laissées de côté. Les autres mesures du fond diffus restent branchées." },
  standard: { label: "Modèle standard", age: "s_lcdm", local: "s_novoid", de: "c_hde", modelDep: true, failures: false,
    note: "Le réseau avec la relation d'âge du modèle ΛCDM et toutes les mesures de Planck. La tension de Hubble y apparaît directement entre H₀ local et H₀ du fond diffus." },
};
const state = {
  preset: "anthony", age: "c_ht1", local: "c_kbc", de: "c_hde", modelDep: false, failures: false,
  relOff: {}, failOn: {}, tol: {}, measOff: {}, measVal: {},
  selected: null, chapter: "all", view: "graph", claimFilter: "claim", looFilter: "reach",
};

// ---------- Formatting ----------
const SUP = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
const sup = n => String(n).split("").map(ch => SUP[ch] || ch).join("");
function fmt(v, sig = 3) {
  if (v === 0 || !isFinite(v)) return isFinite(v) ? "0" : "—";
  const a = Math.abs(v);
  if (a >= 1e-3 && a < 1e5) {
    const decimals = Math.max(0, Math.min(6, sig - 1 - Math.floor(Math.log10(a))));
    return v.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  let ex = Math.floor(Math.log10(a));
  let mant = v / Math.pow(10, ex);
  if (Math.abs(mant) >= 9.995) { mant /= 10; ex += 1; }
  return `${mant.toLocaleString("fr-FR", { minimumFractionDigits: sig - 1, maximumFractionDigits: sig - 1 })} × 10${sup(ex)}`;
}
const fmtPull = p => Math.abs(p) < 0.05 ? "0,0 σ" : `${p >= 0 ? "+" : "−"}${Math.abs(p).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} σ`;
const pullClass = p => (Math.abs(p) < 2 ? "good" : Math.abs(p) < 3 ? "warn" : "bad");
const unitOf = n => (n.unit ? " " + n.unit : "");
function nodeValueParts(n, x, sd) {
  const v = displayValue(n, x);
  const clean = n.scale === "lin" && Math.abs(v) < 1e-12 ? 0 : v;
  let unc = "";
  if (sd > 0 && isFinite(sd)) {
    if (n.scale === "lin") { if (sd > 1e-6) unc = `± ${fmt(sd, 2)}`; }
    else { const pct = sd * Math.LN10 * 100; if (pct >= 0.01) unc = `± ${fmt(pct, 2)} %`; }
  }
  return { value: fmt(clean, n.scale === "lin" && Math.abs(clean) < 10 && clean !== 0 ? 4 : 3), unc };
}
const escapeHtml = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

// ---------- Shapes ----------
function shapeMarkup(type, color, size = 7, hollow = false) {
  const fill = hollow ? "var(--paper)" : color;
  const st = `style="fill:${fill};stroke:${color};stroke-width:1.5${hollow ? ";stroke-dasharray:2 2" : ""}"`;
  if (type === "prod") return `<polygon points="0,${-size} ${size},0 0,${size} ${-size},0" ${st}/>`;
  if (type === "sum") {
    const c = hollow ? color : "var(--paper)";
    return `<circle r="${size * 0.9}" ${st}/><path d="M${-size * 0.5},0H${size * 0.5}M0,${-size * 0.5}V${size * 0.5}" style="stroke:${c};stroke-width:1.4"/>`;
  }
  const pts = [];
  for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; pts.push(`${(size * Math.cos(a)).toFixed(2)},${(size * Math.sin(a)).toFixed(2)}`); }
  return `<polygon points="${pts.join(" ")}" ${st}/>`;
}
const shapeIcon = (r, size = 12) => `<svg viewBox="-8 -8 16 16" width="${size}" height="${size}" aria-hidden="true">${shapeMarkup(r.type, KIND[r.kind].color, 6.5)}</svg>`;

// ---------- Active network ----------
function activeRelations() {
  return RELATIONS.filter(r => {
    if (r.group === "age") return state.age === r.id;
    if (r.group === "local") return state.local === r.id;
    if (r.group === "de") return state.de === r.id;
    if (r.kind === "failure") return state.failures ? !state.relOff[r.id] : !!state.failOn[r.id];
    return !state.relOff[r.id];
  }).map(r => ({ ...r, tolNow: state.tol[r.id] || r.tol }));
}
function activeMeasurements() {
  return MEASUREMENTS.filter(m => (!m.modelDep || state.modelDep) && !state.measOff[m.id])
    .map(m => (state.measVal[m.id] !== undefined ? { ...m, value: state.measVal[m.id] } : m));
}
const isActive = id => res && res.relIds.has(id);

let res = null, gen = 0;
function compute() {
  gen++;
  const rels = activeRelations(), meas = activeMeasurements();
  const fit = solveNetwork(rels, meas, null, { fullCov: true });
  const measured = new Set(meas.map(m => m.node));
  res = { rels, meas, fit, measured, relIds: new Set(rels.map(r => r.id)), loo: new Map(), rt: new Map(), carrier: new Map(), done: 0, total: 0, busy: true };
  const items = [];
  meas.forEach((m, k) => { if (!m.base) items.push({ kind: "m", k }); });
  rels.forEach(r => { if (r.kind !== "identity") items.push({ kind: "r", r }); });
  res.total = items.length;
  renderAll();
  runTests(items, gen);
}
// What a recovered measurement really tests: the definitions alone, established physics, or a relation under test.
const CARRIER = {
  def: { label: "par définition", cls: "none", plain: "Les seules définitions suffisent à la retrouver : le résultat est garanti et ne teste rien." },
  est: { label: "physique établie", cls: "est", plain: "Retrouvée par la physique établie ou une symétrie, sans aucune relation à l'essai." },
  claim: { label: "relation à l'essai", cls: "claim", plain: "Seule une relation à l'essai permet de la retrouver : c'est un vrai test de cette relation." },
};
function runTests(items, myGen) {
  const opt = testOptions(res.fit);
  const idRels = res.rels.filter(r => r.kind === "identity");
  const estRels = res.rels.filter(r => r.kind === "identity" || r.kind === "standard" || r.kind === "zero");
  const fitId = solveNetwork(idRels, res.meas, res.fit.x), optId = testOptions(fitId);
  const fitEst = solveNetwork(estRels, res.meas, res.fit.x), optEst = testOptions(fitEst);
  res.carrier = new Map();
  let idx = 0;
  const tick = () => {
    if (myGen !== gen) return;
    const t0 = performance.now();
    while (idx < items.length && performance.now() - t0 < 24) {
      const it = items[idx++];
      if (it.kind === "m") {
        const m = res.meas[it.k], l = testMeasurement(res.rels, res.meas, it.k, res.fit.x, opt);
        res.loo.set(m.id, l);
        if (l.reachable) {
          const c = testMeasurement(idRels, res.meas, it.k, fitId.x, optId).reachable ? "def"
            : testMeasurement(estRels, res.meas, it.k, fitEst.x, optEst).reachable ? "est" : "claim";
          res.carrier.set(m.id, c);
        }
      }
      else res.rt.set(it.r.id, testRelation(res.rels, res.meas, it.r, res.fit.x, opt));
      res.done++;
    }
    if (idx < items.length) { renderScore(); setTimeout(tick, 0); }
    else { res.busy = false; renderAll(); }
  };
  setTimeout(tick, 0);
}

// ---------- Verdicts in plain words ----------
function measVerdict(l) {
  if (!l) return { cls: "none", head: "Test en cours…", body: "" };
  if (!l.reachable) return { cls: "none", head: "Rien ne peut la retrouver", body: "Aucun autre chemin du réseau ne mène à cette grandeur : sans sa mesure, elle reste inconnue." };
  const n = nodeOf(l.m.node);
  const p = nodeValueParts(n, l.pred, l.sdPred);
  const c = pullClass(l.pull);
  const head = c === "good" ? "Retrouvée" : c === "warn" ? "Retrouvée de justesse" : "Pas retrouvée";
  const car = res.carrier.get(l.m.id);
  return { cls: c, head: `${head} : écart ${fmtPull(l.pull)}`, body: `Cachée, le reste du réseau la place à ${p.value}${unitOf(n)}${p.unc ? " (" + p.unc + ")" : ""}.${car ? " " + CARRIER[car].plain : ""}` };
}
function relVerdict(t, r) {
  if (!isActive(r.id)) return { cls: "none", head: "Débranchée", body: "Cette relation n'entre pas dans le calcul actuel." };
  if (r.kind === "identity") return { cls: "none", head: "Une définition", body: "Une identité transporte une valeur d'une grandeur à l'autre ; elle n'a rien à prouver." };
  if (!t) return { cls: "none", head: "Test en cours…", body: "" };
  if (r.theory && t.testable) return { cls: pullClass(t.pull), head: `Cohérente avec le reste de la théorie : écart ${fmtPull(t.pull)}`, body: "Aucune mesure n'entre ici : le test vérifie seulement que la relation s'accorde avec les autres équations de la relativité générale. Elle n'est pas comptée dans le score." };
  if (!t.testable) return { cls: "none", head: "Pas encore testable", body: "Une de ses grandeurs n'est tenue par rien d'autre : la relation prédit, mais rien ne la contrôle." };
  const c = pullClass(t.pull);
  const head = c === "good" ? "Elle tient" : c === "warn" ? "Elle tient de justesse" : "Elle ne tient pas";
  const amount = r.res === "dex" ? `un facteur ${fmt(Math.pow(10, t.resid), 4)} par rapport à l'équation` : `un écart de ${fmt(t.resid, 3)} par rapport à l'équation`;
  return { cls: c, head: `${head} : écart ${fmtPull(t.pull)}`, body: `Sans elle, le reste du réseau donne ${amount}.` };
}

// ---------- Graph ----------
const svg = document.getElementById("net");
const wrap = document.getElementById("graphwrap");
const tip = document.getElementById("tip");
const view = { x: 0, y: 0, w: LAYOUT.W, h: LAYOUT.H };
const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const gRegions = el("g", {}, svg), gEdges = el("g", {}, svg), gLabels = el("g", {}, svg), gRels = el("g", {}, svg), gNodes = el("g", {}, svg);
const pos = LAYOUT.positions;

LAYOUT.regions.forEach(rg => {
  const g = el("g", { class: "region" }, gRegions);
  el("rect", { x: rg.x, y: rg.y, width: rg.w, height: rg.h, rx: 10 }, g);
  const t = el("text", { x: rg.x + 16, y: rg.y + 30 }, g); t.textContent = CH[rg.id].name;
  const nq = NODES.filter(n => n.ch === rg.id).length, nr = RELATIONS.filter(r => r.ch === rg.id).length;
  const s = el("text", { x: rg.x + 16, y: rg.y + 47, class: "sub" }, g); s.textContent = `${nq} grandeurs · ${nr} relations`;
});

const edgeEls = [];
RELATIONS.forEach(r => r.nodes.forEach(id => {
  const [x1, y1] = pos["r:" + r.id], [x2, y2] = pos["q:" + id];
  const line = el("line", { x1, y1, x2, y2, class: "edge" }, gEdges);
  edgeEls.push({ line, r, id, base: BASE.has(id), cross: r.ch !== nodeOf(id).ch, mx: x1 * 0.55 + x2 * 0.45, my: y1 * 0.55 + y2 * 0.45 });
}));
const edgeLabels = el("g", {}, gLabels);

const relEls = {};
RELATIONS.forEach(r => {
  const [x, y] = pos["r:" + r.id];
  const g = el("g", { class: "rn", transform: `translate(${x},${y})` }, gRels);
  g.dataset.key = "r:" + r.id;
  el("circle", { r: 12, style: "fill:transparent" }, g);   // larger hit area
  const shape = el("g", {}, g);
  const t = el("text", { y: -11, "text-anchor": "middle" }, g); t.textContent = r.label;
  relEls[r.id] = { g, shape, t };
});
const nodeEls = {};
NODES.forEach(n => {
  const [x, y] = pos["q:" + n.id];
  const g = el("g", { class: "qn", transform: `translate(${x},${y})` }, gNodes);
  g.dataset.key = "q:" + n.id;
  const ring = el("circle", { r: 13.5, style: "fill:none;stroke-width:3" }, g);
  el("circle", { r: 8.5, class: "body" }, g);
  const t = el("text", { y: 23, "text-anchor": "middle" }, g); t.textContent = n.sym;
  nodeEls[n.id] = { g, ring, t };
});

function neighborsOf(sel) {
  const set = new Set();
  if (!sel) return set;
  if (sel.type === "q") RELATIONS.forEach(r => { if (r.nodes.includes(sel.id)) { set.add("r:" + r.id); r.nodes.forEach(id => set.add("q:" + id)); } });
  else REL[sel.id].nodes.forEach(id => set.add("q:" + id));
  set.add(sel.type + ":" + sel.id);
  return set;
}
function drawGraph() {
  if (!res) return;
  const sel = state.selected, nb = neighborsOf(sel);
  const zoomed = view.w <= 1000;
  const fit = res.fit;
  // nodes
  NODES.forEach((n, i) => {
    const ne = nodeEls[n.id];
    const measured = res.measured.has(n.id);
    const reach = fit.fixed[i] || fit.reachable[i];
    ne.g.setAttribute("class", "qn " + (measured ? "measured" : reach ? "predicted" : "unreached") + (sel && !nb.has("q:" + n.id) ? " dim" : ""));
    const meas = res.meas.find(m => m.node === n.id && !m.base);
    const l = meas ? res.loo.get(meas.id) : null;
    ne.ring.style.stroke = l && l.reachable ? `var(--${pullClass(l.pull)})` : "none";
    ne.t.style.display = zoomed || nb.has("q:" + n.id) ? "" : "none";
    ne.t.style.fontWeight = sel && sel.type === "q" && sel.id === n.id ? "600" : "400";
  });
  // relations
  RELATIONS.forEach(r => {
    const re = relEls[r.id];
    const on = isActive(r.id);
    re.shape.innerHTML = shapeMarkup(r.type, KIND[r.kind].color, sel && sel.type === "r" && sel.id === r.id ? 9 : 7, !on);
    re.g.setAttribute("class", "rn" + (sel && !nb.has("r:" + r.id) ? " dim" : ""));
    re.t.style.display = sel && sel.type === "r" && sel.id === r.id ? "" : "none";
  });
  // edges
  edgeLabels.innerHTML = "";
  edgeEls.forEach(e => {
    const relSel = sel && sel.type === "r" && sel.id === e.r.id;
    const nodeSel = sel && sel.type === "q" && sel.id === e.id;
    const hot = relSel || nodeSel;
    const on = isActive(e.r.id);
    e.line.style.display = e.base && !hot ? "none" : "";
    e.line.style.stroke = on ? KIND[e.r.kind].color : "var(--line)";
    e.line.style.strokeDasharray = on ? "" : "3 3";
    e.line.style.strokeOpacity = hot ? 0.95 : sel ? 0.08 : e.cross ? 0.13 : 0.42;
    e.line.style.strokeWidth = hot ? 1.8 : 1.1;
    if (relSel) {
      const ex = e.r.type === "prod" ? e.r.terms[e.id] : e.r.type === "sum" ? e.r.terms[e.id] : null;
      if (ex !== null && ex !== undefined) {
        const t = el("text", { x: e.mx, y: e.my - 3, class: "edge-label", "text-anchor": "middle" }, edgeLabels);
        const p = e.r.pow && e.r.pow[e.id] && e.r.pow[e.id] !== 1 ? ` (puissance ${e.r.pow[e.id]})` : "";
        t.textContent = (Number.isInteger(ex) ? String(ex) : ex.toLocaleString("fr-FR")) + p;
      }
    }
  });
}

function applyView() { svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`); }
function clampView(v) {
  const ratio = LAYOUT.H / LAYOUT.W;
  v.w = Math.max(260, Math.min(LAYOUT.W, v.w)); v.h = v.w * ratio;
  v.x = Math.max(-40, Math.min(LAYOUT.W - v.w + 40, v.x)); v.y = Math.max(-40, Math.min(LAYOUT.H - v.h + 40, v.y));
  return v;
}
let anim = null;
function setView(target, animate = true) {
  clampView(target);
  cancelAnimationFrame(anim);
  if (!animate || reduceMotion) { Object.assign(view, target); applyView(); drawGraph(); return; }
  const from = { ...view }, t0 = performance.now(), dur = 420;
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    view.x = from.x + (target.x - from.x) * e; view.y = from.y + (target.y - from.y) * e;
    view.w = from.w + (target.w - from.w) * e; view.h = from.h + (target.h - from.h) * e;
    applyView();
    if (k < 1) anim = requestAnimationFrame(step); else drawGraph();
  };
  anim = requestAnimationFrame(step);
}
function zoomToChapter(ch) {
  if (ch === "all") return setView({ x: 0, y: 0, w: LAYOUT.W, h: LAYOUT.H });
  const rg = LAYOUT.regions.find(r => r.id === ch);
  const w = Math.max(rg.w + 40, (rg.h + 40) * LAYOUT.W / LAYOUT.H);
  setView({ x: rg.x + rg.w / 2 - w / 2, y: rg.y + rg.h / 2 - (w * LAYOUT.H / LAYOUT.W) / 2, w });
}
function centerOn(key) {
  const [x, y] = pos[key];
  const w = Math.min(view.w, 900);
  setView({ x: x - w / 2, y: y - (w * LAYOUT.H / LAYOUT.W) / 2, w });
}
function zoomBy(f) { const cx = view.x + view.w / 2, cy = view.y + view.h / 2, w = view.w * f; setView({ x: cx - w / 2, y: cy - (w * LAYOUT.H / LAYOUT.W) / 2, w }); }
document.getElementById("zoomIn").addEventListener("click", () => zoomBy(0.7));
document.getElementById("zoomOut").addEventListener("click", () => zoomBy(1 / 0.7));
document.getElementById("zoomAll").addEventListener("click", () => { state.chapter = "all"; renderChapters(); zoomToChapter("all"); });

// Pointer: select items, pan the background
let pan = null;
svg.addEventListener("pointerdown", ev => {
  const target = ev.target.closest("[data-key]");
  if (target) return;
  pan = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y, moved: false };
  svg.setPointerCapture(ev.pointerId); svg.classList.add("panning");
});
svg.addEventListener("pointermove", ev => {
  if (pan) {
    const scale = view.w / svg.getBoundingClientRect().width;
    const dx = (ev.clientX - pan.x) * scale, dy = (ev.clientY - pan.y) * scale;
    if (Math.abs(dx) + Math.abs(dy) > 2) pan.moved = true;
    view.x = pan.vx - dx; view.y = pan.vy - dy; clampView(view); applyView();
    return;
  }
  const target = ev.target.closest("[data-key]");
  if (!target) { tip.hidden = true; return; }
  showTip(target.dataset.key, ev);
});
svg.addEventListener("pointerup", () => {
  if (pan) { svg.classList.remove("panning"); if (!pan.moved && state.selected) { state.selected = null; renderSelection(); } pan = null; drawGraph(); }
});
svg.addEventListener("pointerleave", () => { tip.hidden = true; });
svg.addEventListener("click", ev => {
  const target = ev.target.closest("[data-key]");
  if (!target) return;
  const [type, id] = target.dataset.key.split(":");
  select(type, id, { center: false });
});
function showTip(key, ev) {
  const [type, id] = key.split(":");
  let html;
  if (type === "q") {
    const n = nodeOf(id), i = NODE_INDEX[id];
    const p = nodeValueParts(n, res.fit.x[i], Math.sqrt(variance(res.fit, i)));
    html = `${escapeHtml(n.name)}<small>${escapeHtml(n.sym)} = ${p.value}${escapeHtml(unitOf(n))}</small>`;
  } else {
    const r = REL[id];
    html = `${escapeHtml(r.label)}<small>${escapeHtml(r.formula)}</small>`;
  }
  tip.innerHTML = html; tip.hidden = false;
  const box = wrap.getBoundingClientRect();
  let x = ev.clientX - box.left + 14, y = ev.clientY - box.top + 14;
  if (x + 270 > box.width) x = Math.max(4, ev.clientX - box.left - 270);
  if (y + 60 > box.height) y = ev.clientY - box.top - 60;
  tip.style.left = x + "px"; tip.style.top = y + "px";
}

// ---------- Selection and detail ----------
const detail = document.getElementById("detail");
function select(type, id, opts = {}) {
  state.selected = { type, id };
  renderSelection();
  if (opts.center !== false && state.view === "graph") {
    const ch = type === "q" ? nodeOf(id).ch : REL[id].ch;
    if (state.chapter !== "all" && state.chapter !== ch) { state.chapter = ch; renderChapters(); }
    centerOn(type + ":" + id);
  }
  if (opts.scroll) document.querySelector(".stage").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  try { history.replaceState(null, "", "#" + hashOf(type, id)); } catch (e) { /* ignore */ }
}
function renderSelection() { renderDetail(); drawGraph(); renderList(); }
const HASH = {}; const UNHASH = {};
NODES.forEach(n => { const h = "g-" + n.id.replace(/[^A-Za-z0-9]/g, "-"); HASH["q:" + n.id] = h; UNHASH[h] = ["q", n.id]; });
RELATIONS.forEach(r => { const h = "r-" + r.id.replace(/[^A-Za-z0-9]/g, "-"); HASH["r:" + r.id] = h; UNHASH[h] = ["r", r.id]; });
const hashOf = (type, id) => HASH[type + ":" + id];

function linkButton(type, id) {
  if (type === "q") {
    const n = nodeOf(id);
    return `<button type="button" data-go="q:${id}"><svg viewBox="-8 -8 16 16" aria-hidden="true"><circle r="5.5" style="fill:${res.measured.has(id) ? "var(--ink)" : "var(--paper)"};stroke:var(--ink);stroke-width:1.4"/></svg>${escapeHtml(n.sym)} · ${escapeHtml(n.name)}</button>`;
  }
  const r = REL[id];
  return `<button type="button" data-go="r:${id}">${shapeIcon(r)}${escapeHtml(r.label)}</button>`;
}
function renderStart() {
  detail.innerHTML = `
    <div class="eyebrow">Pour commencer</div>
    <h2>Choisir un point d'entrée</h2>
    <p class="plain">Chaque rond et chaque forme s'ouvre ici, avec une explication en clair, puis la formule, les valeurs et le test pour les scientifiques.</p>
    <div class="start">
      <div class="links">
        ${linkButton("r", "i_S")}
        ${linkButton("r", "c_ht1")}
        ${linkButton("r", "c_koide")}
        ${linkButton("r", "z_cube")}
        ${linkButton("q", "Snu")}
        ${linkButton("r", "i_E0")}
        ${linkButton("r", "i_heat_time")}
        ${linkButton("r", "s_shadow")}
      </div>
      <p class="note">Sur la carte, un clic sur le fond désélectionne ; un glisser déplace la vue. La vue en liste donne le même contenu, au clavier.</p>
    </div>`;
}
function renderDetail() {
  if (!res) return;
  const sel = state.selected;
  if (!sel) return renderStart();
  if (sel.type === "q") return renderNodeDetail(sel.id);
  return renderRelDetail(sel.id);
}
function renderNodeDetail(id) {
  const n = nodeOf(id), i = NODE_INDEX[id], fit = res.fit;
  const fixed = fit.fixed[i], reach = fixed || fit.reachable[i];
  const sd = Math.sqrt(variance(fit, i));
  const p = nodeValueParts(n, fit.x[i], sd);
  const meas = MEASUREMENTS.filter(m => m.node === id);
  const activeMeas = res.meas.filter(m => m.node === id);
  const rels = RELATIONS.filter(r => r.nodes.includes(id));
  const am = activeMeas.find(m => !m.base);
  const v = am ? measVerdict(res.loo.get(am.id)) : null;
  let measRows = meas.map(m => {
    const on = activeMeas.includes(m) || activeMeas.some(a => a.id === m.id);
    const val = state.measVal[m.id] !== undefined ? state.measVal[m.id] : m.value;
    const unc = m.exact ? "exacte" : m.sigmaDex ? `× ou ÷ ${fmt(Math.pow(10, m.sigmaDex), 2)}` : `± ${fmt(m.sigma, 2)}`;
    return `<dt>Mesure${on ? "" : " (non branchée)"}</dt><dd>${fmt(val, 6)}${escapeHtml(unitOf(n))} ${unc}<br><span class="note">${escapeHtml(m.src)}${m.modelDep ? " · dépend du modèle standard" : ""}</span></dd>`;
  }).join("");
  const measControls = meas.filter(m => !m.base && (!m.modelDep || state.modelDep)).map(m => {
    const on = !state.measOff[m.id];
    const val = state.measVal[m.id] !== undefined ? state.measVal[m.id] : m.value;
    return `<div class="row-actions">
      <button class="btn" type="button" data-meas-toggle="${m.id}">${on ? "Débrancher cette mesure" : "Brancher cette mesure"}</button>
      <label class="note" for="mv-${m.id}">Valeur</label>
      <input id="mv-${m.id}" data-meas-value="${m.id}" type="number" step="any" value="${val}" style="width:9.5em;padding:5px 8px;border:1px solid var(--line);border-radius:5px;background:var(--bg);font-family:var(--f-mono);font-size:12.5px">
      ${state.measVal[m.id] !== undefined ? `<button class="btn" type="button" data-meas-reset="${m.id}">Valeur d'origine</button>` : ""}
    </div>`;
  }).join("");
  detail.innerHTML = `
    <div class="kindline"><span class="badge"><i style="background:var(--ink);border-radius:50%"></i>Grandeur · ${escapeHtml(CH[n.ch].name)}</span></div>
    <h2>${escapeHtml(n.name)}</h2>
    <p class="plain">${escapeHtml(n.plain)}</p>
    <div class="bignum">${escapeHtml(n.sym)} = ${reach ? p.value : "?"}<small>${escapeHtml(unitOf(n))}${reach && p.unc ? " · " + p.unc : ""}</small></div>
    ${fixed ? `<div class="verdict none"><strong>Constante de référence</strong><span>Sa valeur est fixée par le Système international ; elle sert d'appui à tout le réseau.</span></div>` : ""}
    ${!reach ? `<div class="verdict none"><strong>Non reliée</strong><span>Aucune mesure ne mène à cette grandeur dans le réglage actuel.</span></div>` : ""}
    ${v ? `<div class="verdict ${v.cls}"><strong>${v.head}</strong><span>${v.body}</span></div>` : ""}
    ${reach && TARGET_TEXT[id] ? `<div class="verdict ${TARGET_TEXT[id](displayValue(n, fit.x[i])).cls}"><strong>Cible</strong><span>${TARGET_TEXT[id](displayValue(n, fit.x[i])).text}</span></div>` : ""}
    <div class="sci">
      <h4>Pour les scientifiques</h4>
      <dl class="kv">
        <dt>Valeur du réseau</dt><dd>${reach ? p.value + escapeHtml(unitOf(n)) + (p.unc ? " " + p.unc : "") : "non reliée"}</dd>
        <dt>Espace de calcul</dt><dd>${n.scale === "lin" ? "valeur (grandeur signée)" : "log₁₀ (grandeur positive)"}</dd>
        ${measRows}
      </dl>
      ${measControls}
      <h4>Relations qui la touchent (${rels.length})</h4>
      <div class="links">${rels.map(r => linkButton("r", r.id)).join("")}</div>
    </div>`;
}
function renderRelDetail(id) {
  const r = REL[id];
  const t = res.rt.get(id);
  const v = relVerdict(t, r);
  const on = isActive(id);
  const kind = KIND[r.kind];
  let controls = "";
  if (r.group) {
    const alt = RELATIONS.filter(o => o.group === r.group && o.id !== id);
    controls = on ? `<p class="note">Relation au choix : ${alt.map(a => escapeHtml(a.label)).join(", ")} la remplace dans les réglages.</p>`
      : `<div class="row-actions"><button class="btn primary" type="button" data-use-group="${id}">Utiliser cette relation</button></div>`;
  } else if (r.kind !== "identity") {
    const tolSelect = (r.kind === "claim" || r.kind === "failure") && r.res === "dex"
      ? `<label class="note" for="tol-${id}">Tolérance</label><select id="tol-${id}" data-tol="${id}">${Object.keys(TOL).map(k => `<option value="${k}" ${(state.tol[id] || r.tol) === k ? "selected" : ""}>${TOL_LABEL[k]}</option>`).join("")}</select>` : "";
    controls = `<div class="row-actions"><button class="btn" type="button" data-rel-toggle="${id}">${on ? "Débrancher cette relation" : "Brancher cette relation"}</button>${tolSelect}</div>`;
  }
  const tolText = r.kind === "identity" || r.kind === "zero" ? "exacte (10⁻⁷)" : TOL_LABEL[state.tol[id] || r.tol || "exact"];
  detail.innerHTML = `
    <div class="kindline"><span class="badge" style="color:${kind.color}"><svg viewBox="-8 -8 16 16" width="14" height="14" aria-hidden="true">${shapeMarkup(r.type, kind.color, 6.5)}</svg>${kind.label}</span><span class="badge" style="color:var(--muted)">${TYPE_LABEL[r.type]} · ${escapeHtml(CH[r.ch].name)}</span></div>
    <h2>${escapeHtml(r.label)}</h2>
    <p class="plain">${escapeHtml(r.plain)}</p>
    <div class="verdict ${v.cls}"><strong>${v.head}</strong><span>${v.body}</span></div>
    ${controls}
    <div class="sci">
      <h4>Pour les scientifiques</h4>
      <div class="formula">${escapeHtml(r.formula)}</div>
      ${r.origin ? `<p class="note"><strong>Origine :</strong> ${escapeHtml(r.origin)}</p>` : ""}
      ${r.note ? `<p class="note">${escapeHtml(r.note)}</p>` : ""}
      <dl class="kv">
        <dt>Type de neurone</dt><dd>${TYPE_LABEL[r.type]}${r.type === "prod" ? " · linéaire en log₁₀" : r.type === "sum" ? " · linéaire en valeur" : " · non linéaire"}</dd>
        <dt>Tolérance</dt><dd>${tolText}</dd>
        ${t && t.testable ? `<dt>Résidu sans elle</dt><dd>${fmt(t.resid, 3)} ${r.res === "dex" ? "en log₁₀" : ""}</dd><dt>Incertitude du reste</dt><dd>${fmt(t.sdRest, 2)}</dd><dt>Tension</dt><dd>${fmtPull(t.pull)}</dd>` : ""}
        ${r.carnet ? `<dt>Carnet</dt><dd>ligne ${r.carnet}</dd>` : ""}
      </dl>
      <h4>Grandeurs reliées (${r.nodes.length})</h4>
      <div class="links">${r.nodes.map(nid => linkButton("q", nid)).join("")}</div>
    </div>`;
}
detail.addEventListener("click", ev => {
  const go = ev.target.closest("[data-go]");
  if (go) { const [type, id] = go.dataset.go.split(":"); select(type, id); return; }
  const rt = ev.target.closest("[data-rel-toggle]");
  if (rt) {
    const id = rt.dataset.relToggle, r = REL[id], on = isActive(id);
    if (r.kind === "failure" && !state.failures) state.failOn[id] = !on; else state.relOff[id] = on;
    markCustom(); compute(); return;
  }
  const ug = ev.target.closest("[data-use-group]");
  if (ug) { const r = REL[ug.dataset.useGroup]; state[r.group] = r.id; markCustom(); compute(); return; }
  const mt = ev.target.closest("[data-meas-toggle]");
  if (mt) { const id = mt.dataset.measToggle; state.measOff[id] = !state.measOff[id]; markCustom(); compute(); return; }
  const mr = ev.target.closest("[data-meas-reset]");
  if (mr) { delete state.measVal[mr.dataset.measReset]; markCustom(); compute(); }
});
detail.addEventListener("change", ev => {
  const tol = ev.target.closest("[data-tol]");
  if (tol) { state.tol[tol.dataset.tol] = tol.value; markCustom(); compute(); return; }
  const mv = ev.target.closest("[data-meas-value]");
  if (mv) { const v = parseFloat(String(mv.value).replace(",", ".")); const id = mv.dataset.measValue; if (isFinite(v) && (nodeOf(MEASUREMENTS.find(m => m.id === id).node).scale === "lin" || v > 0)) { state.measVal[id] = v; markCustom(); compute(); } else mv.value = state.measVal[id] ?? MEASUREMENTS.find(m => m.id === id).value; }
});

// ---------- Controls ----------
function segButtons(container, options, current, onPick) {
  container.innerHTML = "";
  options.forEach(([value, label]) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = label;
    b.setAttribute("aria-pressed", String(current === value));
    b.addEventListener("click", () => onPick(value));
    container.appendChild(b);
  });
}
function markCustom() { state.preset = "custom"; }
function applyPreset(id) {
  const p = PRESETS[id];
  Object.assign(state, { preset: id, age: p.age, local: p.local, de: p.de, modelDep: p.modelDep, failures: p.failures, relOff: {}, failOn: {}, tol: {}, measOff: {}, measVal: {} });
  compute();
}
function renderControls() {
  segButtons(document.getElementById("presetSeg"), [["anthony", PRESETS.anthony.label], ["standard", PRESETS.standard.label], ["custom", "Personnalisé"]], state.preset, v => { if (v !== "custom") applyPreset(v); });
  document.getElementById("presetNote").textContent = state.preset === "custom"
    ? "Réglage personnalisé : des relations, des tolérances ou des mesures ont été changées. Revenir à un réglage de départ efface ces changements."
    : PRESETS[state.preset].note;
  segButtons(document.getElementById("ageSeg"), [["c_ht1", "H × âge = 1 (toutes les relations)"], ["s_lcdm", "modèle standard"]], state.age, v => { state.age = v; markCustom(); compute(); });
  segButtons(document.getElementById("localSeg"), [["s_novoid", "comme partout"], ["c_kbc", "vide local KBC"]], state.local, v => { state.local = v; markCustom(); compute(); });
  segButtons(document.getElementById("deSeg"), [["c_hde", "tension espace / temps"], ["c_ihde", "en échange avec la matière"]], state.de, v => { state.de = v; markCustom(); compute(); });
  segButtons(document.getElementById("mdSeg"), [[false, "laissées de côté"], [true, "branchées"]], state.modelDep, v => { state.modelDep = v; markCustom(); compute(); });
  segButtons(document.getElementById("failSeg"), [[false, "débranchés"], [true, "branchés"]], state.failures, v => { state.failures = v; markCustom(); compute(); });
  segButtons(document.getElementById("viewSeg"), [["graph", "Carte"], ["list", "Liste"]], state.view, v => { state.view = v; renderView(); });
}
function renderView() {
  const isGraph = state.view === "graph";
  wrap.hidden = !isGraph; document.getElementById("listview").hidden = isGraph;
  document.getElementById("legend").hidden = !isGraph;
  segButtons(document.getElementById("viewSeg"), [["graph", "Carte"], ["list", "Liste"]], state.view, v => { state.view = v; renderView(); });
  if (!isGraph) renderList(); else drawGraph();
}
function renderChapters() {
  const box = document.getElementById("chapters");
  box.innerHTML = "";
  [["all", "Tout"], ...CHAPTERS.map(c => [c.id, c.name])].forEach(([id, name]) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = name;
    b.setAttribute("aria-pressed", String(state.chapter === id));
    if (id !== "all") b.title = CH[id].plain;
    b.addEventListener("click", () => { state.chapter = id; renderChapters(); if (state.view === "graph") zoomToChapter(id); else renderList(); });
    box.appendChild(b);
  });
}

// ---------- List view ----------
function renderList() {
  const lv = document.getElementById("listview");
  if (lv.hidden || !res) return;
  const chs = state.chapter === "all" ? CHAPTERS : CHAPTERS.filter(c => c.id === state.chapter);
  lv.innerHTML = chs.map(c => {
    const rels = RELATIONS.filter(r => r.ch === c.id);
    return `<div><h3>${escapeHtml(c.name)}</h3><p class="note">${escapeHtml(c.plain)}</p>
      ${rels.map(r => {
        const t = res.rt.get(r.id), on = isActive(r.id);
        let status = `<span class="pill none">${on ? (r.kind === "identity" ? "identité" : t ? (t.testable ? "" : "non testable") : "…") : "débranchée"}</span>`;
        if (on && t && t.testable) status = `<span class="pill ${pullClass(t.pull)}">${fmtPull(t.pull)}</span>`;
        const selected = state.selected && state.selected.type === "r" && state.selected.id === r.id;
        return `<button type="button" class="lrow" data-go="r:${r.id}" ${selected ? 'aria-current="true"' : ""}>${shapeIcon(r, 14)}<span>${escapeHtml(r.label)}<span class="note" style="display:block">${KIND[r.kind].label}</span></span><span class="f">${escapeHtml(r.formula)}</span>${status}</button>`;
      }).join("")}</div>`;
  }).join("");
}
document.getElementById("listview").addEventListener("click", ev => {
  const go = ev.target.closest("[data-go]");
  if (go) { const [type, id] = go.dataset.go.split(":"); select(type, id, { center: false }); }
});

// ---------- Search ----------
const findInput = document.getElementById("find");
const FIND = new Map();
NODES.forEach(n => FIND.set(`${n.name} (${n.sym})`, ["q", n.id]));
RELATIONS.forEach(r => FIND.set(`${r.label} · relation`, ["r", r.id]));
document.getElementById("findList").innerHTML = [...FIND.keys()].map(k => `<option value="${escapeHtml(k)}"></option>`).join("");
findInput.addEventListener("change", () => {
  const v = findInput.value.trim();
  let hit = FIND.get(v);
  if (!hit) { const low = v.toLowerCase(); for (const [k, h] of FIND) if (k.toLowerCase().includes(low)) { hit = h; break; } }
  if (hit) { select(hit[0], hit[1]); findInput.value = ""; }
});

// ---------- Tables ----------
function pullBar(p) {
  const x = v => 66 + Math.max(-4, Math.min(4, v)) * 15;
  return `<svg class="pullbar" viewBox="0 0 132 18" aria-hidden="true"><rect class="band" x="${x(-2)}" y="3" width="${x(2) - x(-2)}" height="12"/><line class="axis" x1="6" y1="9" x2="126" y2="9"/><line x1="66" y1="2" x2="66" y2="16" style="stroke:var(--muted)"/><circle cx="${x(p)}" cy="9" r="4.5" style="fill:var(--${pullClass(p)})"/></svg>`;
}
function claimRows() {
  const f = state.claimFilter;
  return RELATIONS.filter(r => r.kind !== "identity" && (f === "all" || (f === "claim" ? (r.kind === "claim" || r.kind === "failure") : r.kind === f)));
}
function renderClaims() {
  segButtons(document.getElementById("claimFilter"), [["claim", "Relations à l'essai"], ["zero", "Zéros"], ["standard", "Physique établie"], ["all", "Tout"]], state.claimFilter, v => { state.claimFilter = v; renderClaims(); });
  const rows = claimRows();
  let h = `<thead><tr><th>Relation</th><th class="col-eq">Équation</th><th>Résultat</th><th>Tension</th><th class="col-bar"><span class="skip">Position</span></th></tr></thead><tbody>`;
  rows.forEach(r => {
    const on = isActive(r.id), t = res.rt.get(r.id);
    let result = "", tension = "", bar = "";
    if (!on) { result = `<span class="sub">débranchée dans ce réglage</span>`; tension = `<span class="pill none">—</span>`; }
    else if (!t) { result = `<span class="sub">calcul…</span>`; tension = `<span class="pill none">…</span>`; }
    else if (!t.testable) { result = `<span class="sub">prédit sans contrôle : une grandeur n'est tenue que par elle</span>`; tension = `<span class="pill none">non testable</span>`; }
    else {
      result = r.res === "dex" ? `facteur ${fmt(Math.pow(10, t.resid), 4)}` : `écart ${fmt(t.resid, 3)}`;
      tension = `<span class="pill ${pullClass(t.pull)}">${fmtPull(t.pull)}</span>`; bar = pullBar(t.pull);
    }
    h += `<tr class="click" data-go="r:${r.id}"><td><span class="kindtag">${shapeIcon(r)}${escapeHtml(r.label)}</span><span class="sub">${escapeHtml(r.origin || KIND[r.kind].label)}${r.carnet ? " · " + r.carnet : ""}</span></td><td class="num col-eq">${escapeHtml(r.formula)}</td><td class="num">${result}</td><td>${tension}</td><td class="col-bar">${bar}</td></tr>`;
  });
  document.getElementById("claimTable").innerHTML = h + "</tbody>";
}
function renderLoo() {
  segButtons(document.getElementById("looFilter"), [["reach", "Retrouvables"], ["claim", "Tests des relations à l'essai"], ["est", "Physique établie"], ["def", "Par définition"], ["tension", "En tension (> 2 σ)"], ["all", "Toutes"]], state.looFilter, v => { state.looFilter = v; renderLoo(); });
  let rows = res.meas.filter(m => !m.base).map(m => ({ m, l: res.loo.get(m.id), c: res.carrier.get(m.id) }));
  if (state.looFilter === "reach") rows = rows.filter(x => !x.l || x.l.reachable);
  if (["claim", "est", "def"].includes(state.looFilter)) rows = rows.filter(x => x.c === state.looFilter);
  if (state.looFilter === "tension") rows = rows.filter(x => x.l && x.l.reachable && Math.abs(x.l.pull) >= 2);
  let h = `<thead><tr><th>Grandeur</th><th>Mesurée</th><th>Retrouvée sans sa mesure</th><th>Ce que cela teste</th><th>Écart</th><th class="col-bar"><span class="skip">Position</span></th></tr></thead><tbody>`;
  if (!rows.length) h += `<tr><td colspan="6" class="note">${res.busy ? "Calcul en cours…" : "Aucune mesure dans ce filtre."}</td></tr>`;
  rows.forEach(({ m, l, c }) => {
    const n = nodeOf(m.node);
    const carrier = c ? `<span class="pill ${CARRIER[c].cls}" title="${escapeHtml(CARRIER[c].plain)}">${CARRIER[c].label}</span>` : `<span class="pill none">—</span>`;
    let pred = `<span class="sub">calcul…</span>`, pill = `<span class="pill none">…</span>`, bar = "";
    if (l && !l.reachable) { pred = `<span class="sub">aucun autre chemin</span>`; pill = `<span class="pill none">seule source</span>`; }
    else if (l) { const p = nodeValueParts(n, l.pred, l.sdPred); pred = `${p.value}${escapeHtml(unitOf(n))}<span class="sub">${p.unc}</span>`; pill = `<span class="pill ${pullClass(l.pull)}">${fmtPull(l.pull)}</span>`; bar = pullBar(l.pull); }
    h += `<tr class="click" data-go="q:${n.id}"><td>${escapeHtml(n.sym)} · ${escapeHtml(n.name)}<span class="sub">${escapeHtml(CH[n.ch].name)}</span></td><td class="num">${fmt(m.value, 5)}${escapeHtml(unitOf(n))}<span class="sub" style="font-family:var(--f-body)">${escapeHtml(m.src)}</span></td><td class="num">${pred}</td><td>${carrier}</td><td>${pill}</td><td class="col-bar">${bar}</td></tr>`;
  });
  document.getElementById("looTable").innerHTML = h + "</tbody>";
}
const TARGETS = {
  Snu: v => { const inside = v <= 0.0642; return `<span class="pill ${inside ? "good" : "bad"}">${inside ? "sous la limite DESI (0,0642 eV)" : "au-dessus de la limite DESI"}</span>`; },
  m1: () => `<span class="pill none">cible : relevés de galaxies</span>`,
  M: () => `<span class="pill none">hors de portée directe</span>`,
};
const TARGET_TEXT = {
  Snu: v => ({ cls: v <= 0.0642 ? "good" : "bad", text: `Les oscillations imposent au moins 0,0587 eV ; DESI DR2 et Planck limitent la somme à moins de 0,0642 eV. La valeur du réseau, ${fmt(v, 3)} eV, ${v <= 0.0642 ? "tient dans cette fenêtre" : "en sort"}. Elle n'est qu'à ${fmt(v - 0.0587, 2)} eV du minimum : presque tout neutrino léger donnerait la même somme, et un écart aussi petit serait très difficile à mesurer. Ce qui se teste vraiment, c'est « ordre normal, et un neutrino le plus léger presque sans masse ».` }),
  m1: v => ({ cls: "none", text: `Aucune expérience ne mesure encore m₁ directement ; c'est la somme Σm_ν qui la contraindra.` }),
  M: v => ({ cls: "none", text: `Une masse de ${fmt(v, 2)} GeV est hors de portée des accélérateurs ; seule sa trace (des neutrinos très légers, la matière qui l'emporte sur l'antimatière) est observable.` }),
};
function renderOutputs() {
  const fit = res.fit;
  let h = `<thead><tr><th>Grandeur</th><th>Valeur du réseau</th><th>En clair</th></tr></thead><tbody>`;
  CHAPTERS.forEach(c => {
    const nodes = NODES.filter((n, i) => n.ch === c.id && !res.measured.has(n.id) && !fit.fixed[i] && fit.reachable[i]);
    if (!nodes.length) return;
    h += `<tr><td colspan="3" style="background:var(--bg)"><strong style="font-family:var(--f-display);font-weight:500;font-size:16px">${escapeHtml(c.name)}</strong></td></tr>`;
    nodes.forEach(n => {
      const i = NODE_INDEX[n.id];
      const p = nodeValueParts(n, fit.x[i], Math.sqrt(variance(fit, i)));
      const target = TARGETS[n.id] ? " " + TARGETS[n.id](displayValue(n, fit.x[i])) : "";
      h += `<tr class="click" data-go="q:${n.id}"><td>${escapeHtml(n.sym)} · ${escapeHtml(n.name)}</td><td class="num">${p.value}${escapeHtml(unitOf(n))}<span class="sub">${p.unc}</span></td><td>${escapeHtml(n.plain)}${target}</td></tr>`;
    });
  });
  document.getElementById("outTable").innerHTML = h + "</tbody>";
}
function renderCarnet() {
  const byCarnet = {};
  RELATIONS.forEach(r => { if (r.carnet) (byCarnet[r.carnet] = byCarnet[r.carnet] || []).push(r); });
  let h = `<thead><tr><th>Ligne</th><th>Paire</th><th>Dans le réseau</th></tr></thead><tbody>`;
  CARNET.forEach(row => {
    const rels = byCarnet[row.id];
    const note = CARNET_NOTES[row.id];
    let how, detailHtml;
    if (rels) { how = "branched"; detailHtml = `<div class="links">${rels.map(r => linkButton("r", r.id)).join("")}</div>`; }
    else { how = note ? note.how : "qualitative"; detailHtml = `<span class="sub" style="color:var(--ink-2)">${escapeHtml(note ? note.why : "")}</span>`; }
    const cls = how === "branched" ? "good" : how === "failure" ? "bad" : "none";
    h += `<tr><td class="num">${row.id}</td><td>${escapeHtml(row.paire)}<span class="sub">${escapeHtml(row.categorie || "")}</span></td><td><span class="pill ${cls}">${CARNET_HOW_LABEL[how]}</span>${detailHtml}</td></tr>`;
  });
  document.getElementById("carnetTable").innerHTML = h + "</tbody>";
}
["claimTable", "looTable", "outTable", "carnetTable"].forEach(id => {
  document.getElementById(id).addEventListener("click", ev => {
    const go = ev.target.closest("[data-go]");
    if (go) { const [type, key] = go.dataset.go.split(":"); select(type, key, { scroll: true }); }
  });
});
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => { const [type, key] = b.dataset.go.split(":"); select(type, key, { scroll: true }); }));

// ---------- Score ----------
function carrierChip(kind, label) {
  const ids = [...res.carrier.entries()].filter(([, c]) => c === kind).map(([id]) => id);
  const ok = ids.filter(id => Math.abs(res.loo.get(id).pull) < 2).length;
  const cls = !ids.length ? "" : ok === ids.length ? "good" : ok >= ids.length - 1 ? "warn" : "bad";
  return `<span class="chip ${cls}" title="${escapeHtml(CARRIER[kind].plain)}">${label} <b>${ok} / ${ids.length}</b></span>`;
}
function renderScore() {
  const loo = [...res.loo.values()].filter(l => l.reachable);
  const okLoo = loo.filter(l => Math.abs(l.pull) < 2).length;
  const by = k => [...res.rt.values()].filter(t => t.r.kind === k && t.testable && !t.r.theory);
  const chip = (label, list) => {
    const ok = list.filter(t => Math.abs(t.pull) < 2).length;
    const cls = !list.length ? "" : ok === list.length ? "good" : ok >= list.length - 1 ? "warn" : "bad";
    return `<span class="chip ${cls}">${label} <b>${ok} / ${list.length}</b></span>`;
  };
  const claims = [...by("claim"), ...by("failure")];
  document.getElementById("score").innerHTML =
    carrierChip("claim", "Mesures qui testent une relation à l'essai") + carrierChip("est", "Mesures retrouvées par la physique établie") +
    `<span class="chip" title="${escapeHtml(CARRIER.def.plain)}">Garanties par les définitions <b>${[...res.carrier.values()].filter(c => c === "def").length}</b></span>` +
    chip("Relations à l'essai tenues", claims) + chip("Zéros vérifiés", by("zero")) + chip("Physique établie", by("standard")) +
    (res.busy ? `<span class="chip busy">Tests en cours ${res.done} / ${res.total}</span>` : "");
  document.getElementById("footStats").textContent = `${NODES.length} grandeurs · ${res.rels.length} relations branchées sur ${RELATIONS.length} · ${res.meas.length} mesures`;
}

// ---------- Legend and static parts ----------
function renderLegend() {
  const kinds = Object.entries(KIND).map(([k, v]) => `<span><svg viewBox="-8 -8 16 16" aria-hidden="true">${shapeMarkup("prod", v.color, 6)}</svg>${v.label}</span>`).join("");
  const types = Object.entries(TYPE_LABEL).map(([t, label]) => `<span><svg viewBox="-8 -8 16 16" aria-hidden="true">${shapeMarkup(t, "var(--ink-2)", 6)}</svg>${label}</span>`).join("");
  document.getElementById("legend").innerHTML = kinds + types +
    `<span>Les liens vers c, ħ, G, k et e ne s'affichent qu'à la sélection, pour garder la carte lisible.</span>`;
  document.getElementById("howShapes").innerHTML =
    `<g transform="translate(40,20)">${shapeMarkup("prod", "var(--k-claim)", 9)}</g><g transform="translate(80,20)">${shapeMarkup("sum", "var(--k-zero)", 9)}</g><g transform="translate(120,20)">${shapeMarkup("fn", "var(--k-standard)", 9)}</g>`;
  document.getElementById("sourceList").innerHTML = SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${escapeHtml(t)}</a></li>`).join("");
}

function renderAll() {
  renderControls(); renderScore(); renderDetail(); drawGraph(); renderList();
  renderClaims(); renderLoo(); renderOutputs();
}

// ---------- Boot ----------
renderLegend(); renderChapters(); renderCarnet(); applyView();
compute();
renderView();
function fromHash() {
  const h = (location.hash || "").slice(1);
  if (UNHASH[h]) { const [type, id] = UNHASH[h]; select(type, id); }
}
fromHash();
window.addEventListener("hashchange", fromHash);
