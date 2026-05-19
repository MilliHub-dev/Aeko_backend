import { createPrivateKey, sign } from "crypto";
import { encodeBase58 } from "@aeko-chain/web3.js";

const raw = process.env.AEKO_SERVICE_KEYPAIR;
if (!raw) throw new Error("AEKO_SERVICE_KEYPAIR env var is not set");

const bytes     = Uint8Array.from(JSON.parse(raw));
const seed      = bytes.slice(0, 32);
const pubBytes  = bytes.slice(32, 64);

const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const privateKey   = createPrivateKey({
  key:    Buffer.concat([PKCS8_PREFIX, Buffer.from(seed)]),
  format: "der",
  type:   "pkcs8",
});

export const serviceKeypair = {
  publicKey: encodeBase58(pubBytes),

  signPreparedTransaction(preparedTxBase64) {
    const txBytes = Buffer.from(preparedTxBase64, "base64");

    // Parse short-vec encoded numSigners at start of tx
    let pos = 0, numSigners = 0, shift = 0, b;
    do {
      b = txBytes[pos++];
      numSigners |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80);

    const messageBytes = txBytes.slice(pos + numSigners * 64);
    const signature    = sign(null, messageBytes, privateKey);

    const signed = Buffer.from(txBytes);
    signature.copy(signed, pos); // fill first signer slot
    return signed.toString("base64");
  },
};
