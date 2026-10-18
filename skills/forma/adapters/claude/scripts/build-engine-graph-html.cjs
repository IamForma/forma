#!/usr/bin/env node
// Рендер .forma/living/graphs/engine/graph.html из уже собранного graph.json (скелет +
// слой смысла). Тот же шаг graphify.to_html, что у site (build-site-graph.cjs) —
// без модели, без сети: Python-рендерер, вызывается после build-engine-graph.cjs
// и build-engine-meaning.cjs.
//
//   node .claude/scripts/build-engine-graph-html.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, '.forma/living', 'graphs', 'engine');
const GRAPH_FILE = path.join(OUT_DIR, 'graph.json');

function toExtraction(g) {
  return {
    nodes: g.nodes.map((n) => ({
      id: n.id,
      label: n.label || n.id,
      file_type: n.type === 'file' ? 'concept' : 'concept',
      source_file: n.source_file || n.id,
    })),
    edges: g.edges.map((e) => ({
      source: e.source,
      target: e.target,
      relation: e.relation,
      confidence: 'EXTRACTED',
      source_file: 'engine:main',
    })),
  };
}

function graphPythonScript() {
  return `
import json
from pathlib import Path
from graphify.build import build_from_json
from graphify.cluster import cluster
from graphify.export import to_html

out_dir = Path(r"${OUT_DIR.replace(/\\/g, '\\\\')}")
extraction = json.loads((out_dir / ".graphify_extract.json").read_text(encoding="utf-8"))
G = build_from_json(extraction)
if G.number_of_nodes() == 0:
    print("ERROR: Graph is empty")
    raise SystemExit(1)
communities = cluster(G)
labels = {cid: f"Группа: кластер {cid}" for cid in communities}
to_html(G, communities, str(out_dir / "graph.html"), community_labels=labels)
print(f"Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, {len(communities)} communities")
`;
}

function main() {
  if (!fs.existsSync(GRAPH_FILE)) {
    console.error(`Нет ${GRAPH_FILE} — сначала build-engine-graph.cjs (и build-engine-meaning.cjs для описаний).`);
    process.exit(1);
  }
  const g = JSON.parse(fs.readFileSync(GRAPH_FILE, 'utf8'));
  const extractPath = path.join(OUT_DIR, '.graphify_extract.json');
  fs.writeFileSync(extractPath, JSON.stringify(toExtraction(g)), 'utf8');
  const tmpPy = path.join(os.tmpdir(), `engine-graph-html-${process.pid}.py`);
  fs.writeFileSync(tmpPy, graphPythonScript(), 'utf8');
  let out;
  try {
    out = execFileSync('python', [tmpPy], { encoding: 'utf8' });
  } finally {
    fs.unlinkSync(tmpPy);
    fs.existsSync(extractPath) && fs.unlinkSync(extractPath);
  }
  console.log(out.trim());
  console.log(`Записано: ${path.join(OUT_DIR, 'graph.html')}`);
}

if (require.main === module) {
  try { main(); } catch (err) { console.error(String(err && err.message || err)); process.exit(2); }
}

module.exports = { toExtraction };
