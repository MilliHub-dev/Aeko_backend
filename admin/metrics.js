import { prisma } from "../config/db.js";

/**
 * Platform metrics for the admin panel.
 *
 * The dashboard and the Analytics page both read from here, so a figure is
 * defined exactly once. Previously every query lived inline in the dashboard
 * handler, which meant a second screen showing the same number would have had
 * to re-implement it — and the two would drift the first time one was fixed.
 *
 * Every metric is run through `Promise.allSettled`: a single failing query
 * degrades one card to "—" instead of taking the whole screen down. Failures
 * are reported back in `failed` so the UI can say which figures are missing
 * rather than silently showing zero, which reads as real data.
 */

const dayMs = 24 * 60 * 60 * 1000;
const since = (days) => new Date(Date.now() - days * dayMs);

/**
 * Groups rows into one bucket per day, filling gaps with zero.
 *
 * Postgres omits days with no rows entirely, so a sparkline built straight
 * from the query would silently compress quiet days and misrepresent the shape
 * of the trend.
 */
const toDailySeries = (rows, days) => {
  const counts = new Map(
    rows.map((row) => [row.day.toISOString().slice(0, 10), Number(row.count)]),
  );
  const series = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(Date.now() - i * dayMs).toISOString().slice(0, 10);
    series.push({ day, count: counts.get(day) ?? 0 });
  }
  return series;
};

const dailyCounts = async (table, days) => {
  // `table` is interpolated into the SQL, so it must never come from user
  // input — every call site below passes a literal.
  const rows = await prisma.$queryRawUnsafe(
    `SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
     FROM "${table}"
     WHERE "createdAt" >= $1
     GROUP BY 1
     ORDER BY 1 ASC`,
    since(days),
  );
  return toDailySeries(rows, days);
};

/**
 * The figures the dashboard landing page shows.
 */
const overviewQueries = (week) => ({
  users: () => prisma.user.count(),
  usersThisWeek: () => prisma.user.count({ where: { createdAt: { gte: week } } }),
  posts: () => prisma.post.count(),
  postsThisWeek: () => prisma.post.count({ where: { createdAt: { gte: week } } }),
  communities: () => prisma.community.count(),
  liveNow: () => prisma.liveStream.count({ where: { status: "live" } }),
  openReports: () => prisma.report.count({ where: { status: "pending" } }),
  openTickets: () =>
    prisma.supportTicket.count({
      where: { status: { in: ["open", "in_progress"] } },
    }),
  waitlist: () => prisma.waitlistEntry.count(),
  recentUsers: () =>
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        username: true,
        profilePicture: true,
        blueTick: true,
        goldenTick: true,
        createdAt: true,
      },
    }),

  // --- Engagement ---------------------------------------------------------
  // `Post.likes` is a JSON array with no Like table, so likes are counted in
  // SQL rather than by pulling every post into Node.
  totalLikes: async () => {
    const rows = await prisma.$queryRaw`
      SELECT COALESCE(SUM(jsonb_array_length(
        CASE WHEN jsonb_typeof("likes") = 'array' THEN "likes" ELSE '[]'::jsonb END
      )), 0)::int AS total
      FROM "posts"
    `;
    return Number(rows[0]?.total ?? 0);
  },
  totalViews: async () => {
    const result = await prisma.post.aggregate({ _sum: { views: true } });
    return result._sum.views ?? 0;
  },
  comments: () => prisma.comment.count(),
  commentsThisWeek: () =>
    prisma.comment.count({ where: { createdAt: { gte: week } } }),
  stickers: () => prisma.sticker.count(),
  messagesThisWeek: () =>
    prisma.enhancedMessage.count({ where: { createdAt: { gte: week } } }),

  // --- Monetisation -------------------------------------------------------
  subscribers: () => prisma.user.count({ where: { subscriptionStatus: "active" } }),
  revenue: async () => {
    const result = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { status: "completed" },
    });
    return result._sum.amount ?? 0;
  },
  pushReach: () => prisma.user.count({ where: { pushToken: { not: null } } }),

  // `Community` has no image column — the avatar lives inside the `profile`
  // JSON blob — and `memberCount` is the denormalised counter the app reads,
  // kept alongside the true relation count.
  topCommunities: () =>
    prisma.community.findMany({
      take: 5,
      orderBy: { community_members: { _count: "desc" } },
      select: {
        id: true,
        name: true,
        memberCount: true,
        _count: { select: { community_members: true } },
      },
    }),

  postTrend: () => dailyCounts("posts", 14),
  signupTrend: () => dailyCounts("users", 14),
});

/**
 * The deeper cuts, for the Analytics page only. Kept separate so the dashboard
 * stays a fast glance and does not pay for queries it never displays.
 *
 * @param {number} days window for the period-scoped figures
 */
