// Local transaction builder for multi-instruction txs.
// The SDK only exports single-action builders; complex atomic txs (e.g. marketplace buy)
// require composing multiple instructions — replicated here from builders.js internals.
import { decodeBase58 } from "@aeko-chain/web3.js";

const SYSTEM_PROGRAM = new Uint8Array(32); // [0u8; 32]

function encodeU32(v) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, v, true);
  return b;
}
function encodeU64(v) {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(v), true);
  return b;
}
function encodeShortVec(v) {
  const bytes = [];
  let r = v >>> 0;
  do {
    let next = r & 0x7f;
    r >>>= 7;
    if (r > 0) next |= 0x80;
    bytes.push(next);
  } while (r > 0);
  return Uint8Array.from(bytes);
}
function concatBytes(...parts) {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out  = new Uint8Array(len);
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}
function encodeBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

function buildLegacyMessage(payer, recentBlockhash, instructions) {
  const payerBytes     = decodeBase58(payer);
  const blockhashBytes = decodeBase58(recentBlockhash);

  const metas = new Map();
  const track = (pubkey, isSigner, isWritable) => {
    const key = Array.from(pubkey).join(",");
    const cur = metas.get(key);
    if (cur) { cur.isSigner ||= isSigner; cur.isWritable ||= isWritable; return; }
    metas.set(key, { pubkey, isSigner, isWritable });
  };

  track(payerBytes, true, true);
  for (const ix of instructions) {
    for (const acc of ix.accounts) track(acc.pubkey, acc.isSigner, acc.isWritable);
    track(ix.programId, false, false);
  }

  const payerKey = Array.from(payerBytes).join(",");
  const payerMeta = metas.get(payerKey);
  metas.delete(payerKey);
  const rest = Array.from(metas.values());
  const ordered = [
    payerMeta,
    ...rest.filter(m => m.isSigner && m.isWritable),
    ...rest.filter(m => m.isSigner && !m.isWritable),
    ...rest.filter(m => !m.isSigner && m.isWritable),
    ...rest.filter(m => !m.isSigner && !m.isWritable),
  ].filter(Boolean);

  const idx = new Map(ordered.map((m, i) => [Array.from(m.pubkey).join(","), i]));
  const numSigners    = ordered.filter(m => m.isSigner).length;
  const numReadonly   = ordered.filter(m => !m.isWritable).length;
  const numSignedRO   = ordered.filter(m => m.isSigner && !m.isWritable).length;

  const header = Uint8Array.from([numSigners, numReadonly, numSignedRO]);

  const compiledIxs = instructions.map(ix =>
    concatBytes(
      Uint8Array.from([idx.get(Array.from(ix.programId).join(",")) ?? 0]),
      encodeShortVec(ix.accounts.length),
      Uint8Array.from(ix.accounts.map(a => idx.get(Array.from(a.pubkey).join(",")) ?? 0)),
      encodeShortVec(ix.data.length),
      ix.data,
    )
  );

  const messageBytes = concatBytes(
    header,
    encodeShortVec(ordered.length),
    ...ordered.map(m => m.pubkey),
    blockhashBytes,
    encodeShortVec(compiledIxs.length),
    ...compiledIxs,
  );

  return { messageBytes, numSigners };
}

// Build a base64 "prepared transaction" from multiple instructions
export function buildPreparedMultiInstructionTransaction({ payer, recentBlockhash, instructions }) {
  const { messageBytes, numSigners } = buildLegacyMessage(payer, recentBlockhash, instructions);
  const sigSection = concatBytes(
    encodeShortVec(numSigners),
    ...Array.from({ length: numSigners }, () => new Uint8Array(64)),
  );
  return encodeBase64(concatBytes(sigSection, messageBytes));
}

// System Program transfer instruction (variant 2)
export function buildSystemTransferInstruction(from, to, lamports) {
  return {
    programId: SYSTEM_PROGRAM,
    accounts: [
      { pubkey: decodeBase58(from), isSigner: true,  isWritable: true  },
      { pubkey: decodeBase58(to),   isSigner: false, isWritable: true  },
    ],
    data: concatBytes(encodeU32(2), encodeU64(lamports)),
  };
}
