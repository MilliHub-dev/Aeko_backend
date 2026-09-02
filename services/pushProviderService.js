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
 * Sends a batch of Expo push messages.
 *
 * @param {Array<{to: string, title?: string, body?: string, data?: Object,
 *   sound?: string, channelId?: string, badge?: number}>} messages
 * @returns {Promise<{sent: number, failed: number}>}
 */
export const sendExpoPushMessages = async (messages) => {
  const deliverable = messages.filter((message) => isValidPushToken(message.to));

  const invalid = messages.filter((message) => !isValidPushToken(message.to));
  if (invalid.length) {
    console.warn(`[PUSH] Skipping ${invalid.length} malformed token(s)`);
  }

  if (!deliverable.length) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const unregistered = [];

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

  return { sent, failed };
};

export default { sendExpoPushMessages, isValidPushToken };