const analyticsQueries = (days) => {
  const from = since(days);
  const previousFrom = since(days * 2);

  return {
    // --- Growth -----------------------------------------------------------
    newUsers: () => prisma.user.count({ where: { createdAt: { gte: from } } }),
    // The preceding window of equal length, so the UI can show direction
    // rather than a bare number with nothing to compare against.
    newUsersPrevious: () =>
      prisma.user.count({
        where: { createdAt: { gte: previousFrom, lt: from } },
      }),
    signupSeries: () => dailyCounts("users", days),

    // --- Activity ---------------------------------------------------------
    // "Active" means signed in within the window. `lastLoginAt` is only set on
    // login, so this undercounts anyone holding a valid session without
    // re-authenticating; it is a floor, not an exact figure.
    activeUsers: () =>
      prisma.user.count({ where: { lastLoginAt: { gte: from } } }),
    activeUsersPrevious: () =>
      prisma.user.count({
        where: { lastLoginAt: { gte: previousFrom, lt: from } },
      }),
    postSeries: () => dailyCounts("posts", days),
    commentSeries: () => dailyCounts("comments", days),

    newPosts: () => prisma.post.count({ where: { createdAt: { gte: from } } }),
    newPostsPrevious: () =>
      prisma.post.count({
        where: { createdAt: { gte: previousFrom, lt: from } },
      }),
    newComments: () =>
      prisma.comment.count({ where: { createdAt: { gte: from } } }),
    newMessages: () =>
      prisma.enhancedMessage.count({ where: { createdAt: { gte: from } } }),

    // --- Composition ------------------------------------------------------
    verification: async () => {
      const [blue, golden, pride, business] = await Promise.all([
        prisma.user.count({ where: { blueTick: true } }),
        prisma.user.count({ where: { goldenTick: true } }),
        prisma.user.count({ where: { prideTick: true } }),
        prisma.user.count({ where: { businessTick: true } }),
      ]);
      return { blue, golden, pride, business };
    },
    // There is no `isVerified` boolean on User — only an `emailVerification`
    // JSON blob, whose shape does not reliably mean "verified" — so email
    // verification is deliberately absent here rather than guessed at.
    accountHealth: async () => {
      const [banned, withWallet, withPush, subscribed] = await Promise.all([
        prisma.user.count({ where: { banned: true } }),
        prisma.user.count({ where: { walletAddress: { not: null } } }),
        prisma.user.count({ where: { pushToken: { not: null } } }),
        prisma.user.count({ where: { subscriptionStatus: "active" } }),
      ]);
      return { banned, withWallet, withPush, subscribed };
    },

    // --- Moderation -------------------------------------------------------
    reportsByStatus: () =>
      prisma.report.groupBy({ by: ["status"], _count: { _all: true } }),
    ticketsByStatus: () =>
      prisma.supportTicket.groupBy({ by: ["status"], _count: { _all: true } }),

    // --- Money ------------------------------------------------------------
    revenueInPeriod: async () => {
      const result = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { status: "completed", createdAt: { gte: from } },
      });
      return result._sum.amount ?? 0;
    },
    transactionsByStatus: () =>
      prisma.transaction.groupBy({ by: ["status"], _count: { _all: true } }),

    // --- Leaders ----------------------------------------------------------
    topPosters: async () => {
      const grouped = await prisma.post.groupBy({
        by: ["userId"],
        _count: { _all: true },
        orderBy: { _count: { userId: "desc" } },
        take: 5,
        where: { createdAt: { gte: from } },
      });
      if (grouped.length === 0) return [];

      const users = await prisma.user.findMany({
        where: { id: { in: grouped.map((row) => row.userId) } },
        select: { id: true, name: true, username: true, profilePicture: true },
      });
      const byId = new Map(users.map((user) => [user.id, user]));

      // Ordered by the grouping, not by the findMany, which returns rows in
      // whatever order Postgres hands back.
      return grouped
        .map((row) => ({
          ...(byId.get(row.userId) ?? { id: row.userId, username: "unknown" }),
          posts: row._count._all,
        }))
        .filter(Boolean);
    },
    topCommunities: () =>
      prisma.community.findMany({
        take: 8,
        orderBy: { community_members: { _count: "desc" } },
        select: {
          id: true,
          name: true,
          memberCount: true,
          _count: { select: { community_members: true } },
        },
      }),
  };
};

/**
 * Runs a map of metric functions, isolating failures.
 *
 * @param {Record<string, () => Promise<unknown>>} queries
 * @param {string} label used in logs to identify the calling screen
 */
const settle = async (queries, label) => {
  const keys = Object.keys(queries);
  const settled = await Promise.allSettled(keys.map((key) => queries[key]()));

  const data = {};
  const failed = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      data[keys[i]] = result.value;
    } else {
      failed.push(keys[i]);
      console.error(`[admin ${label}] ${keys[i]} failed:`, result.reason);
      data[keys[i]] = null;
    }
  });

  return { data, failed };
};

/** Figures for the dashboard landing page. */
export const getOverviewMetrics = async ({ adminName = null } = {}) => {
  const { data, failed } = await settle(
    overviewQueries(since(7)),
    "dashboard",
  );
  return {
    ...data,
    failed,
    adminName,
    generatedAt: new Date().toISOString(),
  };
};

/** How many days the Analytics page is allowed to look back. */
export const ANALYTICS_PERIODS = [7, 14, 30, 90];

/** Figures for the Analytics page. */
export const getAnalyticsMetrics = async ({ days = 30 } = {}) => {
  // Clamped to a known set: the value arrives from the client, and it reaches
  // `date_trunc` windows and query ranges.
  const period = ANALYTICS_PERIODS.includes(Number(days)) ? Number(days) : 30;

  const { data, failed } = await settle(analyticsQueries(period), "analytics");
  return {
    ...data,
    period,
    periods: ANALYTICS_PERIODS,
    failed,
    generatedAt: new Date().toISOString(),
  };
};
