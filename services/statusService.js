import { prisma } from "../config/db.js";
import { deleteFromCloudinary } from "./cloudinaryService.js";
import { createNotification } from "./notificationService.js";

/**
 * Story/Status domain logic.
 *
 * Kept out of routes/status.js so the route layer stays thin: validate, call, respond.
 * Every read path here is audience-aware — callers must not hand raw Prisma rows to
 * clients without going through serializeStatus().
 */

export const AUDIENCE = {
  PUBLIC: "PUBLIC",
  FOLLOWERS: "FOLLOWERS",
  CLOSE_FRIENDS: "CLOSE_FRIENDS",
};

export const STATUS_TYPES = ["text", "image", "video", "shared_post"];

// A single story item may not exceed this. Longer uploads are rejected rather than
// silently truncated by the viewer, which is what used to happen client-side.
export const MAX_ITEM_DURATION_MS = 60_000;
export const MAX_TEXT_LENGTH = 700;
export const MAX_CAPTION_LENGTH = 500;
export const STORY_TTL_MS = 24 * 60 * 60 * 1000;

const AUTHOR_SELECT = {
  id: true,
  username: true,
  name: true,
  profilePicture: true,
  avatar: true,
  blueTick: true,
  goldenTick: true,
};

/* ------------------------------------------------------------------ helpers */

/**
 * The follow graph, close friends and mute lists are all JSON arrays on User.
 * Historically they hold either bare id strings or objects, so normalise both.
 */
export function normalizeIdList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      if (entry) out.push(entry);
    } else if (entry && typeof entry === "object") {
      const id = entry.id || entry.userId || entry.user?.id || entry.user;
      if (typeof id === "string" && id) out.push(id);
    }
  }
  return out;
}

/** blockedUsers entries appear as {user}, {user:{id}} or {userId}. */
export function normalizeBlockedList(value) {
  return normalizeIdList(value);
}

/**
 * Resolve the set of authors a viewer may see stories from, in a fixed number of
 * queries. Replaces the old per-status enforceBlockingRules() loop, which issued
 * two queries per row.
 */
export async function getViewerContext(viewerId) {
  const viewer = await prisma.user.findUnique({
    where: { id: viewerId },
    select: {
      id: true,
      following: true,
      blockedUsers: true,
      mutedStoryUserIds: true,
      closeFriends: true,
    },
  });

  if (!viewer) return null;

  const following = new Set(normalizeIdList(viewer.following));
  const muted = new Set(normalizeIdList(viewer.mutedStoryUserIds));
  const iBlocked = new Set(normalizeBlockedList(viewer.blockedUsers));

  return { viewerId, following, muted, iBlocked };
}

/**
 * Of the given authors, drop any who have blocked the viewer. One query for all of
 * them rather than one per author.
 */
async function dropAuthorsWhoBlockedViewer(authorIds, viewerId) {
  if (authorIds.length === 0) return [];

  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, blockedUsers: true },
  });

  return authors
    .filter((a) => !normalizeBlockedList(a.blockedUsers).includes(viewerId))
    .map((a) => a.id);
}

/**
 * Authors whose stories belong in this viewer's feed: the people they follow plus
 * themselves, minus muted authors and minus blocks in either direction.
 */
export async function resolveFeedAuthorIds(ctx) {
  const candidates = [...ctx.following, ctx.viewerId].filter(
    (id) => id === ctx.viewerId || (!ctx.muted.has(id) && !ctx.iBlocked.has(id)),
  );

  const unique = [...new Set(candidates)];
  return dropAuthorsWhoBlockedViewer(unique, ctx.viewerId);
}

/**
 * Audience check for a single status. The feed query already scopes by author, so
 * this is the second gate — and the only gate for direct fetches by id, which is why
 * it must re-check blocking in both directions rather than trusting the caller.
 *
 * @param author {{ closeFriends?: unknown, blockedUsers?: unknown }|null}
 */
