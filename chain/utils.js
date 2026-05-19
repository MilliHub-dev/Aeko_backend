import { createHash } from "crypto";
import { encodeBase58, decodeBase58 } from "@aeko-chain/web3.js";
import { sha256Bytes } from "@aeko-chain/sdk";
import { sendAndConfirmTransaction } from "@aeko-chain/web3.js";

export const lamportsToAeko = (lamports) => lamports / 1_000_000_000;
export const aekoToLamports = (aeko)     => Math.floor(aeko * 1_000_000_000);

export const sha256Hex = (content) =>
  createHash("sha256").update(typeof content === "string" ? content : Buffer.from(content)).digest("hex");

export const hexToBytes = (hex)   => Uint8Array.from(Buffer.from(hex.replace(/^0x/i, ""), "hex"));
export const bytesToHex = (bytes) => Buffer.from(bytes).toString("hex");

// Hash any string to a 32-byte base58 value (required by buildPreparedAnchorPostTransaction)
export const toBase58Hash = (str) => encodeBase58(sha256Bytes(String(str)));

// Derive a seeded account address — mirrors Solana's PublicKey.createWithSeed
export function deriveWithSeed(basePubkey, seed, programId) {
  return encodeBase58(
    createHash("sha256")
      .update(Buffer.from(decodeBase58(basePubkey)))
      .update(Buffer.from(seed, "utf8"))
      .update(Buffer.from(decodeBase58(programId)))
      .digest()
  );
}

// Sign a prepared transaction with a signer object and send+confirm
export async function sendAndConfirmSigned(connection, preparedTxBase64, signer) {
  const signedTx = signer.signPreparedTransaction(preparedTxBase64);
  const result   = await sendAndConfirmTransaction(connection, signedTx);
  if (result.err) throw new Error(`Transaction failed: ${JSON.stringify(result.err)}`);
  return result.signature;
}

// Fetch minimum lamports for rent exemption for a given byte size
export async function getMinBalanceForRentExemption(connection, bytes) {
  return connection.rpc("getMinimumBalanceForRentExemption", [bytes]);
}
