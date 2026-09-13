import crypto from "crypto";

/**
 * Whop — the primary payment gateway.
 *
 * Two halves:
 *   1. Creating a hosted checkout, whose `purchase_url` the app opens in a
 *      browser. This matches how Paystack already works here, so the mobile
 *      app needs no changes: it opens whatever `authorizationUrl` comes back.
 *   2. Verifying incoming webhooks, which is how a payment is actually
 *      confirmed. The browser closing proves nothing.
 *
 * Pricing is dynamic: each checkout is created with an INLINE plan, so the
 * amount comes from our own SubscriptionPlan row at request time rather than
 * from a plan pre-made in Whop's dashboard. `POST /checkout_configurations`
 * returns `purchase_url` directly, so no checkout link and no embedded web
 * component are involved — which matters, because the embedded checkout is
 * browser-only and this client is a React Native app.
 *
 * The provider's raw response is always persisted, so a field rename shows up
 * as a logged payload rather than a silent failure.
 */

/**
 * Sandbox has its own host and test cards; set WHOP_SANDBOX=true to charge
 * nothing while wiring this up.
 */
const API_BASE =
  process.env.WHOP_API_BASE ||
  (process.env.WHOP_SANDBOX === "true"
    ? "https://sandbox-api.whop.com/api/v1"
    : "https://api.whop.com/api/v1");

/**
 * Pinned deliberately. Without this header Whop serves the `2025-01-01`
 * shapes, so an unpinned integration silently changes behaviour when their
 * default moves.
 */
const API_VERSION_DATE = process.env.WHOP_API_VERSION_DATE || "2026-08-14";

const CHECKOUT_PATH =
  process.env.WHOP_CHECKOUT_PATH || "/checkout_configurations";

/**
 * Treats an unfilled .env placeholder as absent.
 *
 * Optional ids are forwarded only when real: a literal `prod_xxxxxxxxxxxx`
 * would be sent as a genuine value and rejected by Whop.
 */
const realValue = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/x{6,}/i.test(trimmed)) return null;
  if (/^your_/i.test(trimmed)) return null;
  return trimmed;
};

/** Whop asks for a 2xx within five seconds, so every call here is bounded. */
const REQUEST_TIMEOUT_MS = 10000;

export const isWhopConfigured = () => Boolean(process.env.WHOP_API_KEY);

const authHeaders = () => {
  const key = process.env.WHOP_API_KEY;
  if (!key) {
    throw new Error("WHOP_API_KEY is not set");
  }
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "Api-Version-Date": API_VERSION_DATE,
  };
};

const request = async (path, { method = "POST", body, idempotencyKey } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...authHeaders(),
        // A retried initialize must not create a second checkout.
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // Kept as text below; a non-JSON body is itself the useful signal.
    }

    if (!response.ok) {
      const detail =
        parsed?.error?.message ||
        parsed?.message ||
        text?.slice(0, 500) ||
        `HTTP ${response.status}`;
      const error = new Error(`Whop ${method} ${path} failed: ${detail}`);
      error.status = response.status;
      error.response = parsed ?? text;
      throw error;
    }

    return parsed;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Creates a hosted checkout and returns the URL to send the buyer to.
 *
 * `metadata` is echoed back on the `payment.succeeded` webhook under
 * `data.metadata`, which is how a payment is tied to our own transaction row.
 */
/** Billing interval in days, as Whop expects for a renewal plan. */
const BILLING_PERIOD_DAYS = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
  annual: 365,
};

