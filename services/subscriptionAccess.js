import { prisma } from "../config/db.js";

/**
 * Whether a user currently has a paid subscription.
 *
 * The rule matches services/subscriptionPaymentService.js: the status must be
 * "active" AND the expiry must still be in the future. Status alone is not
 * enough — a lapsed subscription keeps `subscriptionStatus: "active"` until
 * something updates it, so checking only that would hand paid features to
 * people whose plan ran out.
 *
 * A missing expiry is treated as active: admin-granted plans are set that way.
 */
export function isSubscriptionActive(user) {
  if (user?.subscriptionStatus !== "active") return false;
  if (!user.subscriptionExpiry) return true;
  return new Date(user.subscriptionExpiry) > new Date();
}

/**
 * Same check for a user id, for routes whose `req.user` may predate the last
 * subscription change. Never throws: a lookup failure denies the paid feature
 * rather than failing the request.
 */
export async function hasActiveSubscription(userId) {
  if (!userId) return false;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true, subscriptionExpiry: true },
    });
    return isSubscriptionActive(user);
  } catch (error) {
    console.error("subscription check failed:", error);
    return false;
  }
}

export default { isSubscriptionActive, hasActiveSubscription };
