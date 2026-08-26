/**
 * Link sticker validation.
 *
 * A tappable URL laid over a full-screen image is a strong phishing surface: the
 * viewer sees an image the author controls and a tap target the author controls.
 * Everything here exists to narrow that.
 *
 * The server is authoritative. The client mirrors these rules for immediate feedback,
 * but a story is only stored if it passes here.
 */

export const MAX_URL_LENGTH = 2000;
export const MAX_LABEL_LENGTH = 40;
export const MAX_STICKERS_PER_STATUS = 1;

/**
 * Hosts whose links open without an interstitial. Everything else is shown to the
 * viewer with its destination and a confirmation step.
 */
const DEFAULT_TRUSTED_HOSTS = ["aeko.online", "www.aeko.online"];

export function trustedHosts() {
  const configured = (process.env.LINK_STICKER_TRUSTED_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_TRUSTED_HOSTS;
}

// Hostnames that must never be reachable from a story link. Raw IPs and internal
// names are how a link sticker would be used to probe or reach infrastructure.
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "169.254.169.254",
]);

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

function isPrivateHost(hostname) {
  const h = hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) {
    return true;
  }
  // Bracketed IPv6 or any raw IPv4: a legitimate public link has a domain name.
  if (h.startsWith("[") || IPV4.test(h)) return true;

  return false;
}

/**
 * Validate and normalise a link-sticker URL.
 *
 * @returns {{ ok: true, url: string, host: string, isTrusted: boolean } | { ok: false, error: string }}
 */
export function validateLinkUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return { ok: false, error: "A link is required." };
  }

  const candidate = rawUrl.trim();
  if (candidate.length > MAX_URL_LENGTH) {
    return { ok: false, error: "That link is too long." };
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, error: "That doesn't look like a valid link." };
  }

  // https only. This rejects javascript:, data:, file: and app schemes outright,
  // and plain http, which cannot be trusted for a link the viewer did not type.
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Links must start with https://" };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: "Links cannot contain a username or password." };
  }

  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    return { ok: false, error: "That link needs a valid domain." };
  }

  if (isPrivateHost(parsed.hostname)) {
    return { ok: false, error: "That destination isn't allowed." };
  }

  const host = parsed.hostname.toLowerCase();
  const isTrusted = trustedHosts().some(
    (t) => host === t || host.endsWith(`.${t}`),
  );

  // Re-serialise from the parsed URL so what is stored is exactly what was validated.
  return { ok: true, url: parsed.toString(), host, isTrusted };
}

const clamp01 = (n, fallback) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
};

/**
 * Validate the sticker array submitted with a story.
 *
 * Position is stored normalised (0..1 of the screen) so it lands in the same place
 * regardless of the viewer's device.
 */
export function validateStickers(input) {
  if (input == null) return { ok: true, stickers: null };
  if (!Array.isArray(input)) {
    return { ok: false, error: "stickers must be an array." };
  }
  if (input.length === 0) return { ok: true, stickers: null };
  if (input.length > MAX_STICKERS_PER_STATUS) {
    return {
      ok: false,
      error: `A story can carry at most ${MAX_STICKERS_PER_STATUS} sticker.`,
    };
  }

  const out = [];
  for (const sticker of input) {
    if (!sticker || sticker.type !== "link") {
      return { ok: false, error: "Only link stickers are supported." };
    }

    const result = validateLinkUrl(sticker.url);
    if (!result.ok) return { ok: false, error: result.error };

    const label =
      typeof sticker.label === "string" && sticker.label.trim()
        ? sticker.label.trim().slice(0, MAX_LABEL_LENGTH)
        : result.host;

    out.push({
      type: "link",
      url: result.url,
      host: result.host,
      label,
      // Resolved server-side so the client cannot skip its own interstitial.
      isTrusted: result.isTrusted,
      x: clamp01(sticker.x, 0.5),
      y: clamp01(sticker.y, 0.8),
    });
  }

  return { ok: true, stickers: out };
}

export default { validateLinkUrl, validateStickers, trustedHosts };
