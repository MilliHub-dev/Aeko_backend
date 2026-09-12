-- Webhook de-duplication.
--
-- Whop retries a failed delivery for about three days (roughly ten attempts)
-- and every retry carries the SAME `webhook-id`. Without a record of what has
-- already been handled, a retry after a slow-but-successful run would grant a
-- subscription a second time. The unique index is what makes the handler
-- idempotent: a duplicate insert fails and the event is acknowledged as
-- already processed.
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT,
    "payload" JSONB,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_events_provider_eventId_key"
    ON "webhook_events"("provider", "eventId");

CREATE INDEX "webhook_events_processedAt_idx"
    ON "webhook_events"("processedAt");
