#!/usr/bin/env bun
// Renders coverage/lcov.info into a single self-contained HTML report that follows
// the web app's design system (DESIGN.md / apps/web globals.css .dark tokens):
// neutral OKLCH surfaces, borderless-first, Inter, restrained motion. No external
// dependency — parses lcov, embeds the coverage data and source, ships one file with
// inline CSS/JS. Tree (folder-grouped) and Flat views; per-file source with covered /
// uncovered highlighting. Run after `bun test --coverage`.
//   bun scripts/coverage-report.ts [lcov.info] [out.html]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const lcovPath = process.argv[2] ?? 'coverage/lcov.info';
const outPath = process.argv[3] ?? 'coverage/html/index.html';
const root = process.cwd();

interface FileCov {
  path: string;
  lines: Map<number, number>; // line number -> hit count
  lf: number;
  lh: number;
  fnf: number;
  fnh: number;
}

function parseLcov(text: string): FileCov[] {
  const files: FileCov[] = [];
  let cur: FileCov | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('SF:')) {
      cur = { path: line.slice(3), lines: new Map(), lf: 0, lh: 0, fnf: 0, fnh: 0 };
    } else if (!cur) {
      continue;
    } else if (line.startsWith('DA:')) {
      const [ln, hits] = line.slice(3).split(',');
      cur.lines.set(Number(ln), Number(hits));
    } else if (line.startsWith('LF:')) {
      cur.lf = Number(line.slice(3));
    } else if (line.startsWith('LH:')) {
      cur.lh = Number(line.slice(3));
    } else if (line.startsWith('FNF:')) {
      cur.fnf = Number(line.slice(4));
    } else if (line.startsWith('FNH:')) {
      cur.fnh = Number(line.slice(4));
    } else if (line === 'end_of_record') {
      files.push(cur);
      cur = null;
    }
  }
  return files;
}

const files = parseLcov(readFileSync(lcovPath, 'utf8')).sort((a, b) =>
  a.path.localeCompare(b.path),
);

// Compact per-file payload for the client: line coverage counts + source lines as
// [lineNo, hits] where hits is null for non-executable lines, 0 for a miss, >0 for a hit.
const payload = files.map((f) => {
  const abs = resolve(root, f.path);
  const src = existsSync(abs) ? readFileSync(abs, 'utf8').split('\n') : [];
  return {
    p: f.path,
    lh: f.lh,
    lf: f.lf,
    fnh: f.fnh,
    fnf: f.fnf,
    src: src.map(
      (t, i) => [t, f.lines.has(i + 1) ? f.lines.get(i + 1)! : null] as [string, number | null],
    ),
  };
});

const totals = files.reduce(
  (a, f) => ({ lh: a.lh + f.lh, lf: a.lf + f.lf, fnh: a.fnh + f.fnh, fnf: a.fnf + f.fnf }),
  { lh: 0, lf: 0, fnh: 0, fnf: 0 },
);

