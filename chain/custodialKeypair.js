import { createPrivateKey, createPublicKey, hkdfSync, sign } from "crypto";
import { encodeBase58 } from "@aeko-chain/web3.js";

/**
 * Custodial per-user chain keys.
 *
 * The product decision is custodial: the backend signs on the user's behalf, so
 * the mobile client never holds key material. Each user still needs their own
 * on-chain address (a shared service address would pool every user's balance),
 * so keys are DERIVED deterministically from one server-held master secret plus
 * the user id rather than generated and stored per user. Nothing secret is
 * written to the database, and a key can always be re-derived.
 *
 * SECURITY: AEKO_CUSTODY_MASTER_SEED is the single secret protecting every
 * user's funds.
 *   - Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   - Store it in the platform secret manager, never in the repo.
 *   - Rotating it changes every derived address. Funds under the old seed stay
 *     at the old addresses, so a rotation requires an on-chain sweep. Treat it
 *     as permanent.
 *
 * Derivation is HKDF-SHA512 with a fixed info string, so a user id can never
 * collide into another user's key, and the seed cannot be recovered from any
 * derived key.
 */

const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const HKDF_SALT = Buffer.from("aeko-custody-v1");
const HKDF_INFO = "aeko-custody-user-key";

let masterSeed = null;

/**
 * Read lazily rather than at import: routes that never touch the chain should
 * not fail to load because custody is unconfigured in a given environment.
 */
function getMasterSeed() {
  if (masterSeed) return masterSeed;

  const raw = process.env.AEKO_CUSTODY_MASTER_SEED;
  if (!raw) {
    throw new Error(
      "AEKO_CUSTODY_MASTER_SEED is not set. Custodial wallet operations are disabled.",
    );
  }

  const buf = Buffer.from(raw, "hex");
  if (buf.length < 32) {
    throw new Error(
      "AEKO_CUSTODY_MASTER_SEED must be at least 32 bytes of hex (64 hex characters).",
    );
  }

  masterSeed = buf;
  return masterSeed;
}

/** Derives the raw 32-byte ed25519 seed for a user. */
function deriveSeed(userId) {
  if (!userId) throw new Error("A user id is required to derive a custodial key");
  return Buffer.from(
    hkdfSync("sha512", getMasterSeed(), HKDF_SALT, `${HKDF_INFO}:${userId}`, 32),
  );
}

/**
 * Returns a signer for the given user.
 *
 * The shape matches `serviceKeypair` so it drops straight into
 * `sendAndConfirmSigned(connection, preparedTxBase64, signer)`.
 *
 * @param {string} userId
 * @returns {{ publicKey: string, signPreparedTransaction: (tx: string) => string }}
 */
export function getCustodialKeypair(userId) {
  const seed = deriveSeed(userId);

  const privateKey = createPrivateKey({
    key: Buffer.concat([PKCS8_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  });

  // The raw ed25519 public key is the last 32 bytes of the SPKI DER encoding.
  const spki = createPublicKey(privateKey).export({ format: "der", type: "spki" });
  const publicKeyBytes = spki.subarray(spki.length - 32);

  return {
    publicKey: encodeBase58(publicKeyBytes),

    /**
     * Signs a prepared transaction in the first signer slot.
     * Mirrors serviceKeypair.signPreparedTransaction: the transaction is
     * short-vec encoded as [numSigners][signatures...][message].
     */
    signPreparedTransaction(preparedTxBase64) {
      const txBytes = Buffer.from(preparedTxBase64, "base64");

      let pos = 0;
      let numSigners = 0;
      let shift = 0;
      let b;
      do {
        b = txBytes[pos++];
        numSigners |= (b & 0x7f) << shift;
        shift += 7;
      } while (b & 0x80);

      const messageBytes = txBytes.subarray(pos + numSigners * 64);
      const signature = sign(null, messageBytes, privateKey);

      const signed = Buffer.from(txBytes);
      signature.copy(signed, pos);
      return signed.toString("base64");
    },
  };
}

/** The user's custodial address, without constructing a signer for callers that only need it. */
export function getCustodialAddress(userId) {
  return getCustodialKeypair(userId).publicKey;
}

/** Whether custody is configured in this environment. */
export function isCustodyConfigured() {
  return Boolean(process.env.AEKO_CUSTODY_MASTER_SEED);
}

export default { getCustodialKeypair, getCustodialAddress, isCustodyConfigured };
