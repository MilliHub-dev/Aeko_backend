// Local transaction builder for multi-instruction txs.
// The SDK only exports single-action builders; complex atomic txs (e.g. marketplace buy)
// require composing multiple instructions — replicated here from builders.js internals.
import { decodeBase58, encodeBase58 } from "@aeko-chain/web3.js";

const SYSTEM_PROGRAM = new Uint8Array(32); // [0u8; 32]
// Native program ids, as declared in aeko-chain programs/{token-721,nft-marketplace}.
const TOKEN_721_PROGRAM   = new Uint8Array(32).fill(10); // [10u8; 32]
const NFT_MARKETPLACE_PROGRAM = new Uint8Array(32).fill(11); // [11u8; 32]

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
  // Legacy message header is exactly:
  //   [numRequiredSignatures, numReadonlySignedAccounts, numReadonlyUnsignedAccounts]
  //
  // This emitted [numSigners, <all readonly>, <readonly signed>] — the wrong
  // value in slot 2 and the wrong order for slots 2 and 3. For a plain transfer
  // it produced [1, 1, 0] instead of [1, 0, 1], telling the validator the second
  // account was a read-only *signer* while the account flags said otherwise. The
  // chain rejected every such transaction with "Transaction failed to sanitize
  // accounts offsets correctly", which took down transfers, withdrawals, NFT
  // mints and every marketplace action that goes through this builder.
  const numSigners    = ordered.filter(m => m.isSigner).length;
  const numSignedRO   = ordered.filter(m => m.isSigner && !m.isWritable).length;
  const numUnsignedRO = ordered.filter(m => !m.isSigner && !m.isWritable).length;

  const header = Uint8Array.from([numSigners, numSignedRO, numUnsignedRO]);

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

  // Signer slots are filled in this order; a multi-signer transaction needs
  // to know which slot belongs to whom.
  const signers = ordered.filter(m => m.isSigner).map(m => encodeBase58(m.pubkey));

  return { messageBytes, numSigners, signers };
}

// Build a base64 "prepared transaction" from multiple instructions
export function buildPreparedMultiInstructionTransaction({ payer, recentBlockhash, instructions }) {
  return buildPreparedTransactionWithSigners({ payer, recentBlockhash, instructions }).txBase64;
}

/**
 * Same as above, but also reports the signer order of the message so every
 * required signature can be filled (see signPreparedTransaction).
 */
export function buildPreparedTransactionWithSigners({ payer, recentBlockhash, instructions }) {
  const { messageBytes, numSigners, signers } = buildLegacyMessage(payer, recentBlockhash, instructions);
  const sigSection = concatBytes(
    encodeShortVec(numSigners),
    ...Array.from({ length: numSigners }, () => new Uint8Array(64)),
  );
  return { txBase64: encodeBase64(concatBytes(sigSection, messageBytes)), signers };
}

/**
 * Fills every signature slot of a prepared transaction.
 *
 * The custodial signers only ever signed the first slot, which is fine for a
 * transfer but not for a marketplace purchase, where the seller must sign the
 * NFT transfer and the buyer the payment in the same transaction.
 *
 * @param {string} preparedTxBase64
 * @param {Array<{ publicKey: string, signMessage: (message: Uint8Array) => Uint8Array }>} signers
 */
export function signPreparedTransaction(preparedTxBase64, signers) {
  const txBytes = Buffer.from(preparedTxBase64, "base64");

  let pos = 0, numSigners = 0, shift = 0, b;
  do {
    b = txBytes[pos++];
    numSigners |= (b & 0x7f) << shift;
    shift += 7;
  } while (b & 0x80);

  const messageBytes = txBytes.subarray(pos + numSigners * 64);
  // Message layout: 3-byte header, then the shortvec account list; the first
  // numSigners accounts are the signer slots in order.
  let mpos = 3, numAccounts = 0; shift = 0;
  do {
    b = messageBytes[mpos++];
    numAccounts |= (b & 0x7f) << shift;
    shift += 7;
  } while (b & 0x80);

  const byKey = new Map(signers.map(s => [s.publicKey, s]));
  const signed = Buffer.from(txBytes);
  for (let i = 0; i < numSigners; i++) {
    const pubkey = encodeBase58(messageBytes.subarray(mpos + i * 32, mpos + (i + 1) * 32));
    const signer = byKey.get(pubkey);
    if (!signer) throw new Error(`Missing signer for ${pubkey}`);
    Buffer.from(signer.signMessage(messageBytes)).copy(signed, pos + i * 64);
  }
  return signed.toString("base64");
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

// Token-721 Transfer (variant 4): moves the token to `newOwner`. The current
// owner must sign.
export function buildToken721TransferInstruction(tokenAccount, owner, newOwner) {
  return {
    programId: TOKEN_721_PROGRAM,
    accounts: [
      { pubkey: decodeBase58(tokenAccount), isSigner: false, isWritable: true  },
      { pubkey: decodeBase58(owner),        isSigner: true,  isWritable: false },
    ],
    data: concatBytes(Uint8Array.from([4]), decodeBase58(newOwner)),
  };
}

// NFT marketplace BuyNft (variant 1): marks the listing Sold and records the
// buyer. It moves no funds and no token; those are separate instructions in
// the same transaction.
export function buildBuyNftInstruction(listingAccount, buyer) {
  return {
    programId: NFT_MARKETPLACE_PROGRAM,
    accounts: [
      { pubkey: decodeBase58(listingAccount), isSigner: false, isWritable: true  },
      { pubkey: decodeBase58(buyer),          isSigner: true,  isWritable: false },
    ],
    data: Uint8Array.from([1]),
  };
}