export function canViewerSee(status, ctx, author = null) {
  if (!ctx) return false;
  if (status.userId === ctx.viewerId) return true;

  const hiddenFrom = normalizeIdList(status.hiddenFromUserIds);
  if (hiddenFrom.includes(ctx.viewerId)) return false;

  // Blocked in either direction: the viewer blocked the author, or the author
  // blocked the viewer. Omitting the second check would let a blocked user read,
  // react to and reply to the blocker's stories by id.
  if (ctx.iBlocked.has(status.userId)) return false;
  if (normalizeBlockedList(author?.blockedUsers).includes(ctx.viewerId)) return false;

  switch (status.audience) {
    case AUDIENCE.PUBLIC:
      return true;
    case AUDIENCE.CLOSE_FRIENDS:
      return normalizeIdList(author?.closeFriends).includes(ctx.viewerId);
    case AUDIENCE.FOLLOWERS:
    default:
      // The viewer must follow the author.
      return ctx.following.has(status.userId);
  }
}

/**
 * Client-facing shape. Counts are exposed to everyone; the identities behind them
 * are author-only and live on GET /:id/viewers.
 */
export function serializeStatus(status, viewerId) {
  const isOwn = status.userId === viewerId;
  const myReaction =
    status.statusReactions?.find((r) => r.userId === viewerId)?.emoji ?? null;

  const base = {
    id: status.id,
    userId: status.userId,
    user: status.users ?? null,
    type: status.type,
    content: status.content,
    caption: status.caption,
    backgroundColor: status.backgroundColor,
    font: status.font,
    audience: status.audience,
    durationMs: status.durationMs,
    thumbnailUrl: status.thumbnailUrl,
    mediaWidth: status.mediaWidth,
    mediaHeight: status.mediaHeight,
    mentions: status.mentions ?? null,
    stickers: status.stickers ?? null,
    linkClickCount: status.linkClickCount ?? 0,
    viewCount: status.viewCount,
    reactionCount: status.reactionCount,
    replyCount: status.replyCount,
    myReaction,
    hasViewed: Boolean(status.views?.length),
    isOwn,
    expiresAt: status.expiresAt,
    createdAt: status.createdAt,
    updatedAt: status.updatedAt,
  };

  if (status.type === "shared_post") {
    const original = status.originalContent ?? {};
    const meta = status.shareMetadata ?? {};
    base.sharedPostId = status.sharedPostId ?? null;
    base.sharedPostData = {
      originalPost: {
        id: status.posts?.id ?? original.originalId ?? null,
        content: status.posts?.text ?? original.text ?? null,
        media: status.posts?.media ?? original.media ?? null,
        type: status.posts?.type ?? original.type ?? null,
        creator: status.posts?.users_posts_userIdTouser ?? original.creator ?? null,
        createdAt: status.posts?.createdAt ?? original.createdAt ?? null,
      },
      shareInfo: {
        sharedAt: meta.sharedAt ?? status.createdAt,
        sharedBy: status.users ?? null,
        commentary: status.content || null,
      },
    };
  }

  return base;
}

/* --------------------------------------------------------------------- feed */

/**
 * Grouped, paginated story feed.
 *
 * Pagination is per-author (page/limit matches the convention used by the posts
 * feed). Authors are ordered by their most recent item; the viewer's own stories
 * are hoisted to the front by the caller-facing sort below.
 */
