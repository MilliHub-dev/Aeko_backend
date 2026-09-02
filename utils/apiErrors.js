/**
 * Consistent, safe API error responses.
 *
 * Two problems this addresses:
 *
 * 1. Route handlers returned `error: error.message` straight to the client.
 *    That leaks internals — a missing-migration failure told the caller
 *    "The column `users.passwordResetTokenHash` does not exist", naming a real
 *    table and column. The global handler in server.js already gated that on
 *    NODE_ENV, but per-route handlers bypassed it.
 *
 * 2. Every failure became `500 "Login failed"`, so a database that is behind on
 *    migrations was indistinguishable from a wrong password. Clients could not
 *    tell "your credentials are wrong" from "the server is broken", and neither
 *    could anyone reading a bug report.
 *
 * Use `sendError(res, error, context)` in a catch block instead of building the
 * response by hand. The full error is always logged server-side.
 */

const isProduction = () => process.env.NODE_ENV === "production";

/**
 * Maps an error to an HTTP status and a message that is safe to show a user.
 *
 * Prisma codes: https://www.prisma.io/docs/reference/api-reference/error-reference
 */
export function classifyError(error) {
  const code = error?.code;

  // Schema drift: the code expects columns the database does not have. This is
  // a deployment fault, not a client fault, so it must not read as a 4xx.
  if (code === "P2021" || code === "P2022") {
    return {
      status: 503,
      code: "SCHEMA_OUT_OF_DATE",
      message:
        "The service is temporarily unavailable while it finishes updating. Please try again shortly.",
      operatorHint:
        "Database is behind on migrations. Run `npm run migrate:deploy`.",
    };
  }

  // Cannot reach or authenticate to the database.
  if (code === "P1000" || code === "P1001" || code === "P1002" || code === "P1017") {
    return {
      status: 503,
      code: "DATABASE_UNAVAILABLE",
      message: "The service is temporarily unavailable. Please try again shortly.",
      operatorHint: "Database unreachable — check DATABASE_URL and the instance.",
    };
  }

  if (code === "P2002") {
    return {
      status: 409,
      code: "ALREADY_EXISTS",
      message: "That value is already in use.",
    };
  }

  if (code === "P2025") {
    return { status: 404, code: "NOT_FOUND", message: "Not found." };
  }

  if (code === "P2003") {
    return {
      status: 400,
      code: "INVALID_REFERENCE",
      message: "That request refers to something that no longer exists.",
    };
  }

  return {
    status: 500,
    code: "INTERNAL_ERROR",
    message: "Something went wrong. Please try again.",
  };
}

/**
 * Logs the real error and sends a safe response.
 *
 * @param {import("express").Response} res
 * @param {unknown} error   the caught error
 * @param {string} context  where it happened, e.g. "auth.login" — appears in logs only
 * @param {{ message?: string }} [options]  override the user-facing message
 */
export function sendError(res, error, context, options = {}) {
  const { status, code, message, operatorHint } = classifyError(error);

  // Full detail stays server-side, always.
  console.error(`[${context}] ${code}:`, error);
  if (operatorHint) console.error(`[${context}] ${operatorHint}`);

  const body = {
    success: false,
    code,
    message: options.message ?? message,
  };

  // Raw messages are for developers on a dev machine, never for production
  // clients.
  if (!isProduction()) {
    body.error = error?.message;
  }

  return res.status(status).json(body);
}

export default { classifyError, sendError };