const data = JSON.stringify({ totals, files: payload }).replace(/<\/(script)/gi, '<\\/$1');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>API coverage</title>
<style>
  :root {
    --bg: #0a0a0a;          /* background  oklch(0.145 0 0) */
    --card: #171717;        /* card        oklch(0.205 0 0) */
    --muted: #262626;       /* muted       oklch(0.269 0 0) */
    --fg: #fafafa;          /* foreground  oklch(0.985 0 0) */
    --mfg: #a1a1a1;         /* muted-fg    oklch(0.708 0 0) */
    --border: rgba(255,255,255,0.10);
    --radius: 0.625rem;
    --good: #4ade80;
    --warn: #fbbf24;
    --bad: #f87171;
    color-scheme: dark;
  }
  * { box-sizing: border-box; }
  html { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: 'Inter Variable','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased;
  }
  .mono { font-family: ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace; }
  .num { font-variant-numeric: tabular-nums; }

  /* ---- header ---- */
  header { position: sticky; top: 0; z-index: 10; background: color-mix(in srgb, var(--bg) 82%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
  .hi { max-width: 1180px; margin: 0 auto; padding: 22px 24px 0; }
  .top { display: flex; align-items: flex-end; gap: 28px; flex-wrap: wrap; }
  .title { font-size: 13px; font-weight: 600; letter-spacing: 0.02em; color: var(--mfg); text-transform: uppercase; margin: 0 0 4px; }
  .overall { display: flex; align-items: baseline; gap: 10px; }
  .overall .big { font-size: 34px; font-weight: 680; letter-spacing: -0.03em; line-height: 1; }
  .overall .of { font-size: 13px; color: var(--mfg); }
  .side { margin-left: auto; display: flex; align-items: baseline; gap: 24px; }
  .stat { display: flex; flex-direction: column; gap: 2px; }
  .stat b { font-size: 17px; font-weight: 620; }
  .stat span { font-size: 11px; color: var(--mfg); letter-spacing: 0.03em; }
  .track { height: 4px; border-radius: 999px; background: var(--muted); margin: 16px 0 0; overflow: hidden; }
  .track i { display: block; height: 100%; border-radius: 999px; transition: width .4s ease-out; }

  /* ---- toolbar ---- */
  .toolbar { max-width: 1180px; margin: 0 auto; padding: 14px 24px; display: flex; align-items: center; gap: 12px; }
  .seg { display: inline-flex; background: var(--card); border-radius: var(--radius); padding: 3px; gap: 2px; }
  .seg button { appearance: none; border: 0; background: transparent; color: var(--mfg); font: inherit; font-size: 13px; font-weight: 520; padding: 5px 14px; border-radius: calc(var(--radius) * 0.7); cursor: pointer; transition: color .15s, background .15s; }
  .seg button[aria-pressed="true"] { background: var(--muted); color: var(--fg); }
  .seg button:hover:not([aria-pressed="true"]) { color: var(--fg); }
  #q { margin-left: auto; background: var(--card); border: 1px solid var(--border); color: var(--fg); border-radius: var(--radius); padding: 8px 13px; font: inherit; font-size: 13px; width: 260px; outline: none; transition: border-color .15s; }
  #q::placeholder { color: var(--mfg); }
  #q:focus { border-color: color-mix(in srgb, var(--fg) 30%, transparent); }
  .expand-all { appearance: none; border: 0; background: transparent; color: var(--mfg); font: inherit; font-size: 12.5px; cursor: pointer; padding: 6px 8px; border-radius: 6px; }
  .expand-all:hover { color: var(--fg); }

  /* ---- list ---- */
  main { max-width: 1180px; margin: 0 auto; padding: 0 24px 80px; }
  .cols { display: grid; grid-template-columns: 1fr 84px 132px 50px; gap: 16px; padding: 10px 12px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--mfg); border-bottom: 1px solid var(--border); position: sticky; top: 118px; background: var(--bg); z-index: 4; }
  .cols .r { text-align: right; }
  .row { display: grid; grid-template-columns: 1fr 84px 132px 50px; gap: 16px; align-items: center; padding: 7px 12px; border-radius: 8px; cursor: pointer; user-select: none; }
  @media (hover: hover) { .row:hover { background: var(--muted); } }
  .name { display: flex; align-items: center; gap: 7px; min-width: 0; }
  .chev { width: 14px; height: 14px; flex: none; color: var(--mfg); transition: transform .15s ease; }
  .chev.open { transform: rotate(90deg); }
  .chev.leaf { visibility: hidden; }
  .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row.dir .label { font-weight: 560; }
  .row.file .label { font-size: 13px; }
  .label .dir-prefix { color: var(--mfg); }
  .icon { width: 15px; height: 15px; flex: none; color: var(--mfg); }
  .counts { text-align: right; color: var(--mfg); font-size: 12px; }
  .bar { height: 6px; border-radius: 999px; background: var(--muted); overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 999px; }
  .pct { text-align: right; font-weight: 600; font-size: 13px; }
  .dot { width: 6px; height: 6px; border-radius: 999px; flex: none; }

  /* ---- source ---- */
  .src { margin: 2px 0 8px; border-radius: 8px; overflow: hidden; background: color-mix(in srgb, var(--card) 60%, var(--bg)); animation: reveal .2s ease-out; }
  @keyframes reveal { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  .src table { width: 100%; border-collapse: collapse; }
  .src td { padding: 0 10px; white-space: pre; vertical-align: top; font-family: ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size: 12.5px; line-height: 1.6; }
  .src .ln { text-align: right; color: var(--mfg); user-select: none; width: 1%; opacity: .5; }
  .src .hc { text-align: right; user-select: none; width: 1%; color: var(--mfg); font-size: 10.5px; opacity: .8; }
  .src tr.hit .hc { color: var(--good); }
  .src tr.miss { background: color-mix(in srgb, var(--bad) 13%, transparent); }
  .src tr.miss .hc { color: var(--bad); }
  .src tr.miss .code { box-shadow: inset 2px 0 0 var(--bad); }
  .src .code { width: 100%; color: color-mix(in srgb, var(--fg) 92%, transparent); }
  .empty { text-align: center; color: var(--mfg); padding: 48px; font-size: 13px; }

  @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
  @media (max-width: 640px) {
    .cols, .row { grid-template-columns: 1fr 96px 46px; }
    .cols .cbar, .row .bar { display: none; }
    .side { width: 100%; margin: 8px 0 0; }
  }
</style>
</head>
<body>
<header>
  <div class="hi">
    <div class="top">
      <div>
        <p class="title">API coverage</p>
        <div class="overall"><span class="big num" id="ov"></span><span class="of num" id="ovof"></span></div>
      </div>
      <div class="side">
        <div class="stat"><b class="num" id="fnpct"></b><span>functions</span></div>
        <div class="stat"><b class="num" id="nfiles"></b><span>files</span></div>
      </div>
    </div>
    <div class="track"><i id="ovbar"></i></div>
  </div>
  <div class="toolbar">
    <div class="seg" role="tablist">
      <button id="vtree" aria-pressed="true">Tree</button>
      <button id="vflat" aria-pressed="false">Flat</button>
    </div>
    <div class="seg" role="tablist">
      <button id="sname" aria-pressed="true">Name</button>
      <button id="scov" aria-pressed="false">Coverage</button>
    </div>
    <button class="expand-all" id="toggleAll">Collapse all</button>
    <input id="q" type="search" placeholder="Filter files…" autocomplete="off" spellcheck="false">
  </div>
</header>
<main>
  <div class="cols">
    <span>File</span><span class="r">Lines</span><span class="r cbar">Coverage</span><span class="r"></span>
  </div>
  <div id="list"></div>
  <div class="empty" id="empty" hidden>No files match “<span id="term"></span>”.</div>
</main>
<script>
const D = JSON.parse(${JSON.stringify(data)});
const rank = p => p >= 90 ? "good" : p >= 75 ? "warn" : "bad";
const col = r => r === "good" ? "var(--good)" : r === "warn" ? "var(--warn)" : "var(--bad)";
const pct = (h, t) => t === 0 ? 100 : (h / t) * 100;
const fmt = p => Number.isInteger(p) ? String(p) : p.toFixed(1);
const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

const chevSvg = '<svg class="chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>';
const folderSvg = '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"/></svg>';
const fileSvg = '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 1.5h5L13 5.5v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1z"/><path d="M9 1.5v4h4"/></svg>';

// ---- overall header ----
const oLine = pct(D.totals.lh, D.totals.lf), oFn = pct(D.totals.fnh, D.totals.fnf);
const ov = document.getElementById("ov");
ov.textContent = fmt(oLine) + "%"; ov.style.color = col(rank(oLine));
document.getElementById("ovof").textContent = D.totals.lh + " / " + D.totals.lf + " lines";
document.getElementById("fnpct").textContent = fmt(oFn) + "%";
document.getElementById("nfiles").textContent = D.files.length;
const ovbar = document.getElementById("ovbar");
ovbar.style.background = col(rank(oLine));
requestAnimationFrame(() => { ovbar.style.width = oLine + "%"; });

// ---- tree model ----
function buildTree(files) {
  const rootNode = { seg: "", dir: true, kids: new Map(), files: [], lh: 0, lf: 0 };
  for (const f of files) {
    const parts = f.p.split("/");
    let node = rootNode; node.lh += f.lh; node.lf += f.lf;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      if (!node.kids.has(seg)) node.kids.set(seg, { seg, dir: true, kids: new Map(), files: [], lh: 0, lf: 0, path: parts.slice(0, i + 1).join("/") });
      node = node.kids.get(seg); node.lh += f.lh; node.lf += f.lf;
    }
    node.files.push(f);
  }
  // collapse chains of single-child folders (src/actions -> src/actions) into one row
  function flatten(node) {
    for (const [, k] of node.kids) flatten(k);
    if (node !== rootNode) {
      while (node.kids.size === 1 && node.files.length === 0) {
        const only = [...node.kids.values()][0];
        node.seg = node.seg + "/" + only.seg; node.path = only.path;
        node.kids = only.kids; node.files = only.files;
      }
    }
  }
  flatten(rootNode);
  return rootNode;
}
const tree = buildTree(D.files);

// ---- state ----
let view = "tree";
let sort = "name";   // "name" | "coverage" (coverage sorts ascending, worst first)
let filter = "";

// Comparators for folders (by seg) and files (by path); coverage sorts ascending
// so poorly covered entries surface first, with name as the tie-breaker.
const cmp = {
  name: { dir: (a, b) => a.seg.localeCompare(b.seg), file: (a, b) => a.p.localeCompare(b.p) },
  coverage: {
    dir: (a, b) => pct(a.lh, a.lf) - pct(b.lh, b.lf) || a.seg.localeCompare(b.seg),
    file: (a, b) => pct(a.lh, a.lf) - pct(b.lh, b.lf) || a.p.localeCompare(b.p),
  },
};
const collapsed = new Set();   // folder paths that are collapsed
const openFiles = new Set();   // file paths whose source is shown
const list = document.getElementById("list");

function bar(p) {
  const r = rank(p);
  return '<span class="bar"><i style="width:' + p + '%;background:' + col(r) + '"></i></span>';
}
function rowEnd(lh, lf) {
  const p = pct(lh, lf);
  return '<span class="counts num">' + lh + "/" + lf + '</span>' +
    bar(p) +
    '<span class="pct num">' + fmt(p) + '%</span>';
}

function fileRow(f, depth, prefix) {
  const open = openFiles.has(f.p);
  const base = f.p.split("/").pop();
  const label = prefix
    ? '<span class="dir-prefix">' + esc(prefix) + '/</span>' + esc(base)
    : esc(base);
  const el = document.createElement("div");
  el.innerHTML =
    '<div class="row file" data-file="' + esc(f.p) + '" style="padding-left:' + (depth * 20 + 12) + 'px">' +
      '<span class="name">' + chevSvg + fileSvg + '<span class="label mono">' + label + '</span></span>' +
      rowEnd(f.lh, f.lf) +
    '</div>';
  const rowEl = el.firstChild;
  if (open) rowEl.querySelector(".chev").classList.add("open");
  const frag = document.createDocumentFragment();
  frag.appendChild(rowEl);
  if (open) frag.appendChild(sourceEl(f));
  return frag;
}

function sourceEl(f) {
  const wrap = document.createElement("div");
  wrap.className = "src";
  let rows = "";
  for (let i = 0; i < f.src.length; i++) {
    const [text, h] = f.src[i];
    const cls = h === null ? "" : h === 0 ? "miss" : "hit";
    const hc = h === null ? "" : h + "×";
    rows += '<tr class="' + cls + '"><td class="ln num">' + (i + 1) + '</td><td class="hc num">' + hc + '</td><td class="code">' + (esc(text) || "&nbsp;") + '</td></tr>';
  }
  wrap.innerHTML = "<table>" + rows + "</table>";
  return wrap;
}

function dirRow(node, depth) {
  const p = pct(node.lh, node.lf);
  const open = !collapsed.has(node.path);
  const el = document.createElement("div");
  el.innerHTML =
    '<div class="row dir" data-dir="' + esc(node.path) + '" style="padding-left:' + (depth * 20 + 12) + 'px">' +
      '<span class="name">' + chevSvg + folderSvg + '<span class="label">' + esc(node.seg) + '</span></span>' +
      rowEnd(node.lh, node.lf) +
    '</div>';
  const rowEl = el.firstChild;
  if (open) rowEl.querySelector(".chev").classList.add("open");
  return rowEl;
}

function matches(f) { return !filter || f.p.toLowerCase().includes(filter); }

function renderTree(node, depth, out) {
  const kids = [...node.kids.values()].sort(cmp[sort].dir);
  for (const k of kids) {
    const visibleFiles = collectFiles(k).filter(matches);
    if (filter && visibleFiles.length === 0) continue;
    out.appendChild(dirRow(k, depth));
    const open = !collapsed.has(k.path) || (filter && visibleFiles.length > 0);
    if (open) renderTree(k, depth + 1, out);
  }
  const nodeFiles = node.files.filter(matches).sort(cmp[sort].file);
  for (const f of nodeFiles) out.appendChild(fileRow(f, depth, ""));
}

function collectFiles(node) {
  let acc = [...node.files];
  for (const [, k] of node.kids) acc = acc.concat(collectFiles(k));
  return acc;
}

function renderFlat(out) {
  const fs = D.files.filter(matches).slice().sort(cmp[sort].file);
  for (const f of fs) {
    const parts = f.p.split("/");
    out.appendChild(fileRow(f, 0, parts.slice(0, -1).join("/")));
  }
}

function render() {
  const out = document.createDocumentFragment();
  if (view === "tree") renderTree(tree, 0, out);
  else renderFlat(out);
  list.replaceChildren(out);
  const shown = list.querySelector(".row");
  document.getElementById("empty").hidden = !!shown;
  document.getElementById("term").textContent = filter;
}

// ---- interactions ----
list.addEventListener("click", (e) => {
  const row = e.target.closest(".row");
  if (!row) return;
  if (row.dataset.dir !== undefined) {
    const p = row.dataset.dir;
    if (collapsed.has(p)) collapsed.delete(p); else collapsed.add(p);
    render();
  } else if (row.dataset.file !== undefined) {
    const p = row.dataset.file;
    if (openFiles.has(p)) openFiles.delete(p); else openFiles.add(p);
    render();
  }
});

function setView(v) {
  view = v;
  document.getElementById("vtree").setAttribute("aria-pressed", v === "tree");
  document.getElementById("vflat").setAttribute("aria-pressed", v === "flat");
  document.getElementById("toggleAll").style.visibility = v === "tree" ? "visible" : "hidden";
  render();
}
document.getElementById("vtree").onclick = () => setView("tree");
document.getElementById("vflat").onclick = () => setView("flat");

function setSort(s) {
  sort = s;
  document.getElementById("sname").setAttribute("aria-pressed", s === "name");
  document.getElementById("scov").setAttribute("aria-pressed", s === "coverage");
  render();
}
document.getElementById("sname").onclick = () => setSort("name");
document.getElementById("scov").onclick = () => setSort("coverage");

const allDirPaths = () => { const s = []; (function walk(n){ for (const [,k] of n.kids){ s.push(k.path); walk(k); } })(tree); return s; };
document.getElementById("toggleAll").onclick = (e) => {
  if (collapsed.size === 0) { for (const p of allDirPaths()) collapsed.add(p); e.target.textContent = "Expand all"; }
  else { collapsed.clear(); e.target.textContent = "Collapse all"; }
  render();
};

let t;
document.getElementById("q").addEventListener("input", (e) => {
  clearTimeout(t);
  t = setTimeout(() => { filter = e.target.value.trim().toLowerCase(); render(); }, 80);
});

render();
</script>
</body>
</html>`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html);
console.log(
  `[coverage] ${fmt(pctv(totals.lh, totals.lf))}% lines, ${fmt(pctv(totals.fnh, totals.fnf))}% functions across ${files.length} files -> ${outPath}`,
);

function pctv(h: number, t: number): number {
  return t === 0 ? 100 : (h / t) * 100;
}
function fmt(p: number): string {
  return Number.isInteger(p) ? `${p}` : p.toFixed(1);
}
