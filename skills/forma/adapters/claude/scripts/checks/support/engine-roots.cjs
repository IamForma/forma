'use strict';

// Where the engines live, asked of their adapters (`.forma/dashboard/lib/engines.cjs`), never written down here.
// The checks and the role generator take folder names from this module: an engine folder added or removed
// changes the answer, not the checks.

const fs = require('fs');
const path = require('path');
const engines = require('../../../../.forma/dashboard/lib/engines.cjs');

const REPO = path.resolve(__dirname, '../../../..');
// The engine folder this module itself sits in (first path segment under the project root): the "own" engine.
const OWN_DIR = path.relative(REPO, __dirname).split(path.sep)[0];

/** Every adapter of the project with its resolved sources: [{ adapter, id, dir, src }]. */
function list(root) {
  return engines.loadAdapters(root).map((adapter) => ({
    adapter, id: engines.idOf(adapter), dir: adapter.dir, src: engines.sourcesOf(adapter),
  }));
}

/** The adapter whose folder holds these checks; null when the project has no adapter there. */
function own(root) {
  return list(root).find((e) => e.dir === OWN_DIR) || null;
}

/** An adapter by engine id, tag or folder name; null when absent. */
function find(root, key) {
  return list(root).find((e) => e.id === key || e.adapter.engine === key || e.dir === key) || null;
}

/** Adapters other than the own one that declare a role folder or have one on disk — the engines whose roles can be compared. */
function peers(root) {
  const me = own(root);
  return list(root).filter((e) => (!me || e.dir !== me.dir) && e.src.rolesDir && (declaresRoles(e) || fs.existsSync(path.join(root, e.src.rolesDir))));
}

const declaresRoles = (e) => Boolean((e.adapter.sources && e.adapter.sources.rolesDir) || e.adapter.rolesDir);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { list, own, find, peers, escapeRe, OWN_DIR };
