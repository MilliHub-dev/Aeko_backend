import { prisma } from "../config/db.js";
import cron from "node-cron";
import { checkExpiringSubscriptions } from "./subscriptionExpirationNotifications.js";

// Run daily at midnight
cron.schedule("0 0 * * *", async () => {
  try {
    console.log("Checking for expired subscriptions...");
    const now = new Date();

    await prisma.user.updateMany({
      where: {
        subscriptionExpiry: { lte: now },
        subscriptionStatus: "active",
      },
      data: {
        goldenTick: false,
        subscriptionStatus: "inactive",
        subscriptionExpiry: null,
      },
    });

    console.log("Expired subscriptions removed.");
  } catch (error) {
    console.error("Expired subscription cleanup failed:", {
      name: error?.name,
      code: error?.code,
      message: error?.message,
    });
  }
});

// Run daily at 9 AM to check for subscriptions expiring in 7 days
cron.schedule("0 9 * * *", async () => {
  try {
    console.log("Checking for expiring subscriptions (7-day notice)...");
    await checkExpiringSubscriptions();
  } catch (error) {
    console.error("Subscription expiration notification job failed:", {
      name: error?.name,
      code: error?.code,
      message: error?.message,
    });
  }
});
