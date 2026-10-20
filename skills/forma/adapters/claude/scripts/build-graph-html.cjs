#!/usr/bin/env node
// Рендер .forma/living/graphs/<корпус>/graph.html из уже собранного graph.json для графов Kit
// (goals, arsenal, structure, resources, board, central). Тот же шаг graphify.to_html, что у
// engine и site — без модели, без сети: Python-рендерер.
//
//   node .claude/scripts/build-graph-html.cjs            # все шесть
//   node .claude/scripts/build-graph-html.cjs goals board
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const GRAPHS = path.join(ROOT, '.forma/living', 'graphs');
const CORPORA = ['goals', 'arsenal', 'structure', 'resources', 'board', 'manual', 'project', 'central'];

function toExtraction(g, corpus) {
  return {
    nodes: g.nodes.map((n) => ({
      id: n.id,
      label: n.label || n.id,
      file_type: 'concept',
      source_file: n.source_file || n.id,
      node_type: n.type || '',
    })),
    edges: g.edges.map((e) => ({
      source: e.source,
      target: e.target,
      relation: e.relation,
      confidence: 'EXTRACTED',
      source_file: e.source_file || `${corpus}:main`,
    })),
  };
}

const PY = `
import json, sys
from collections import Counter
from pathlib import Path
from graphify.build import build_from_json
from graphify.cluster import cluster
from graphify.export import to_html

out_dir = Path(sys.argv[1])
extraction = json.loads((out_dir / ".graphify_extract.json").read_text(encoding="utf-8"))
types = {n["id"]: n.get("node_type", "") for n in extraction["nodes"]}
G = build_from_json(extraction)
if G.number_of_nodes() == 0:
    print("ERROR: Graph is empty")
    raise SystemExit(1)
communities = cluster(G)
labels = {}
for cid, members in communities.items():
    top = Counter(types.get(m, "") for m in members).most_common(1)
    labels[cid] = f"Группа {cid}: {top[0][0]}" if top and top[0][0] else f"Группа {cid}"
to_html(G, communities, str(out_dir / "graph.html"), community_labels=labels)
print(f"Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, {len(communities)} communities")
`;

function render(corpus, tmpPy) {
  const dir = path.join(GRAPHS, corpus);
  const file = path.join(dir, 'graph.json');
  if (!fs.existsSync(file)) throw new Error(`Нет ${file} — сначала build-kit-graphs.cjs --only ${corpus}`);
  const extract = path.join(dir, '.graphify_extract.json');
  fs.writeFileSync(extract, JSON.stringify(toExtraction(JSON.parse(fs.readFileSync(file, 'utf8')), corpus)), 'utf8');
  try {
    return execFileSync('python', [tmpPy, dir], { encoding: 'utf8' }).trim();
  } finally {
    fs.existsSync(extract) && fs.unlinkSync(extract);
  }
}

function main(argv = process.argv.slice(2)) {
  const wanted = argv;
  const list = wanted.length ? wanted : CORPORA;
  const bad = list.filter((c) => !CORPORA.includes(c));
  if (bad.length) throw new Error(`Неизвестный корпус: ${bad.join(', ')}. Допустимы: ${CORPORA.join(', ')}`);
  const tmpPy = path.join(os.tmpdir(), `kit-graph-html-${process.pid}.py`);
  fs.writeFileSync(tmpPy, PY, 'utf8');
  try {
    for (const c of list) console.log(`${c}: ${render(c, tmpPy)}`);
  } finally {
    fs.unlinkSync(tmpPy);
  }
}

if (require.main === module) {
  try { main(); } catch (err) { console.error(String(err && err.message || err)); process.exit(2); }
}

module.exports = { toExtraction, main, CORPORA };