export async function getFeed(viewerId, { page = 1, limit = 20 } = {}) {
  const ctx = await getViewerContext(viewerId);
  if (!ctx) return { groups: [], page, limit, hasMore: false };

  const authorIds = await resolveFeedAuthorIds(ctx);
  if (authorIds.length === 0) return { groups: [], page, limit, hasMore: false };

  const now = new Date();
  const where = { userId: { in: authorIds }, expiresAt: { gt: now } };

  // Which authors actually have live stories, most-recent first.
  const authorPage = await prisma.status.groupBy({
    by: ["userId"],
    where,
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: limit + 1,
    skip: (page - 1) * limit,
  });

  const hasMore = authorPage.length > limit;
  const pagedAuthorIds = authorPage.slice(0, limit).map((a) => a.userId);
  if (pagedAuthorIds.length === 0) {
    return { groups: [], page, limit, hasMore: false };
  }

  const [items, authors] = await Promise.all([
    prisma.status.findMany({
      where: { userId: { in: pagedAuthorIds }, expiresAt: { gt: now } },
      include: {
        users: { select: AUTHOR_SELECT },
        posts: {
          include: { users_posts_userIdTouser: { select: AUTHOR_SELECT } },
        },
        // Only the viewer's own view/reaction rows, so seen state is per-request
        // and we never leak other viewers' identities into the feed payload.
        views: { where: { viewerId }, select: { id: true } },
        statusReactions: { where: { userId: viewerId }, select: { emoji: true, userId: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { id: { in: pagedAuthorIds } },
      select: { id: true, closeFriends: true, blockedUsers: true },
    }),
  ]);

  const authorById = new Map(authors.map((a) => [a.id, a]));

  const grouped = new Map();
  for (const item of items) {
    if (!canViewerSee(item, ctx, authorById.get(item.userId))) continue;

    if (!grouped.has(item.userId)) {
      grouped.set(item.userId, {
        user: item.users,
        userId: item.userId,
        isOwn: item.userId === viewerId,
        items: [],
      });
    }
    grouped.get(item.userId).items.push(serializeStatus(item, viewerId));
  }

  const groups = [...grouped.values()].map((g) => {
    const firstUnseenIndex = g.items.findIndex((i) => !i.hasViewed);
    const unseenCount = g.items.filter((i) => !i.hasViewed).length;
    return {
      ...g,
      hasUnseen: unseenCount > 0,
      unseenCount,
      // Where the viewer should resume. -1 (all seen) restarts from the top.
      firstUnseenIndex: firstUnseenIndex === -1 ? 0 : firstUnseenIndex,
      latestAt: g.items[g.items.length - 1]?.createdAt ?? null,
    };
  });

  // Own story first, then unseen, then most recent.
  groups.sort((a, b) => {
    if (a.isOwn !== b.isOwn) return a.isOwn ? -1 : 1;
    if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
    return new Date(b.latestAt) - new Date(a.latestAt);
  });

  return { groups, page, limit, hasMore };
}

/** Single status, audience-checked. Returns null when not visible or expired. */
export async function getStatusForViewer(statusId, viewerId) {
  const ctx = await getViewerContext(viewerId);
  if (!ctx) return null;

  const status = await prisma.status.findUnique({
    where: { id: statusId },
    include: {
      users: { select: { ...AUTHOR_SELECT, closeFriends: true, blockedUsers: true } },
      posts: { include: { users_posts_userIdTouser: { select: AUTHOR_SELECT } } },
      views: { where: { viewerId }, select: { id: true } },
      statusReactions: { where: { userId: viewerId }, select: { emoji: true, userId: true } },
    },
  });

  if (!status) return null;
  if (status.expiresAt <= new Date() && status.userId !== viewerId) return null;

  if (!canViewerSee(status, ctx, status.users)) return null;

  // Never let the audience/moderation lists reach a client.
  if (status.users) {
    delete status.users.closeFriends;
    delete status.users.blockedUsers;
  }
  return serializeStatus(status, viewerId);
}

/** The author's own stories, with the engagement numbers only they should see. */
export async function getOwnStories(userId, { includeExpired = false } = {}) {
  const where = { userId };
  if (!includeExpired) where.expiresAt = { gt: new Date() };

  const items = await prisma.status.findMany({
    where,
    include: {
      users: { select: AUTHOR_SELECT },
      posts: { include: { users_posts_userIdTouser: { select: AUTHOR_SELECT } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return items.map((s) => serializeStatus(s, userId));
}

/* -------------------------------------------------------------------- views */

/**
 * Record views idempotently. Safe to call repeatedly with the same ids — the unique
 * constraint on (statusId, viewerId) collapses duplicates, and viewCount is then
 * recomputed from the table rather than blindly incremented.
 */
export async function markViewed(viewerId, statusIds) {
  const ids = [...new Set((statusIds || []).filter(Boolean))].slice(0, 100);
  if (ids.length === 0) return { recorded: 0 };

  const ctx = await getViewerContext(viewerId);
  if (!ctx) return { recorded: 0 };

  const candidates = await prisma.status.findMany({
    where: { id: { in: ids }, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      userId: true,
      audience: true,
      hiddenFromUserIds: true,
      users: { select: { closeFriends: true, blockedUsers: true } },
    },
  });

  // A viewer must not be able to register a view on a story they cannot see.
  const visible = candidates.filter(
    (s) => s.userId !== viewerId && canViewerSee(s, ctx, s.users),
  );
  if (visible.length === 0) return { recorded: 0 };

  await prisma.statusView.createMany({
    data: visible.map((s) => ({ statusId: s.id, viewerId })),
    skipDuplicates: true,
  });

  await syncCounters(visible.map((s) => s.id));
  return { recorded: visible.length };
}

/** Re-derive the denormalised counters from their source tables. */
async function syncCounters(statusIds) {
  if (!statusIds?.length) return;
  const [views, reactions] = await Promise.all([
    prisma.statusView.groupBy({
      by: ["statusId"],
      where: { statusId: { in: statusIds } },
      _count: { _all: true },
    }),
    prisma.statusReaction.groupBy({
      by: ["statusId"],
      where: { statusId: { in: statusIds } },
      _count: { _all: true },
    }),
  ]);

  const viewMap = new Map(views.map((v) => [v.statusId, v._count._all]));
  const reactMap = new Map(reactions.map((r) => [r.statusId, r._count._all]));

  await prisma.$transaction(
    statusIds.map((id) =>
      prisma.status.update({
        where: { id },
        data: {
          viewCount: viewMap.get(id) ?? 0,
          reactionCount: reactMap.get(id) ?? 0,
        },
      }),
    ),
  );
}

/** Viewer list for a story. Author only — enforced by the caller passing authorId. */
export async function getViewers(statusId, authorId, { page = 1, limit = 30 } = {}) {
  const status = await prisma.status.findUnique({
    where: { id: statusId },
    select: { id: true, userId: true },
  });
  if (!status) return { error: "NOT_FOUND" };
  if (status.userId !== authorId) return { error: "FORBIDDEN" };

  const [rows, total, reactions] = await Promise.all([
    prisma.statusView.findMany({
      where: { statusId },
      include: { viewer: { select: AUTHOR_SELECT } },
      orderBy: { viewedAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.statusView.count({ where: { statusId } }),
    prisma.statusReaction.findMany({
      where: { statusId },
      select: { userId: true, emoji: true },
    }),
  ]);

  const reactionByUser = new Map(reactions.map((r) => [r.userId, r.emoji]));

  return {
    viewers: rows.map((r) => ({
      user: r.viewer,
      viewedAt: r.viewedAt,
      reaction: reactionByUser.get(r.viewerId) ?? null,
    })),
    total,
    page,
    limit,
    hasMore: page * limit < total,
  };
}

/* ---------------------------------------------------------------- reactions */

/** One reaction per user per story; re-reacting replaces rather than appends. */
export async function setReaction(statusId, userId, emoji) {
  const status = await prisma.status.findUnique({
    where: { id: statusId },
    select: { id: true, userId: true, type: true, content: true, expiresAt: true },
  });
  if (!status) return { error: "NOT_FOUND" };
  if (status.expiresAt <= new Date()) return { error: "EXPIRED" };

  const reaction = await prisma.statusReaction.upsert({
    where: { statusId_userId: { statusId, userId } },
    create: { statusId, userId, emoji, updatedAt: new Date() },
    update: { emoji, updatedAt: new Date() },
  });

  await syncCounters([statusId]);

  await createNotification({
    recipientId: status.userId,
    senderId: userId,
    type: "STATUS_REACTION",
    title: "New story reaction",
    message: `reacted ${emoji} to your story`,
    entityId: statusId,
    entityType: "STATUS",
    metadata: { emoji },
  });

  return { reaction };
}

export async function removeReaction(statusId, userId) {
  await prisma.statusReaction.deleteMany({ where: { statusId, userId } });
  await syncCounters([statusId]);
  return { success: true };
}

/* ------------------------------------------------------------------ replies */

/**
 * A story reply is a direct message carrying the story as context, so it lands in
 * the existing chat thread rather than a parallel inbox. Mirrors the direct-chat
 * dedupe in routes/enhancedChatRoutes.js.
 */
export async function replyToStatus(statusId, senderId, text) {
  const status = await prisma.status.findUnique({
    where: { id: statusId },
    select: {
      id: true,
      userId: true,
      type: true,
      content: true,
      caption: true,
      thumbnailUrl: true,
      expiresAt: true,
    },
  });
  if (!status) return { error: "NOT_FOUND" };
  if (status.userId === senderId) return { error: "SELF_REPLY" };
  if (status.expiresAt <= new Date()) return { error: "EXPIRED" };

  const participants = [senderId, status.userId];

  const existingChats = await prisma.chat.findMany({
    where: {
      isGroup: false,
      AND: participants.map((id) => ({ members: { some: { userId: id } } })),
    },
    include: { members: true },
  });

  let chat = existingChats.find((c) => c.members.length === 2);

  if (!chat) {
    chat = await prisma.chat.create({
      data: {
        isGroup: false,
        updatedAt: new Date(),
        members: { create: participants.map((id) => ({ userId: id })) },
      },
      include: { members: true },
    });
  }

  const message = await prisma.enhancedMessage.create({
    data: {
      chatId: chat.id,
      senderId,
      receiverId: status.userId,
      messageType: "story_reply",
      content: text,
      status: "sent",
      updatedAt: new Date(),
      metadata: {
        statusId: status.id,
        statusType: status.type,
        statusMedia: status.type === "text" ? null : status.content,
        statusText: status.type === "text" ? status.content : status.caption,
        statusThumbnail: status.thumbnailUrl,
        statusAuthorId: status.userId,
      },
    },
    include: { sender: { select: AUTHOR_SELECT } },
  });

  await prisma.$transaction([
    prisma.chat.update({
      where: { id: chat.id },
      data: { lastMessageId: message.id, updatedAt: new Date() },
    }),
    prisma.status.update({
      where: { id: statusId },
      data: { replyCount: { increment: 1 } },
    }),
  ]);

  await createNotification({
    recipientId: status.userId,
    senderId,
    type: "STATUS_REPLY",
    title: "New story reply",
    message: text.slice(0, 120),
    entityId: statusId,
    entityType: "STATUS",
    metadata: { chatId: chat.id, messageId: message.id },
  });

  return { message, chat };
}

/* -------------------------------------------------------------------- mutes */

export async function setMuted(viewerId, targetUserId, muted) {
  const viewer = await prisma.user.findUnique({
    where: { id: viewerId },
    select: { mutedStoryUserIds: true },
  });
  if (!viewer) return { error: "NOT_FOUND" };

  const current = new Set(normalizeIdList(viewer.mutedStoryUserIds));
  if (muted) current.add(targetUserId);
  else current.delete(targetUserId);

  await prisma.user.update({
    where: { id: viewerId },
    data: { mutedStoryUserIds: [...current] },
  });

  return { muted: [...current] };
}

/* ------------------------------------------------------------------- delete */

/**
 * Delete a story and its Cloudinary asset. The asset is skipped when the media is
 * still referenced by a highlight.
 */
export async function deleteStatus(statusId, userId) {
  const status = await prisma.status.findFirst({
    where: { id: statusId, userId },
    select: {
      id: true,
      cloudinaryPublicId: true,
      cloudinaryResourceType: true,
      highlightItems: { select: { id: true } },
    },
  });
  if (!status) return { error: "NOT_FOUND" };

  const stillHighlighted = status.highlightItems.length > 0;

  await prisma.status.delete({ where: { id: statusId } });

  if (status.cloudinaryPublicId && !stillHighlighted) {
    try {
      await deleteFromCloudinary(
        status.cloudinaryPublicId,
        status.cloudinaryResourceType || "image",
      );
    } catch (err) {
      // The row is already gone; a stranded asset is cleaned up by the expiry job.
      console.error("Cloudinary delete failed for status", statusId, err.message);
    }
  }

  return { success: true, mediaRetained: stillHighlighted };
}


/* ----------------------------------------------------------- close friends */

/**
 * The close-friends list is story-scoped: it only affects who can see a
 * CLOSE_FRIENDS story. Stored as a JSON array of user ids, matching the existing
 * followers/following/blockedUsers convention on User.
 */
export async function getCloseFriends(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { closeFriends: true },
  });
  if (!user) return { error: "NOT_FOUND" };

  const ids = normalizeIdList(user.closeFriends);
  if (ids.length === 0) return { closeFriends: [] };

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: AUTHOR_SELECT,
  });

  // Preserve the caller's ordering; findMany does not guarantee it.
  const byId = new Map(users.map((u) => [u.id, u]));
  return { closeFriends: ids.map((id) => byId.get(id)).filter(Boolean) };
}

export async function setCloseFriends(userId, userIds) {
  const requested = [...new Set(normalizeIdList(userIds))].filter((id) => id !== userId);

  // Only keep ids that resolve to real accounts, so the list cannot silently rot.
  const existing = await prisma.user.findMany({
    where: { id: { in: requested } },
    select: { id: true },
  });
  const valid = existing.map((u) => u.id);

  await prisma.user.update({
    where: { id: userId },
    data: { closeFriends: valid },
  });

  return getCloseFriends(userId);
}

export async function updateCloseFriend(userId, targetUserId, include) {
  if (targetUserId === userId) return { error: "SELF" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { closeFriends: true },
  });
  if (!user) return { error: "NOT_FOUND" };

  const current = new Set(normalizeIdList(user.closeFriends));

  if (include) {
    const exists = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!exists) return { error: "NOT_FOUND" };
    current.add(targetUserId);
  } else {
    current.delete(targetUserId);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { closeFriends: [...current] },
  });

  return getCloseFriends(userId);
}

/* --------------------------------------------------------------- highlights */

const HIGHLIGHT_INCLUDE = {
  items: {
    orderBy: { position: "asc" },
    include: {
      status: {
        include: { users: { select: AUTHOR_SELECT } },
      },
    },
  },
};

/**
 * A highlight item renders from the live status when it still exists, and from the
 * snapshot taken at pin time once the status has been purged. That is what lets a
 * highlight outlive the 24h window.
 */
function serializeHighlight(highlight, viewerId) {
  return {
    id: highlight.id,
    userId: highlight.userId,
    title: highlight.title,
    coverUrl: highlight.coverUrl,
    position: highlight.position,
    itemCount: highlight.items.length,
    createdAt: highlight.createdAt,
    updatedAt: highlight.updatedAt,
    items: highlight.items.map((item) => ({
      id: item.id,
      position: item.position,
      statusId: item.statusId,
      status: item.status
        ? serializeStatus(item.status, viewerId)
        : (item.snapshot ?? null),
      isSnapshot: !item.status,
    })),
  };
}

export async function getHighlights(ownerId, viewerId) {
  const highlights = await prisma.statusHighlight.findMany({
    where: { userId: ownerId },
    include: HIGHLIGHT_INCLUDE,
    orderBy: { position: "asc" },
  });

  return { highlights: highlights.map((h) => serializeHighlight(h, viewerId)) };
}

/** Copy enough of a status to render it after the original is gone. */
function snapshotOf(status) {
  return {
    id: status.id,
    type: status.type,
    content: status.content,
    caption: status.caption,
    backgroundColor: status.backgroundColor,
    font: status.font,
    thumbnailUrl: status.thumbnailUrl,
    durationMs: status.durationMs,
    mediaWidth: status.mediaWidth,
    mediaHeight: status.mediaHeight,
    createdAt: status.createdAt,
  };
}

export async function createHighlight(userId, { title, coverUrl, statusIds = [] }) {
  const owned = await prisma.status.findMany({
    where: { id: { in: normalizeIdList(statusIds) }, userId },
  });

  const last = await prisma.statusHighlight.findFirst({
    where: { userId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const highlight = await prisma.statusHighlight.create({
    data: {
      userId,
      title: title.trim(),
      coverUrl: coverUrl ?? owned[0]?.thumbnailUrl ?? owned[0]?.content ?? null,
      position: (last?.position ?? -1) + 1,
      updatedAt: new Date(),
      items: {
        create: owned.map((status, index) => ({
          statusId: status.id,
          position: index,
          snapshot: snapshotOf(status),
        })),
      },
    },
    include: HIGHLIGHT_INCLUDE,
  });

  return { highlight: serializeHighlight(highlight, userId) };
}

export async function updateHighlight(userId, highlightId, { title, coverUrl, position }) {
  const existing = await prisma.statusHighlight.findFirst({
    where: { id: highlightId, userId },
    select: { id: true },
  });
  if (!existing) return { error: "NOT_FOUND" };

  const highlight = await prisma.statusHighlight.update({
    where: { id: highlightId },
    data: {
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(coverUrl !== undefined ? { coverUrl } : {}),
      ...(Number.isInteger(position) ? { position } : {}),
      updatedAt: new Date(),
    },
    include: HIGHLIGHT_INCLUDE,
  });

  return { highlight: serializeHighlight(highlight, userId) };
}

export async function deleteHighlight(userId, highlightId) {
  const result = await prisma.statusHighlight.deleteMany({
    where: { id: highlightId, userId },
  });
  if (result.count === 0) return { error: "NOT_FOUND" };
  return { success: true };
}

export async function addHighlightItems(userId, highlightId, statusIds) {
  const highlight = await prisma.statusHighlight.findFirst({
    where: { id: highlightId, userId },
    include: { items: { select: { statusId: true }, orderBy: { position: "desc" } } },
  });
  if (!highlight) return { error: "NOT_FOUND" };

  const already = new Set(highlight.items.map((i) => i.statusId));
  const owned = await prisma.status.findMany({
    where: { id: { in: normalizeIdList(statusIds) }, userId },
  });
  const fresh = owned.filter((s) => !already.has(s.id));

  if (fresh.length > 0) {
    const start = highlight.items.length;
    await prisma.statusHighlightItem.createMany({
      data: fresh.map((status, index) => ({
        highlightId,
        statusId: status.id,
        position: start + index,
        snapshot: snapshotOf(status),
      })),
      skipDuplicates: true,
    });
  }

  const updated = await prisma.statusHighlight.findUnique({
    where: { id: highlightId },
    include: HIGHLIGHT_INCLUDE,
  });

  return { highlight: serializeHighlight(updated, userId), added: fresh.length };
}

export async function removeHighlightItem(userId, highlightId, itemId) {
  const highlight = await prisma.statusHighlight.findFirst({
    where: { id: highlightId, userId },
    select: { id: true },
  });
  if (!highlight) return { error: "NOT_FOUND" };

  const result = await prisma.statusHighlightItem.deleteMany({
    where: { id: itemId, highlightId },
  });
  if (result.count === 0) return { error: "NOT_FOUND" };

  const updated = await prisma.statusHighlight.findUnique({
    where: { id: highlightId },
    include: HIGHLIGHT_INCLUDE,
  });

  return { highlight: serializeHighlight(updated, userId) };
}


/* -------------------------------------------------------------- link clicks */

/**
 * Record a link-sticker tap.
 *
 * Stored per click rather than only counted: an arbitrary destination over a
 * full-screen image is a phishing surface, and a per-click record is what makes abuse
 * detectable — for example a link tapped far more often than the story was viewed, or
 * one destination appearing across many unrelated accounts.
 */
export async function recordLinkClick(statusId, viewerId, url) {
  await prisma.statusLinkClick.create({
    data: { statusId, viewerId, url },
  });

  const updated = await prisma.status.update({
    where: { id: statusId },
    data: { linkClickCount: { increment: 1 } },
    select: { linkClickCount: true },
  });

  return { linkClickCount: updated.linkClickCount };
}

/** Click totals for the author's own story. */
export async function getLinkClickStats(statusId, authorId) {
  const status = await prisma.status.findUnique({
    where: { id: statusId },
    select: { id: true, userId: true, linkClickCount: true },
  });
  if (!status) return { error: "NOT_FOUND" };
  if (status.userId !== authorId) return { error: "FORBIDDEN" };

  const uniqueViewers = await prisma.statusLinkClick.findMany({
    where: { statusId },
    distinct: ["viewerId"],
    select: { viewerId: true },
  });

  return {
    totalClicks: status.linkClickCount,
    uniqueClickers: uniqueViewers.length,
  };
}

export default {
  AUDIENCE,
  STATUS_TYPES,
  MAX_ITEM_DURATION_MS,
  MAX_TEXT_LENGTH,
  MAX_CAPTION_LENGTH,
  STORY_TTL_MS,
  normalizeIdList,
  getViewerContext,
  resolveFeedAuthorIds,
  canViewerSee,
  serializeStatus,
  getFeed,
  getStatusForViewer,
  getOwnStories,
  markViewed,
  getViewers,
  setReaction,
  removeReaction,
  replyToStatus,
  setMuted,
  deleteStatus,
  getCloseFriends,
  setCloseFriends,
  updateCloseFriend,
  getHighlights,
  createHighlight,
  updateHighlight,
  deleteHighlight,
  addHighlightItems,
  removeHighlightItem,
  recordLinkClick,
  getLinkClickStats,
};
