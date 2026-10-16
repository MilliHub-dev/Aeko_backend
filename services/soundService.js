import { promises as fs } from "fs";
import os from "os";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import cloudinary, { uploadToCloudinary } from "./cloudinaryService.js";
import { prisma } from "../config/db.js";

/**
 * Sounds: music and audio clips for photo posts and stories.
 *
 * Nothing is mixed on the server. A sound is a Cloudinary asset delivered as
 * mp3; a post or story stores `soundId` + `soundStartMs` and the client plays
 * the track from that offset while the photo is on screen (how Instagram does
 * photo + music). That keeps uploads instant and lets a track be changed or
 * taken down without touching the posts.
 *
 * Origins:
 *   LIBRARY     – CC0 tracks uploaded by admins (scripts/import-sounds.js or
 *                 POST /api/sounds as an admin).
 *   USER_UPLOAD – an audio file a user uploaded; reusable by everyone.
 *   EXTRACTED   – the audio of a user's own video post ("original sound").
 */

export const SOUND_SOURCES = ["LIBRARY", "USER_UPLOAD", "EXTRACTED"];
export const SOUND_CATEGORIES = [
  "Afrobeats",
  "Amapiano",
  "Hip-Hop",
  "R&B",
  "Pop",
  "Gospel",
  "Electronic",
  "Lo-fi",
  "Acoustic",
  "Cinematic",
  "Sound effects",
  "Voice",
  "Other",
];

export const MAX_SOUND_DURATION_MS = 5 * 60 * 1000;
export const MIN_SOUND_DURATION_MS = 1000;
export const MAX_SOUND_BYTES = 25 * 1024 * 1024;
/** Only these media types can carry music; video brings its own audio. */
export const SOUND_POST_TYPES = new Set(["image"]);
export const SOUND_STATUS_TYPES = new Set(["image", "text"]);

const UPLOADER_SELECT = { id: true, username: true, name: true, profilePicture: true };

export const SOUND_SELECT = {
  id: true,
  title: true,
  artist: true,
  durationMs: true,
  audioUrl: true,
  coverUrl: true,
  source: true,
  license: true,
  category: true,
  useCount: true,
  uploaderId: true,
  sourcePostId: true,
  isActive: true,
  createdAt: true,
  uploader: { select: UPLOADER_SELECT },
};

export class SoundError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "SoundError";
    this.status = status;
    this.code = code;
  }
}

/** The shape every client sees. */
export function toPublicSound(sound) {
  if (!sound) return null;
  return {
    id: sound.id,
    title: sound.title,
    artist: sound.artist ?? (sound.uploader?.username ? `@${sound.uploader.username}` : null),
    durationMs: sound.durationMs,
    audioUrl: sound.audioUrl,
    coverUrl: sound.coverUrl ?? sound.uploader?.profilePicture ?? null,
    source: sound.source,
    license: sound.license,
    category: sound.category ?? null,
    useCount: sound.useCount ?? 0,
    isOriginal: sound.source === "EXTRACTED",
    uploader: sound.uploader ?? null,
    sourcePostId: sound.sourcePostId ?? null,
    createdAt: sound.createdAt,
  };
}

/* ----------------------------------------------------------------- helpers */

/** mp3 delivery URL for a Cloudinary audio/video asset. */
const mp3UrlFor = (publicId) =>
  cloudinary.url(publicId, { resource_type: "video", format: "mp3", secure: true });

