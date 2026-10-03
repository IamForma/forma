#!/usr/bin/env node
// grill-with-ui server. Plain Node, no dependencies, no build step.
//
//   new      --topic T [--doc P]                    create a session folder under GRILL_HOME, print {session,key,project,id,doc}
//   serve    --session DIR [--port N]               serve the page; append each Send to events.jsonl AND print the same
//                                                   line to stdout (this process is the agent's watcher command).
//                                                   Without --port it retries the port it used last time, then falls
//                                                   back to an ephemeral one, so an open tab survives a restart.
//   sessions [--all]                                list this project's sessions (newest first; --all adds finished ones)
//   pending  --session DIR                          print every Send past agent.handled (replay on resume)
//   wait     --session DIR [--after N] [--timeout S] block until a Send newer than seq N lands, print it, exit 0
//                                                   (exit 3 on timeout) — for agents without a background watcher
//   url      --session DIR [--timeout S]            print the running server's url (from server.json)
//
// Files (per session folder): state.json  — written only by the agent
//                             events.jsonl — appended only by this server, one line per Send
//                             server.json  — url, port, pid of the running server
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOME = process.env.GRILL_HOME || path.join(os.homedir(), ".grill-with-ui");

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { o._.push(a); continue; }
    const k = a.slice(2), v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) o[k] = true; else { o[k] = v; i++; }
  }
  return o;
}
const print = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");
const die = (msg, code = 2) => { process.stderr.write(`grill: ${msg}\n`); process.exit(code); };
// Порт прошлого запуска и проверка живости pid — общий с дашбордом модуль сессий интервью
// (.forma/dashboard/lib/interview-sessions.cjs): одна копия, а не две. Путь от движка не зависит: скилл лежит на
// разной глубине (ядро — .forma/skills/<имя>/, доставленная копия — <каталог движка>/.forma/skills/<имя>/), поэтому модуль
// ищется вверх от этого файла, пока не встретится .forma/dashboard/lib/. Нужен только командам serve и url — остальные его не грузят.
let sharedSessions = null;
function shared() {
  if (sharedSessions) return sharedSessions;
  for (let dir = HERE; ; dir = path.dirname(dir)) {
    const file = path.join(dir, ".forma/dashboard", "lib", "interview-sessions.cjs");
    if (fs.existsSync(file)) return (sharedSessions = createRequire(import.meta.url)(file));
    if (path.dirname(dir) === dir) die(`.forma/dashboard/lib/interview-sessions.cjs not found above ${HERE} — the skill runs inside a project with the Forma .forma/dashboard`);
  }
}
function writeJson(file, obj) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n");
  fs.renameSync(tmp, file);
}
function mustSession(o) {
  if (!o.session || o.session === true) die("--session <dir> is required");
  const dir = path.resolve(o.session);
  if (!fs.existsSync(dir)) die(`no such session folder: ${dir}`);
  return dir;
}

// ---- session key: git common root (all worktrees share it), cwd outside git ----
function projectRoot(cwd) {
  try {
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return fs.realpathSync(path.dirname(common));
  } catch { return fs.realpathSync(cwd); }
}
const keyOf = (root) => root.replace(/^[\\/]+/, "").replace(/[\\/:]+/g, "-");
function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function cmdNew(o) {
  const project = projectRoot(process.cwd());
  const key = keyOf(project);
  const dir = path.join(HOME, "sessions", key);
  fs.mkdirSync(dir, { recursive: true });
  const id = stamp();
  let session = path.join(dir, id);
  for (let n = 2; fs.existsSync(session); n++) session = path.join(dir, `${id}-${n}`);
  fs.mkdirSync(session);
  const now = new Date().toISOString();
  writeJson(path.join(session, "state.json"), {
    topic: typeof o.topic === "string" ? o.topic : "", doc: typeof o.doc === "string" ? o.doc : "",
    project, created: now, agent: { status: "working", since: now }, terms: [], questions: [],
  });
  fs.writeFileSync(path.join(session, "events.jsonl"), "");
  print({ session, key, project, id: path.basename(session), doc: typeof o.doc === "string" ? o.doc : "" });
}

