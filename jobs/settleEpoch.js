import cron from "node-cron";

// Epoch reward settlement is pending SDK support (buildSettleRewardEpoch not yet shipped).
// The cron slot is kept so we can wire in the real implementation once the chain team ships it.
cron.schedule("0 0 * * *", () => {
  console.log("[settleEpoch] Skipping — epoch settlement pending SDK support from chain team.");
});
