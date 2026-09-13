import { Expo } from "expo-server-sdk";
import { prisma } from "../config/db.js";

/**
 * Expo push delivery.
 *
 * The mobile client registers an Expo push token (`ExponentPushToken[...]`),
 * not a raw FCM token, so delivery goes through Expo's service rather than
 * firebase-admin. Expo fans out to FCM and APNs itself.
 *
 * EXPO_ACCESS_TOKEN is optional but recommended: it enables push security so
 * that only holders of the token can send to your project's devices.
 */
const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

/**
 * Expo rejects a whole request if any token in it is malformed, so tokens are
 * validated before they are batched.
 */
export const isValidPushToken = (token) =>
  typeof token === "string" && Expo.isExpoPushToken(token);

/**
 * Clears tokens Expo reported as permanently undeliverable. Leaving them in
 * place means every future send retries a device that has uninstalled the app.
 */
const dropInvalidTokens = async (tokens) => {
  if (!tokens.length) return;
  try {
    await prisma.user.updateMany({
      where: { pushToken: { in: tokens } },
      data: { pushToken: null },
    });
    console.log(`[PUSH] Cleared ${tokens.length} unregistered token(s)`);
  } catch (error) {
    console.error("[PUSH] Failed to clear unregistered tokens:", error);
  }
};

/**
 * How long to wait before asking Expo for receipts. Expo needs a few seconds
 * to hand a message to FCM/APNs; asking immediately returns nothing.
 */
const RECEIPT_DELAY_MS = 15000;

/**
 * What each receipt error means, in terms of what to do about it.
 */
const RECEIPT_HINTS = {
  InvalidCredentials:
    "Expo has no valid FCM (Android) or APNs (iOS) credentials for this project. Upload them with `eas credentials` — until then every push is accepted by Expo and then silently dropped.",
  DeviceNotRegistered:
    "The app was uninstalled or the token was revoked; the token has been cleared.",
  MessageTooBig: "The payload exceeds 4096 bytes.",
  MessageRateExceeded: "Too many messages to this device; send less often.",
  MismatchSenderId:
    "The FCM credentials uploaded to Expo belong to a different Firebase project than google-services.json.",
};

/**
 * Fetches final delivery receipts for sent messages.
 *
 * A ticket only says Expo ACCEPTED a message. Whether FCM or APNs actually
 * delivered it is reported later, in a receipt — and nothing here ever read
 * receipts, so a push rejected downstream (most often: no FCM credentials on
 * the Expo project) was reported as sent while never arriving.
 *
 * @param {Array<{id: string, to: string}>} ticketRefs
 * @returns {Promise<{delivered: number, errors: Array<{code: string, message: string, hint?: string}>}>}
 */
export const checkPushReceipts = async (ticketRefs) => {
  const tokenById = new Map(ticketRefs.map((ref) => [ref.id, ref.to]));
  const result = { delivered: 0, errors: [] };
  const unregistered = [];

  for (const chunk of expo.chunkPushNotificationReceiptIds([...tokenById.keys()])) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (const [id, receipt] of Object.entries(receipts)) {
        if (receipt.status === "ok") {
          result.delivered += 1;
          continue;
        }

        const code = receipt.details?.error ?? "Unknown";
        const hint = RECEIPT_HINTS[code];
        result.errors.push({ code, message: receipt.message, hint });
        console.error(
          `[PUSH] Not delivered (${code}): ${receipt.message}${hint ? ` — ${hint}` : ""}`,
        );

        if (code === "DeviceNotRegistered" && tokenById.get(id)) {
          unregistered.push(tokenById.get(id));
        }
      }
    } catch (error) {
      console.error("[PUSH] Failed to fetch receipts:", error);
    }
  }

  await dropInvalidTokens(unregistered);
  return result;
};

/** Checks receipts in the background, so no request waits on Expo. */
const scheduleReceiptCheck = (ticketRefs) => {
  if (!ticketRefs.length) return;
  const timer = setTimeout(() => {
    checkPushReceipts(ticketRefs).catch((error) => {
      console.error("[PUSH] Receipt check failed:", error);
    });
  }, RECEIPT_DELAY_MS);
  // Never keep the process alive just to read receipts.
  timer.unref?.();
};

/**
 * Sends a batch of Expo push messages.
 *
 * @param {Array<{to: string, title?: string, body?: string, data?: Object,
 *   sound?: string, channelId?: string, badge?: number}>} messages
 * @param {{checkReceipts?: boolean}} [options] set false to skip the
 *   background receipt check (the diagnostic script checks them itself)
 * @returns {Promise<{sent: number, failed: number, ticketRefs: Array<{id: string, to: string}>}>}
 */
export const sendExpoPushMessages = async (messages, { checkReceipts = true } = {}) => {
  const deliverable = messages.filter((message) => isValidPushToken(message.to));

  const invalid = messages.filter((message) => !isValidPushToken(message.to));
  if (invalid.length) {
    console.warn(`[PUSH] Skipping ${invalid.length} malformed token(s)`);
  }

  if (!deliverable.length) return { sent: 0, failed: 0, ticketRefs: [] };

  let sent = 0;
  let failed = 0;
  const unregistered = [];
  const ticketRefs = [];

  for (const chunk of expo.chunkPushNotifications(deliverable)) {
    try {
      // These are tickets, not final receipts: they report whether Expo
      // accepted each message. Terminal delivery status is fetched later via
      // getPushNotificationReceiptsAsync; DeviceNotRegistered is reported at
      // both stages, and acting on it here removes dead tokens sooner.
      const tickets = await expo.sendPushNotificationsAsync(chunk);

      tickets.forEach((ticket, index) => {
        if (ticket.status === "ok") {
          sent += 1;
          // "ok" means accepted by Expo, not delivered — keep the id so the
          // receipt can confirm delivery.
          if (ticket.id) ticketRefs.push({ id: ticket.id, to: chunk[index].to });
          return;
        }

        failed += 1;
        console.error("[PUSH] Delivery error:", ticket.message);

        // The device uninstalled the app or the token was revoked.
        if (ticket.details?.error === "DeviceNotRegistered") {
          unregistered.push(chunk[index].to);
        }
      });
    } catch (error) {
      failed += chunk.length;
      console.error("[PUSH] Failed to send a chunk:", error);
    }
  }

  await dropInvalidTokens(unregistered);

  if (checkReceipts) scheduleReceiptCheck(ticketRefs);

  return { sent, failed, ticketRefs };
};

export default { sendExpoPushMessages, checkPushReceipts, isValidPushToken };
