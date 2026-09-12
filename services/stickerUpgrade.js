import { prisma } from "../config/db.js";
import { buildStickerUrl } from "./cloudinaryService.js";
import { isSubscriptionActive } from "./subscriptionAccess.js";

/**
 * Re-processes a user's existing stickers once they subscribe.
 *
 * A sticker made by a free user keeps its background, and that was permanent
 * even after the creator paid — their old stickers stayed square crops while
 * new ones were cut out.
 *
 * Nothing is re-uploaded: the delivered URL is derived entirely from the stored
 * Cloudinary `publicId`, so upgrading means rewriting the URL and the flag.
 * Cloudinary generates the cut-out version the first time it is requested, so
 * the add-on is billed on view rather than here.
 *
 * Never throws: this runs as a side effect of activating a subscription, and a
 * failure here must not fail the payment. Stickers are upgraded lazily on the
 * next sticker fetch anyway.
 */
export async function upgradeStickersForUser(userId) {
  if (!userId) return { upgraded: 0 };

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true, subscriptionExpiry: true },
    });

    // Only for a subscription that is actually live right now.
    if (!isSubscriptionActive(user)) return { upgraded: 0 };

    const pending = await prisma.sticker.findMany({
      where: { creatorId: userId, backgroundRemoved: false },
      select: { id: true, publicId: true },
    });
    if (pending.length === 0) return { upgraded: 0 };

    await prisma.$transaction(
      pending.map((sticker) =>
        prisma.sticker.update({
          where: { id: sticker.id },
          data: {
            url: buildStickerUrl(sticker.publicId, {
              withBackgroundRemoval: true,
            }),
            backgroundRemoved: true,
          },
        }),
      ),
    );

    console.log(
      `stickers upgraded for user ${userId}: ${pending.length} cut out`,
    );
    return { upgraded: pending.length };
  } catch (error) {
    console.error(`sticker upgrade failed for user ${userId}:`, error);
    return { upgraded: 0 };
  }
}

export default { upgradeStickersForUser };