// ---- events.jsonl helpers ----
function readEvents(file) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { out.push({ line, ev: JSON.parse(line) }); } catch { /* partial or corrupt line: skip */ }
  }
  return out;
}
const lastSeq = (file) => readEvents(file).reduce((m, { ev }) => Math.max(m, Number(ev.seq) || 0), 0);
function readState(session) {
  try { return JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8")); } catch { return null; }
}
const isOpen = (q) => q.status === "open" || q.status === "reopened";

// ---- sessions (for resume) ----
function cmdSessions(o) {
  const dir = path.join(HOME, "sessions", keyOf(projectRoot(process.cwd())));
  if (!fs.existsSync(dir)) return;
  const rows = [];
  for (const id of fs.readdirSync(dir)) {
    const session = path.join(dir, id);
    const st = readState(session);
    if (!st) continue;
    const qs = Array.isArray(st.questions) ? st.questions : [];
    rows.push({
      session, id, topic: st.topic || "", created: st.created || "", finished: st.finished || null,
      open: qs.filter(isOpen).length, answered: qs.filter((q) => q.status === "answered").length,
      handled: Number(st.agent && st.agent.handled) || 0, lastSeq: lastSeq(path.join(session, "events.jsonl")),
    });
  }
  rows.sort((a, b) => (b.created < a.created ? -1 : b.created > a.created ? 1 : b.id.localeCompare(a.id)));
  for (const r of rows) if (o.all || !r.finished) print(r);
}

// ---- pending (replay on resume) ----
function cmdPending(o) {
  const session = mustSession(o);
  const st = readState(session);
  const handled = Number(st && st.agent && st.agent.handled) || 0;
  for (const { line, ev } of readEvents(path.join(session, "events.jsonl"))) {
    if ((Number(ev.seq) || 0) > handled) process.stdout.write(line + "\n");
  }
}

// ---- serve ----
const MAX_UPLOAD = 10 * 1024 * 1024;   // потолок на один файл; выше — это уже не референс, а выгрузка

const send = (res, code, body, type) => { res.writeHead(code, { "content-type": type, "cache-control": "no-store" }); res.end(body); };
const json = (res, code, obj) => send(res, code, JSON.stringify(obj), "application/json");
const readBody = (req) => new Promise((resolve) => { let b = ""; req.on("data", (c) => { b += c; }); req.on("end", () => resolve(b)); });
const readBytes = (req) => new Promise((resolve, reject) => {
  const chunks = []; let n = 0;
  req.on("data", (c) => {
    n += c.length;
    if (n > MAX_UPLOAD) { reject(new Error("file too large")); req.destroy(); return; }
    chunks.push(c);
  });
  req.on("end", () => resolve(Buffer.concat(chunks)));
  req.on("error", reject);
});
// Имя приходит от человека и уходит в файловую систему: всё, что может увести из
// папки сессии, обрезается. Расширение сохраняется — по нему потом видно, что это.
const safeName = (name) => {
  const base = String(name || "file").split(/[\/]/).pop().replace(/[ -<>:"|?*]/g, "").trim();
  return (base && base !== "." && base !== ".." ? base : "file").slice(0, 120);
};

// Один и тот же файл могут прислать дважды; второй не затирает первый молча.
function freeName(dir, name) {
  const ext = path.extname(name); const stem = name.slice(0, name.length - ext.length);
  let i = 1; while (fs.existsSync(path.join(dir, name))) name = `${stem}-${++i}${ext}`;
  return name;
}

// Одна сессия: её файлы и счётчик событий. Сервер — отдельный процесс, состояние живёт в ctx.
function sessionContext(session) {
  const events = path.join(session, "events.jsonl");
  return { session, events, stateFile: path.join(session, "state.json"), page: path.join(HERE, "page.html"), seq: lastSeq(events), lastGoodState: null };
}

// Событие Send: строка в events.jsonl и та же строка в stdout — она будит агента.
function recordSend(ctx, actions) {
  const line = JSON.stringify({ type: "send", seq: ++ctx.seq, at: new Date().toISOString(), session: ctx.session, actions });
  fs.appendFileSync(ctx.events, line + "\n");
  process.stdout.write(line + "\n");
  return ctx.seq;
}

function serveState(ctx, res) {
  // The agent rewrites state.json whole; if we catch it mid-write, serve the last parse that worked.
  try { const raw = fs.readFileSync(ctx.stateFile, "utf8"); JSON.parse(raw); ctx.lastGoodState = raw; } catch { /* keep lastGoodState */ }
  if (ctx.lastGoodState === null) return json(res, 404, { error: "no state" });
  return send(res, 200, ctx.lastGoodState, "application/json");
}

function serveVisual(ctx, res) {
  const visual = path.join(ctx.session, "visual.html"); // written only by the agent; shown by the page in a sandboxed iframe
  if (!fs.existsSync(visual)) return json(res, 404, { error: "no visual" });
  return send(res, 200, fs.readFileSync(visual), "text/html; charset=utf-8");
}

async function handleUpload(ctx, req, res) {
  const u = new URL(req.url, "http://x").searchParams;
  let buf;
  try { buf = await readBytes(req); } catch (e) { return json(res, 413, { error: e.message }); }
  if (!buf.length) return json(res, 400, { error: "empty file" });
  const dir = path.join(ctx.session, "uploads");
  fs.mkdirSync(dir, { recursive: true });
  const name = freeName(dir, safeName(u.get("name")));
  fs.writeFileSync(path.join(dir, name), buf);
  const action = { type: "upload", file: name, bytes: buf.length };
  const q = u.get("q"); if (q) action.q = q;
  const note = u.get("note"); if (note) action.note = note;
  return json(res, 200, { ok: true, seq: recordSend(ctx, [action]), file: name });   // загрузка будит агента так же, как ответ
}

async function handleSend(ctx, req, res) {
  let parsed;
  try { parsed = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: "body must be JSON" }); }
  if (!parsed || !Array.isArray(parsed.actions) || parsed.actions.length === 0) return json(res, 400, { error: "actions must be a non-empty array" });
  return json(res, 200, { ok: true, seq: recordSend(ctx, parsed.actions) });
}

async function route(ctx, req, res) {
  const { pathname } = new URL(req.url, "http://x");
  const get = req.method === "GET", post = req.method === "POST";
  if (get && pathname === "/") return send(res, 200, fs.readFileSync(ctx.page), "text/html; charset=utf-8");
  if (get && pathname === "/state") return serveState(ctx, res);
  if (get && pathname === "/events") return send(res, 200, fs.existsSync(ctx.events) ? fs.readFileSync(ctx.events) : "", "application/x-ndjson");
  if (get && pathname === "/visual") return serveVisual(ctx, res);
  if (post && pathname === "/upload") return handleUpload(ctx, req, res);
  if (post && pathname === "/send") return handleSend(ctx, req, res);
  json(res, 404, { error: "not found" });
}

// Port choice: an explicit --port wins; otherwise retry last time's port (so an open tab
// just resumes polling after a restart) and fall back to ephemeral if it is taken.
function listen(srv, o, serverFile, session) {
  const explicit = o.port !== undefined && o.port !== true;
  let attempt = explicit ? Number(o.port) : shared().rememberedPort(serverFile);
  srv.on("error", (e) => {
    if (!srv.listening && !explicit && attempt !== 0 && e.code === "EADDRINUSE") { attempt = 0; srv.listen(0, "127.0.0.1"); return; }
    die(`server error: ${e.message}`, 1);
  });
  srv.on("listening", () => {
    const { port } = srv.address();
    const url = `http://127.0.0.1:${port}/`;
    writeJson(serverFile, { url, port, pid: process.pid, started: new Date().toISOString() });
    print({ type: "ready", url, session });
  });
  srv.listen(attempt, "127.0.0.1");
}

function cmdServe(o) {
  const session = mustSession(o);
  const ctx = sessionContext(session);
  listen(http.createServer((req, res) => route(ctx, req, res)), o, path.join(session, "server.json"), session);
  // server.json stays on exit on purpose: it remembers the port for the next serve, and
  // `url` checks the pid before trusting it.
  const bye = () => process.exit(0);
  process.on("SIGINT", bye); process.on("SIGTERM", bye); process.on("SIGHUP", bye);
}

// ---- wait (blocking, for agents without a background watcher) ----
function cmdWait(o) {
  const session = mustSession(o);
  const events = path.join(session, "events.jsonl");
  const after = o.after !== undefined && o.after !== true ? Number(o.after) : lastSeq(events);
  const deadline = Date.now() + Number(o.timeout !== undefined && o.timeout !== true ? o.timeout : 480) * 1000;
  const tick = () => {
    for (const { line, ev } of readEvents(events)) {
      if ((Number(ev.seq) || 0) > after) { process.stdout.write(line + "\n"); process.exit(0); }
    }
    if (Date.now() >= deadline) process.exit(3);
    setTimeout(tick, 250);
  };
  tick();
}

// ---- url ----
function cmdUrl(o) {
  const session = mustSession(o);
  const serverFile = path.join(session, "server.json");
  const deadline = Date.now() + Number(o.timeout !== undefined && o.timeout !== true ? o.timeout : 5) * 1000;
  const tick = () => {
    try {
      const { url, pid } = JSON.parse(fs.readFileSync(serverFile, "utf8"));
      if (url && (!pid || shared().alive(pid))) { process.stdout.write(url + "\n"); process.exit(0); }
    } catch { /* not there yet */ }
    if (Date.now() >= deadline) die(`no running server for ${session}`, 1);
    setTimeout(tick, 100);
  };
  tick();
}

const o = parseArgs(process.argv.slice(2));
({ new: cmdNew, serve: cmdServe, sessions: cmdSessions, pending: cmdPending, wait: cmdWait, url: cmdUrl }[o._[0]]
  || (() => die("usage: server.mjs new|serve|sessions|pending|wait|url [--session DIR] ...")))(o);