/** `aeko/videos/clip-123` out of a Cloudinary delivery URL, or null. */
export function cloudinaryPublicIdFromUrl(url) {
  if (typeof url !== "string") return null;
  const upload = url.match(/res\.cloudinary\.com\/[^/]+\/(?:video|image|raw)\/upload\/(.+?)(?:[?#].*)?$/i);
  if (!upload) return null;
  // Delivery URLs are `[transformations/]v<version>/<public_id>.<ext>`; the
  // version separates transformation segments from the id.
  const rest = upload[1];
  const afterVersion = rest.match(/(?:^|\/)v\d+\/(.+)$/);
  const idWithExt = afterVersion ? afterVersion[1] : rest;
  return idWithExt.replace(/\.[a-z0-9]+$/i, "") || null;
}

const toMs = (seconds) => Math.round(Number(seconds) * 1000);

function assertDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs < MIN_SOUND_DURATION_MS) {
    throw new SoundError(400, "SOUND_TOO_SHORT", "That audio is too short to use.");
  }
  if (durationMs > MAX_SOUND_DURATION_MS) {
    throw new SoundError(400, "SOUND_TOO_LONG", `Sounds are limited to ${MAX_SOUND_DURATION_MS / 60000} minutes.`);
  }
}

function cleanTitle(value, fallback) {
  const t = String(value ?? "").trim().slice(0, 120);
  return t || fallback;
}

/* ------------------------------------------------------------------ create */

/**
 * Uploads a local audio file and records it.
 *
 * @param {object} input
 * @param {string} input.filePath   local path (multer temp file)
 * @param {string} input.title
 * @param {string} [input.artist]
 * @param {string} [input.category]
 * @param {string} [input.coverUrl]
 * @param {string} [input.uploaderId]
 * @param {"LIBRARY"|"USER_UPLOAD"} input.source
 * @param {string} [input.license]
 */
export async function createSoundFromFile(input) {
  const result = await uploadToCloudinary(input.filePath, {
    folder: "aeko/sounds",
    resourceType: "video",
    transformation: [],
  });
  const durationMs = toMs(result.duration);
  try {
    assertDuration(durationMs);
  } catch (err) {
    await cloudinary.uploader.destroy(result.public_id, { resource_type: "video" }).catch(() => {});
    throw err;
  }

  const sound = await prisma.sound.create({
    data: {
      title: cleanTitle(input.title, "Untitled sound"),
      artist: input.artist ? String(input.artist).trim().slice(0, 120) : null,
      durationMs,
      audioUrl: mp3UrlFor(result.public_id),
      publicId: result.public_id,
      coverUrl: input.coverUrl || null,
      source: input.source,
      license: input.license || (input.source === "LIBRARY" ? "CC0" : "ORIGINAL"),
      category: SOUND_CATEGORIES.includes(input.category) ? input.category : null,
      tags: Array.isArray(input.tags) ? input.tags.slice(0, 20) : undefined,
      uploaderId: input.uploaderId || null,
    },
    select: SOUND_SELECT,
  });
  return sound;
}

/**
 * Turns the audio of a video post into a reusable "original sound".
 *
 * Only the post's owner may do it (it is their recording); it is idempotent,
 * so a second call returns the existing sound. Cloudinary derives the mp3 from
 * the stored video, so for Cloudinary-hosted posts no ffmpeg runs; other hosts
 * fall back to ffmpeg, which the Docker image carries.
 */
export async function extractSoundFromPost({ postId, userId, title, isAdmin = false }) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      userId: true,
      type: true,
      media: true,
      text: true,
      status: true,
      users_posts_userIdTouser: { select: UPLOADER_SELECT },
    },
  });
  if (!post || post.status !== "active") throw new SoundError(404, "POST_NOT_FOUND", "Post not found");
  if (post.userId !== userId && !isAdmin) {
    throw new SoundError(403, "NOT_OWNER", "Only the person who posted this video can make it a sound.");
  }
  if (post.type !== "video") throw new SoundError(400, "NOT_A_VIDEO", "Sounds can only be taken from video posts.");

  const existing = await prisma.sound.findUnique({ where: { sourcePostId: postId }, select: SOUND_SELECT });
  if (existing) return { sound: existing, created: false };

  const videoUrl = Array.isArray(post.media) ? post.media[0] : post.media;
  if (typeof videoUrl !== "string" || !videoUrl) throw new SoundError(400, "NO_MEDIA", "This post has no video file.");

  const soundTitle = cleanTitle(
    title,
    `Original sound – ${post.users_posts_userIdTouser?.username ? `@${post.users_posts_userIdTouser.username}` : "Aeko"}`,
  );

  let uploaded;
  const videoPublicId = cloudinaryPublicIdFromUrl(videoUrl);
  if (videoPublicId) {
    // Re-upload Cloudinary's own mp3 rendition as a separate asset so the sound
    // outlives the post it came from.
    uploaded = await uploadToCloudinary(mp3UrlFor(videoPublicId), {
      folder: "aeko/sounds",
      resourceType: "video",
      transformation: [],
    });
  } else {
    const tmp = path.join(os.tmpdir(), `aeko-sound-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
    try {
      await new Promise((resolve, reject) => {
        ffmpeg(videoUrl)
          .noVideo()
          .audioCodec("libmp3lame")
          .audioQuality(4)
          .on("error", reject)
          .on("end", resolve)
          .save(tmp);
      });
      uploaded = await uploadToCloudinary(tmp, { folder: "aeko/sounds", resourceType: "video", transformation: [] });
    } finally {
      await fs.unlink(tmp).catch(() => {});
    }
  }

  const durationMs = toMs(uploaded.duration);
  if (!Number.isFinite(durationMs) || durationMs < MIN_SOUND_DURATION_MS) {
    await cloudinary.uploader.destroy(uploaded.public_id, { resource_type: "video" }).catch(() => {});
    throw new SoundError(400, "NO_AUDIO", "This video has no usable audio track.");
  }

  try {
    const sound = await prisma.sound.create({
      data: {
        title: soundTitle,
        artist: post.users_posts_userIdTouser?.username ? `@${post.users_posts_userIdTouser.username}` : null,
        durationMs: Math.min(durationMs, MAX_SOUND_DURATION_MS),
        audioUrl: mp3UrlFor(uploaded.public_id),
        publicId: uploaded.public_id,
        coverUrl: post.users_posts_userIdTouser?.profilePicture || null,
        source: "EXTRACTED",
        license: "ORIGINAL",
        category: "Voice",
        uploaderId: post.userId,
        sourcePostId: post.id,
      },
      select: SOUND_SELECT,
    });
    return { sound, created: true };
  } catch (error) {
    // Two taps raced the unique index: the first one won, return it.
    if (error?.code === "P2002") {
      const sound = await prisma.sound.findUnique({ where: { sourcePostId: postId }, select: SOUND_SELECT });
      await cloudinary.uploader.destroy(uploaded.public_id, { resource_type: "video" }).catch(() => {});
      return { sound, created: false };
    }
    throw error;
  }
}

/* -------------------------------------------------------------------- read */

export async function listSounds({ q = "", category = null, sort = "trending", page = 1, limit = 20, uploaderId = null, source = null } = {}) {
  const take = Math.min(50, Math.max(1, Number(limit) || 20));
  const skip = (Math.max(1, Number(page) || 1) - 1) * take;
  const where = { isActive: true };
  if (uploaderId) where.uploaderId = uploaderId;
  if (source && SOUND_SOURCES.includes(source)) where.source = source;
  if (category && SOUND_CATEGORIES.includes(category)) where.category = category;
  const query = String(q ?? "").trim();
  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { artist: { contains: query, mode: "insensitive" } },
      { uploader: { username: { contains: query, mode: "insensitive" } } },
    ];
  }
  const orderBy = sort === "recent" ? [{ createdAt: "desc" }] : [{ useCount: "desc" }, { createdAt: "desc" }];

  const [rows, total] = await Promise.all([
    prisma.sound.findMany({ where, orderBy, skip, take: take + 1, select: SOUND_SELECT }),
    prisma.sound.count({ where }),
  ]);
  return {
    sounds: rows.slice(0, take).map(toPublicSound),
    page: Math.max(1, Number(page) || 1),
    limit: take,
    total,
    hasMore: rows.length > take,
  };
}

export async function getSound(id, { includeInactive = false } = {}) {
  const sound = await prisma.sound.findUnique({ where: { id }, select: SOUND_SELECT });
  if (!sound || (!sound.isActive && !includeInactive)) return null;
  return sound;
}

/**
 * Validates `soundId`/`soundStartMs` from a create request.
 * Returns `{ data }` to spread into the Prisma create, or `{ error }`.
 */
export async function resolveSoundAttachment({ soundId, soundStartMs, type, allowedTypes }) {
  const id = typeof soundId === "string" ? soundId.trim() : "";
  if (!id) return { data: {} };
  if (!allowedTypes.has(type)) {
    return { error: "Music can be added to photo posts and image or text stories only; videos carry their own audio." };
  }
  const sound = await getSound(id);
  if (!sound) return { error: "That sound is no longer available." };
  let start = Number.parseInt(soundStartMs, 10);
  if (!Number.isFinite(start) || start < 0) start = 0;
  if (start >= sound.durationMs) start = 0;
  return { data: { soundId: sound.id, soundStartMs: start }, sound };
}

/** Fire-and-forget usage counter. */
export function bumpSoundUse(soundId) {
  if (!soundId) return;
  prisma.sound
    .update({ where: { id: soundId }, data: { useCount: { increment: 1 } } })
    .catch((error) => console.error("sound useCount error:", error));
}

/**
 * Adds `sound` (public shape) to posts/stories that carry a `soundId`, in one
 * query for the whole page. Mutates and returns the array.
 */
export async function attachSoundData(items) {
  if (!Array.isArray(items) || items.length === 0) return items;
  const ids = [...new Set(items.map((i) => i?.soundId).filter(Boolean))];
  if (ids.length === 0) {
    for (const item of items) if (item && item.sound === undefined) item.sound = null;
    return items;
  }
  const sounds = await prisma.sound.findMany({ where: { id: { in: ids } }, select: SOUND_SELECT });
  const byId = new Map(sounds.map((s) => [s.id, toPublicSound(s)]));
  for (const item of items) {
    if (!item) continue;
    item.sound = item.soundId ? byId.get(item.soundId) ?? null : null;
    if (item.soundStartMs === undefined) item.soundStartMs = null;
  }
  return items;
}

/* ------------------------------------------------------------------ manage */

/** Uploader or admin removes a sound. Posts keep playing nothing rather than a dead link. */
export async function deactivateSound({ soundId, userId, isAdmin }) {
  const sound = await prisma.sound.findUnique({ where: { id: soundId }, select: { id: true, uploaderId: true, isActive: true } });
  if (!sound) throw new SoundError(404, "SOUND_NOT_FOUND", "Sound not found");
  if (sound.uploaderId !== userId && !isAdmin) throw new SoundError(403, "NOT_OWNER", "You can only remove sounds you added.");
  await prisma.sound.update({ where: { id: soundId }, data: { isActive: false } });
  return { id: soundId, isActive: false };
}

export async function reportSound({ soundId, reporterId, reason }) {
  const sound = await prisma.sound.findUnique({ where: { id: soundId }, select: { id: true, uploaderId: true } });
  if (!sound) throw new SoundError(404, "SOUND_NOT_FOUND", "Sound not found");
  const text = String(reason ?? "").trim().slice(0, 500);
  if (!text) throw new SoundError(400, "REASON_REQUIRED", "Tell us what's wrong with this sound.");
  return prisma.report.create({
    data: {
      reporterId,
      reportedId: sound.uploaderId,
      entityId: sound.id,
      entityType: "SOUND",
      reason: text,
    },
    select: { id: true, status: true },
  });
}

export default {
  createSoundFromFile,
  extractSoundFromPost,
  listSounds,
  getSound,
  resolveSoundAttachment,
  bumpSoundUse,
  attachSoundData,
  deactivateSound,
  reportSound,
  toPublicSound,
};
