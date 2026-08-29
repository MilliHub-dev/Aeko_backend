import cron from "node-cron";
import { prisma } from "../config/db.js";
import { deleteFromCloudinary } from "../services/cloudinaryService.js";

/**
 * Purge expired stories and their Cloudinary media.
 *
 * Before this job existed, expiry was enforced only by a `expiresAt > now` filter at
 * query time, so rows and uploaded media accumulated in the database and in
 * Cloudinary indefinitely.
 *
 * A story still referenced by a highlight is preserved: the highlight is the whole
 * point of outliving the 24h window.
 */

const BATCH_SIZE = 200;

export async function purgeExpiredStatuses({
  now = new Date(),
  dryRun = false,
} = {}) {
  let deletedRows = 0;
  let deletedAssets = 0;
  let retained = 0;
  let assetFailures = 0;

  for (;;) {
    const batch = await prisma.status.findMany({
      where: {
        expiresAt: { lte: now },
        // Skip anything a highlight still points at.
        highlightItems: { none: {} },
      },
      select: {
        id: true,
        cloudinaryPublicId: true,
        cloudinaryResourceType: true,
      },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    if (dryRun) {
      deletedRows += batch.length;
      break;
    }

    const ids = batch.map((s) => s.id);
    // Delete rows first. status_views and status_reactions cascade.
    const result = await prisma.status.deleteMany({
      where: { id: { in: ids } },
    });
    deletedRows += result.count;

    for (const item of batch) {
      if (!item.cloudinaryPublicId) continue;
      try {
        await deleteFromCloudinary(
          item.cloudinaryPublicId,
          item.cloudinaryResourceType || "image",
        );
        deletedAssets += 1;
      } catch (error) {
        assetFailures += 1;
        console.error(
          "Story media delete failed:",
          item.cloudinaryPublicId,
          error?.message,
        );
      }
    }

    if (batch.length < BATCH_SIZE) break;
  }

  retained = await prisma.status.count({
    where: { expiresAt: { lte: now }, highlightItems: { some: {} } },
  });

  return { deletedRows, deletedAssets, assetFailures, retained };
}

// Hourly, rather than daily, so expired media does not linger for most of a day.
cron.schedule("15 * * * *", async () => {
  try {
    const summary = await purgeExpiredStatuses();
    if (summary.deletedRows > 0 || summary.assetFailures > 0) {
      console.log("Expired stories purged:", summary);
    }
  } catch (error) {
    console.error("Story expiry job failed:", {
      name: error?.name,
      code: error?.code,
      message: error?.message,
    });
  }
});

export default purgeExpiredStatuses;
