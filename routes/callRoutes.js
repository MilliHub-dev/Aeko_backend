import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { prisma } from '../config/db.js';
import { protect } from '../middleware/authMiddleware.js';

/**
 * Call history.
 *
 * Nothing anywhere recorded a call, so the app's call-history screen had no data
 * to show and was permanently empty. It tried to reconstruct history by fetching
 * every conversation and then every conversation's messages (51 requests) and
 * filtering for call entries that were never written in the first place.
 *
 * A call is stored as an `EnhancedMessage` with `messageType: "call"` rather than
 * in a separate table: it needs no migration, and it means a call also appears
 * inline in the conversation, which is what `CallMessageBubble` already renders.
 * The call details live in `metadata.call`.
 */

const router = express.Router();

const VALID_STATUSES = ['completed', 'missed', 'declined', 'ongoing'];

const userSelect = {
  id: true,
  name: true,
  username: true,
  profilePicture: true,
  blueTick: true,
  goldenTick: true, prideTick: true, businessTick: true,
};

const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({
    success: false,
    message: errors.array()[0]?.msg || 'Invalid request',
    code: 'VALIDATION_FAILED',
  });
  return true;
};

/**
 * Rows written before `callData` was persisted carry their outcome only in the
 * human-readable `content`. Reading it back keeps existing history visible
 * instead of showing every past call as a plain completed one.
 */
const statusFromContent = (content) => {
  const text = String(content || '').toLowerCase();
  if (text.includes('missed')) return 'missed';
  if (text.includes('declined') || text.includes('rejected')) return 'declined';
  if (text.includes('call')) return 'completed';
  return 'completed';
};

/** Shapes a stored row into what the app's call history renders. */
const toCallEntry = (message, currentUserId) => {
  const call = message.metadata?.call || {};
  const isOutgoing = message.senderId === currentUserId;
  const other = isOutgoing ? message.receiver : message.sender;

  return {
    id: message.id,
    _id: message.id,
    chatId: message.chatId,
    conversationId: message.chatId,
    callType: call.isVideo ? 'video' : 'audio',
    status: call.status || statusFromContent(message.content),
    duration: call.duration ?? 0,
    isOutgoing,
    timestamp: message.createdAt,
    createdAt: message.createdAt,
    otherUserId: other?.id || null,
    otherUserName: other?.name || other?.username || 'Unknown',
    otherUserAvatar: other?.profilePicture || null,
    otherUser: other || null,
  };
};

/**
 * GET /api/calls — the signed-in user's call history, newest first.
 *
 * Replaces the client's fan-out over every conversation with one indexed query.
 */
router.get(
  '/',
  protect,
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('page').optional().isInt({ min: 1 }),
  async (req, res) => {
    if (handleValidation(req, res)) return;

    try {
      const userId = req.user.id;
      const limit = Math.min(100, Number(req.query.limit) || 30);
      const page = Math.max(1, Number(req.query.page) || 1);

      // Restricted to chats the user belongs to; a call row is only ever visible
      // to its participants.
      const memberships = await prisma.chatMember.findMany({
        where: { userId },
        select: { chatId: true },
      });
      const chatIds = memberships.map((m) => m.chatId);

      if (chatIds.length === 0) {
        return res.json({ success: true, calls: [], pagination: { page, limit, total: 0, hasMore: false } });
      }

      const where = {
        messageType: 'call',
        chatId: { in: chatIds },
        deleted: false,
      };

      const [messages, total] = await Promise.all([
        prisma.enhancedMessage.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            sender: { select: userSelect },
            receiver: { select: userSelect },
          },
        }),
        prisma.enhancedMessage.count({ where }),
      ]);

      res.json({
        success: true,
        calls: messages.map((m) => toCallEntry(m, userId)),
        pagination: { page, limit, total, hasMore: page * limit < total },
      });
    } catch (error) {
      console.error('Get call history error:', error);
      res.status(500).json({
        success: false,
        message: 'Could not load your call history.',
        error: process.env.NODE_ENV === 'production' ? undefined : error.message,
      });
    }
  },
);

/**
 * POST /api/calls — record a finished call.
 *
 * Logged by whichever side ends up owning the outcome, so `chatId` is verified
 * against the caller's membership before anything is written.
 */
router.post(
  '/',
  protect,
  body('chatId').notEmpty().withMessage('chatId is required'),
  body('status').isIn(VALID_STATUSES).withMessage(`status must be one of: ${VALID_STATUSES.join(', ')}`),
  body('duration').optional().isInt({ min: 0 }).withMessage('duration must be seconds, as a whole number'),
  body('isVideo').optional().isBoolean(),
  async (req, res) => {
    if (handleValidation(req, res)) return;

    try {
      const userId = req.user.id;
      const { chatId, status, duration = 0, isVideo = false } = req.body;

      const membership = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId, userId } },
      });
      if (!membership) {
        return res.status(403).json({
          success: false,
          message: 'You are not part of that conversation.',
        });
      }

      // For a 1:1 chat the receiver is the other member. Group calls leave it
      // null, exactly as a group message does.
      const others = await prisma.chatMember.findMany({
        where: { chatId, userId: { not: userId } },
        select: { userId: true },
      });
      const receiverId = others.length === 1 ? others[0].userId : null;

      const message = await prisma.enhancedMessage.create({
        data: {
          chatId,
          senderId: userId,
          receiverId,
          messageType: 'call',
          // Kept human-readable so the row still means something in the admin
          // panel and in any client that does not special-case call messages.
          content:
            status === 'missed'
              ? 'Missed call'
              : status === 'declined'
                ? 'Call declined'
                : `${isVideo ? 'Video' : 'Voice'} call`,
          status: 'sent',
          metadata: {
            call: {
              status,
              duration: Number(duration) || 0,
              isVideo: Boolean(isVideo),
              callerId: userId,
            },
          },
        },
        include: {
          sender: { select: userSelect },
          receiver: { select: userSelect },
        },
      });

      // Keeps the conversation list ordered by real activity, so a call moves
      // the thread to the top the way a message does.
      await prisma.chat.update({
        where: { id: chatId },
        // `updatedAt` is @updatedAt, so Prisma bumps it on its own.
        data: { lastMessageId: message.id },
      }).catch((error) => {
        // A failed pointer update must not lose the call record itself.
        console.error('Could not update chat lastMessage after call:', error);
      });

      res.status(201).json({ success: true, call: toCallEntry(message, userId) });
    } catch (error) {
      console.error('Log call error:', error);
      res.status(500).json({
        success: false,
        message: 'Could not save the call.',
        error: process.env.NODE_ENV === 'production' ? undefined : error.message,
      });
    }
  },
);

export default router;
