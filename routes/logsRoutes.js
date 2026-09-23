import express from "express";
import { readLogs } from "../utils/logBuffer.js";

const router = express.Router();

/**
 * @swagger
 * /logs:
 *   get:
 *     tags: [Admin]
 *     summary: Recent server log lines (admin only)
 *     description: |
 *       The last lines the process wrote to the console, from an in-memory
 *       buffer (LOG_BUFFER_LINES, default 2000). Plain text by default so it
 *       reads in a browser; `format=json` for tooling.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lines
 *         schema: { type: integer, default: 200, maximum: 2000 }
 *       - in: query
 *         name: level
 *         schema: { type: string, enum: [error, warn, info, debug], default: debug }
 *         description: Minimum severity to include
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Case-insensitive substring filter
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [text, json], default: text }
 *     responses:
 *       200:
 *         description: Log lines
 *       401:
 *         description: Admin token required
 */
router.get("/", (req, res) => {
  const limit = Math.min(2000, Math.max(1, Number.parseInt(req.query.lines, 10) || 200));
  const level = ["error", "warn", "info", "debug"].includes(req.query.level) ? req.query.level : "debug";
  const q = typeof req.query.q === "string" ? req.query.q.slice(0, 200) : "";
  const result = readLogs({ limit, level, q });

  if (req.query.format === "json") {
    return res.json({ success: true, ...result });
  }

  res.set("Cache-Control", "no-store");
  res.type("text/plain; charset=utf-8");
  const header = `# ${result.lines.length} of ${result.buffered} buffered lines (capacity ${result.capacity}); level>=${level}${q ? `; q="${q}"` : ""}\n`;
  res.send(
    header + result.lines.map((l) => `${l.ts} ${l.level.toUpperCase().padEnd(5)} ${l.msg}`).join("\n") + "\n",
  );
});

export default router;
