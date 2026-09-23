import { format } from "node:util";

/**
 * In-memory ring buffer of everything the process logs through `console`.
 *
 * Imported first in server.js so the patch is in place before any other
 * module logs. The lines still go to stdout/stderr as before (Docker/Render
 * keep collecting them); this only adds a copy that GET /logs can serve, so
 * an operator can read recent output from a browser without shelling into
 * the host.
 */

const MAX_LINES = Number(process.env.LOG_BUFFER_LINES) || 2000;
const MAX_LINE_LENGTH = 4000;

/** @type {Array<{ ts: string, level: 'error'|'warn'|'info'|'debug', msg: string }>} */
const lines = [];
let dropped = 0;

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function push(level, args) {
  let msg;
  try {
    msg = format(...args);
  } catch {
    msg = args.map(String).join(" ");
  }
  if (msg.length > MAX_LINE_LENGTH) msg = `${msg.slice(0, MAX_LINE_LENGTH)}… [truncated]`;
  lines.push({ ts: new Date().toISOString(), level, msg });
  if (lines.length > MAX_LINES) {
    lines.splice(0, lines.length - MAX_LINES);
    dropped += 1;
  }
}

const original = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

console.log = (...args) => { push("info", args); original.log(...args); };
console.info = (...args) => { push("info", args); original.info(...args); };
console.warn = (...args) => { push("warn", args); original.warn(...args); };
console.error = (...args) => { push("error", args); original.error(...args); };
console.debug = (...args) => { push("debug", args); original.debug(...args); };

/**
 * @param {{ limit?: number, level?: string, q?: string }} [opts]
 *   level: minimum severity to include (error < warn < info < debug).
 *   q: case-insensitive substring filter.
 */
export function readLogs({ limit = 200, level = "debug", q = "" } = {}) {
  const maxLevel = LEVELS[level] ?? LEVELS.debug;
  const needle = q.toLowerCase();
  const out = [];
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i -= 1) {
    const line = lines[i];
    if (LEVELS[line.level] > maxLevel) continue;
    if (needle && !line.msg.toLowerCase().includes(needle)) continue;
    out.push(line);
  }
  return { lines: out.reverse(), buffered: lines.length, capacity: MAX_LINES, dropped };
}
