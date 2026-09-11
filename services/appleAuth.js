import { createHash, createPublicKey, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";

/**
 * Verifies "Sign in with Apple" identity tokens from the native iOS flow.
 *
 * The token is an RS256 JWT signed with one of Apple's rotating keys. It is
 * trusted only when:
 *   - the signature checks against Apple's published key with the token's `kid`,
 *   - `iss` is Apple and `aud` is one of our app's bundle identifiers,
 *   - it has not expired (Apple issues them for about ten minutes), and
 *   - its `nonce` is the SHA-256 of the raw nonce the app generated for this
 *     attempt, so a token captured from another sign-in cannot be replayed.
 *
 * No client secret or Apple private key is involved: that is only needed for
 * the web flow, which exchanges an authorization code server-side.
 */

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys";
const KEY_CACHE_MS = 6 * 60 * 60 * 1000;

// The iOS bundle identifier from aeko-mobile/app.config.js. A native identity
// token's `aud` is the bundle id of the app that requested it. Only list bundle
// ids registered to our own Apple team.
const DEFAULT_AUDIENCES = ["social.aekoapp.aeko"];

export class AppleIdentityTokenError extends Error {
  constructor() {
    super("Invalid Apple identity token");
    this.name = "AppleIdentityTokenError";
  }
}

/** Bundle ids whose tokens are accepted. APPLE_CLIENT_IDS is a comma-separated override. */
export const getAppleAudiences = () => {
  const configured = (process.env.APPLE_CLIENT_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.length > 0 ? [...new Set(configured)] : DEFAULT_AUDIENCES;
};

let cachedKeys = null;
let cachedAt = 0;

async function fetchAppleKeys(forceRefresh = false) {
  if (!forceRefresh && cachedKeys && Date.now() - cachedAt < KEY_CACHE_MS) {
    return cachedKeys;
  }
  const response = await fetch(APPLE_KEYS_URL, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Apple signing keys request failed with ${response.status}`);
  }
  const body = await response.json();
  if (!Array.isArray(body?.keys)) {
    throw new Error("Apple signing keys response was malformed");
  }
  cachedKeys = body.keys;
  cachedAt = Date.now();
  return cachedKeys;
}

const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");

const safeEqual = (a, b) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/**
 * @param {string} identityToken the `identityToken` from expo-apple-authentication
 * @param {{ rawNonce: string, getKeys?: (forceRefresh?: boolean) => Promise<object[]> }} options
 * @returns {Promise<object>} the verified token payload
 * @throws {AppleIdentityTokenError} for any token that should not be trusted
 */
export async function verifyAppleIdentityToken(
  identityToken,
  { rawNonce, getKeys = fetchAppleKeys } = {},
) {
  if (
    typeof identityToken !== "string" ||
    identityToken.trim().length === 0 ||
    identityToken.length > 10_000 ||
    typeof rawNonce !== "string" ||
    rawNonce.length === 0 ||
    rawNonce.length > 256
  ) {
    throw new AppleIdentityTokenError();
  }

  const decoded = jwt.decode(identityToken, { complete: true });
  const kid = decoded?.header?.kid;
  if (!kid || decoded.header.alg !== "RS256") {
    throw new AppleIdentityTokenError();
  }

  // Apple rotates keys; an unknown kid gets one refetch before rejecting.
  let jwk = (await getKeys()).find((key) => key.kid === kid);
  if (!jwk) jwk = (await getKeys(true)).find((key) => key.kid === kid);
  if (!jwk) throw new AppleIdentityTokenError();

  let payload;
  try {
    payload = jwt.verify(identityToken, createPublicKey({ key: jwk, format: "jwk" }), {
      algorithms: ["RS256"],
      issuer: APPLE_ISSUER,
      audience: getAppleAudiences(),
    });
  } catch {
    // The library error can echo token contents; keep it out of the logs.
    console.warn("Apple identity token verification failed");
    throw new AppleIdentityTokenError();
  }

  if (typeof payload.nonce !== "string" || !safeEqual(sha256Hex(rawNonce), payload.nonce)) {
    console.warn("Apple identity token nonce mismatch");
    throw new AppleIdentityTokenError();
  }

  return payload;
}

/**
 * The identity claims we rely on. Apple sends `email` only on the first
 * authorization (later sign-ins carry just `sub`), and it may be a private
 * relay address; `email_verified` arrives as a boolean or the string "true".
 */
export function getVerifiedAppleIdentity(payload) {
  const oauthId = typeof payload?.sub === "string" ? payload.sub.trim() : "";
  if (!oauthId) return null;

  const email =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const emailVerified =
    payload.email_verified === true || payload.email_verified === "true";

  return {
    oauthId,
    email: email && emailVerified ? email : "",
  };
}

export default { verifyAppleIdentityToken, getVerifiedAppleIdentity, getAppleAudiences };
