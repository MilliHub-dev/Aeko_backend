import { getPayment, isPaidStatus, isPendingStatus } from "./whopService.js";

/**
 * Confirms a Whop payment for one of our Transaction rows, server-side.
 *
 * Shared by community membership and coin purchases. The subscription service
 * has its own private copy of this logic; it is not imported from there so
 * that platform subscriptions and these flows can change independently.
 *
 * The webhook is the primary path. This covers the app calling `verify` after
 * the browser closes, which on its own proves nothing about payment. The
 * checkout response carries a checkout session and plan id, never a payment
 * id, so until `payment.succeeded` has recorded `whopPaymentId` there is
 * nothing to look up and the honest answer is "pending", not "failed".
 *
 * @returns {Promise<{success: boolean, pending: boolean, status?: string, message: string}>}
 */
const AWAITING = Object.freeze({
  success: false,
  pending: true,
  message: "Awaiting confirmation from Whop",
});

export const confirmWhopTransaction = async (transaction) => {
  const response = transaction?.providerResponse;

  // After the webhook, providerResponse IS the payment object (id `pay_...`);
  // before it, it is the checkout configuration (id `ch_...`), whose id must
  // not be mistaken for a payment.
  const paymentId =
    transaction?.metadata?.whopPaymentId ||
    response?.payment_id ||
    (typeof response?.id === "string" && response.id.startsWith("pay_")
      ? response.id
      : null);

  if (!paymentId) return { ...AWAITING };

  let payment;
  try {
    payment = await getPayment(paymentId);
  } catch (error) {
    // A Whop outage must not tell someone who paid that their payment failed;
    // the webhook will still settle it.
    console.warn(`Whop payment lookup failed for ${paymentId}:`, error.message);
    return { ...AWAITING };
  }

  if (!payment) return { ...AWAITING };

  // Whop says `paid` on the API and `succeeded` on the webhook.
  const paid = isPaidStatus(payment.status);

  return {
    success: paid,
    pending: !paid && isPendingStatus(payment.status),
    status: payment.status,
    message: paid ? "Payment confirmed" : `Payment is ${payment.status}`,
  };
};

/**
 * Atomically moves a transaction to `completed`, inside `tx`.
 *
 * This is the idempotency lock for fulfilment. A status check followed by a
 * write is a race: the webhook and the app's verify call routinely arrive
 * together, and both would see `pending` and both would credit. An UPDATE
 * guarded by `status <> 'completed'` takes the row lock, so under Postgres
 * READ COMMITTED the second caller blocks until the first commits, re-checks
 * the guard, and updates nothing. If the first caller rolls back, the second
 * proceeds — which is exactly the retry semantics wanted.
 *
 * @returns {Promise<boolean>} true if this caller claimed the transaction
 */
export const claimTransactionForFulfilment = async (tx, transactionId) => {
  const claim = await tx.transaction.updateMany({
    where: { id: transactionId, status: { not: "completed" } },
    data: { status: "completed", verifiedAt: new Date() },
  });
  return claim.count > 0;
};

export default { confirmWhopTransaction, claimTransactionForFulfilment };