export const createCheckout = async ({
  amount,
  currency = "usd",
  title,
  metadata = {},
  isRecurring = false,
  /** SubscriptionPlan.duration — decides how often a renewal bills. */
  duration = "monthly",
  returnUrl,
}) => {
  const accountId = realValue(process.env.WHOP_ACCOUNT_ID);
  if (!accountId) {
    throw new Error("WHOP_ACCOUNT_ID is required to create a checkout");
  }

  // Whop rejects a renewal plan without a product ("In order to create a
  // renewal plan, you must pass in product details"), and the inline plan has
  // no product object — only `product_id`. A product is a one-time container;
  // the price still travels on the inline plan, so pricing stays dynamic.
  // Checked here so the failure names the real cause instead of surfacing as
  // a generic "failed to initialize" after a transaction row is written.
  const productId = realValue(process.env.WHOP_PRODUCT_ID);
  if (isRecurring && !productId) {
    const error = new Error(
      "WHOP_PRODUCT_ID is required for subscriptions: Whop needs a product to attach a recurring plan to",
    );
    error.code = "WHOP_PRODUCT_REQUIRED";
    throw error;
  }

  const billingPeriod =
    BILLING_PERIOD_DAYS[String(duration).toLowerCase()] ?? 30;

  // `account_id` is required at the top level; the price lives on the inline
  // `plan`, which is what makes the amount dynamic. Top-level `metadata` is
  // documented as copied onto the resulting payment and membership, so it is
  // what carries our transaction id through to the webhook.
  const payload = {
    account_id: accountId,
    mode: "payment",
    metadata,
    plan: {
      plan_type: isRecurring ? "renewal" : "one_time",
      initial_price: Number(amount),
      currency: String(currency).toLowerCase(),
      // Was a hard-coded 30: a yearly plan would have billed every month.
      ...(isRecurring
        ? { renewal_price: Number(amount), billing_period: billingPeriod }
        : {}),
      ...(title ? { title } : {}),
      // Optional: an inline plan carries its own pricing, so a product is
      // only an organisational link. Omitted unless genuinely configured.
      ...(productId ? { product_id: productId } : {}),
    },
    ...(returnUrl ? { redirect_url: returnUrl } : {}),
  };

  const result = await request(CHECKOUT_PATH, {
    method: "POST",
    body: payload,
    idempotencyKey: metadata?.transactionId,
  });

  // The field has appeared as `purchase_url` in the docs; accept the obvious
  // alternatives rather than failing on a rename.
  const purchaseUrl =
    result?.purchase_url ||
    result?.purchaseUrl ||
    result?.checkout_url ||
    result?.url ||
    null;

  return {
    purchaseUrl,
    // `id` is the checkout session (ch_...); the plan is nested.
    sessionId: result?.id || null,
    planId: result?.plan?.id || null,
    raw: result,
  };
};

/**
 * Reads a payment back, to confirm status without trusting the client.
 *
 * Whop documents `GET /payments` (list) but no single-payment path, so the
 * direct read is attempted and the documented list endpoint is the fallback
 * rather than assuming an undocumented URL exists.
 */
export const getPayment = async (paymentId) => {
  try {
    return await request(`/payments/${encodeURIComponent(paymentId)}`, {
      method: "GET",
    });
  } catch (error) {
    if (error?.status !== 404) throw error;

    const list = await request(
      `/payments?account_id=${encodeURIComponent(process.env.WHOP_ACCOUNT_ID || "")}&first=50`,
      { method: "GET" },
    );
    return (list?.data || []).find((payment) => payment?.id === paymentId) ?? null;
  }
};

/**
 * Whop reports a settled payment as `paid` on the API and `succeeded` on the
 * webhook, so both spellings count. Documented states are: open, authorized,
 * paid, pending, uncollectible, unresolved, void.
 */
export const isPaidStatus = (status) =>
  status === "paid" || status === "succeeded";

export const isPendingStatus = (status) =>
  status === "open" || status === "pending" || status === "authorized";

/**
 * Verifies a webhook signature.
 *
 * Whop signs `{webhook-id}.{webhook-timestamp}.{raw body}` with HMAC-SHA256
 * using the endpoint secret, base64-encoded, and sends it as
 * `webhook-signature: v1,<signature>`.
 *
 * @param {Buffer|string} rawBody the UNPARSED body — a re-serialised object
 *   will not match, which is why the route uses express.raw().
 */
export const verifyWebhookSignature = ({
  rawBody,
  webhookId,
  timestamp,
  signatureHeader,
  secret = process.env.WHOP_WEBHOOK_SECRET,
  toleranceSeconds = 300,
}) => {
  if (!secret) return { valid: false, reason: "WHOP_WEBHOOK_SECRET is not set" };
  if (!webhookId || !timestamp || !signatureHeader) {
    return { valid: false, reason: "Missing webhook signature headers" };
  }

  // A replayed request with a valid old signature is still a replay.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) {
    return { valid: false, reason: "Timestamp outside tolerance" };
  }

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody));
  const signed = Buffer.concat([
    Buffer.from(`${webhookId}.${timestamp}.`),
    body,
  ]);

  // The secret is documented with both `ws_` and `whsec_` prefixes in
  // different places, so it is used verbatim rather than parsed.
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signed)
    .digest("base64");

  // `v1,<sig>`; more than one signature can be present during a secret
  // rotation, so every candidate is checked.
  const candidates = String(signatureHeader)
    .split(/\s+/)
    .map((part) => part.split(",").pop())
    .filter(Boolean);

  const expectedBuf = Buffer.from(expected);
  const valid = candidates.some((candidate) => {
    const candidateBuf = Buffer.from(candidate);
    // timingSafeEqual throws on a length mismatch, which is itself a failure.
    return (
      candidateBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(candidateBuf, expectedBuf)
    );
  });

  return valid ? { valid: true } : { valid: false, reason: "Signature mismatch" };
};

export default {
  isWhopConfigured,
  createCheckout,
  getPayment,
  isPaidStatus,
  isPendingStatus,
  verifyWebhookSignature,
};
