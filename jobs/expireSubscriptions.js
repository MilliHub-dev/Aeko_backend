import User from "../models/User.js";
import cron from "node-cron";

// Run daily at midnight
cron.schedule("0 0 * * *", async () => {
  console.log("Checking for expired subscriptions...");
  const now = new Date();

  await User.updateMany(
    { subscriptionExpiry: { $lte: now }, subscriptionStatus: "active" },
    { $set: { goldenTick: false, subscriptionStatus: "inactive", subscriptionExpiry: null } }
  );

  console.log("Expired subscriptions removed.");
});
