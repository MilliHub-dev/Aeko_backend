import { prisma } from "../config/db.js";

/**
 * Create a new notification
 * @param {Object} data - Notification data
 * @param {string} data.recipientId - ID of the user receiving the notification
 * @param {string} [data.senderId] - ID of the user triggering the notification (optional)
 * @param {string} data.type - Type of notification (FOLLOW, LIKE, COMMENT, MENTION, SYSTEM, etc.)
 * @param {string} [data.title] - Notification title
 * @param {string} [data.message] - Notification message body
 * @param {string} [data.entityId] - ID of the related entity
 * @param {string} [data.entityType] - Type of the related entity
 * @param {Object} [data.metadata] - Additional metadata
 */
export const createNotification = async ({
  recipientId,
  senderId,
  type,
  title,
  message,
  entityId,
  entityType,
  metadata
}) => {
  try {
    // Don't create notification if user notifies themselves
    if (senderId && recipientId === senderId) {
      return null;
    }

    const notification = await prisma.notification.create({
      data: {
        recipientId,
        senderId,
        type,
        title,
        message,
        entityId,
        entityType,
        metadata,
        read: false
      }
    });

    // Send Push Notification
    await sendPushNotification(recipientId, notification);

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    // Don't throw error to prevent blocking the main action
    return null;
  }
};

/**
 * Delete notifications related to an entity (cleanup)
 * @param {string} entityId - ID of the entity being deleted
 */
export const deleteEntityNotifications = async (entityId) => {
  try {
    await prisma.notification.deleteMany({
      where: { entityId }
    });
  } catch (error) {
    console.error('Error deleting entity notifications:', error);
  }
};

/**
 * Process mentions in text and create notifications
 * @param {Object} params
 * @param {string} params.text - Text content to parse
 * @param {string} params.senderId - ID of user creating the content
 * @param {string} params.entityId - ID of the entity (post/comment)
 * @param {string} params.entityType - Type of entity (POST/COMMENT)
 * @param {string} [params.postId] - ID of the post (if entity is comment)
 */
export const processMentions = async ({ text, senderId, entityId, entityType, postId }) => {
    if (!text) return;
    
    // Extract usernames from @mentions
    const mentionRegex = /@(\w+)/g;
    const matches = [...text.matchAll(mentionRegex)];
    const usernames = [...new Set(matches.map(m => m[1]))]; // Unique usernames

    if (usernames.length === 0) return;

    // Find users
    const users = await prisma.user.findMany({
        where: { username: { in: usernames } },
        select: { id: true, username: true }
    });

    // Get sender info
    const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { username: true, name: true }
    });
    
    const senderName = sender?.username || sender?.name || 'Someone';

    // Create notifications
    const notifications = users.map(user => {
        // Don't notify self
        if (user.id === senderId) return null;

        return createNotification({
            recipientId: user.id,
            senderId,
            type: 'MENTION',
            title: 'New Mention',
            message: `${senderName} mentioned you in a ${entityType.toLowerCase()}`,
            entityId,
            entityType,
            metadata: {
                postId: postId || entityId, // Ensure we can link to the post
                preview: text.substring(0, 50)
            }
        });
    });

    await Promise.all(notifications);
};

/**
 * Send push notification (Mobile)
 * @param {string} userId - Recipient ID
 * @param {Object} notification - Notification object or data
 */
export const sendPushNotification = async (userId, notification) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true, notificationSettings: true }
    });

    if (!user || !user.pushToken) return;

    const settings = user.notificationSettings || {};
    
    // Check Global Controls
    if (settings.global?.pauseAll) return;
    
    // Check Categories
    const type = notification.type; 
    let shouldSend = true;

    if (settings.interactions) {
        if (type === 'LIKE' && settings.interactions.likes === false) shouldSend = false;
        if (type === 'COMMENT' && settings.interactions.comments === false) shouldSend = false;
        if (type === 'MENTION' && settings.interactions.mentions === false) shouldSend = false;
        if (type === 'TAG' && settings.interactions.tags === false) shouldSend = false;
    }
    
    if (settings.network) {
        if (type === 'FOLLOW' && settings.network.newFollowers === false) shouldSend = false;
    }

    if (!shouldSend) return;

    console.log(`[PUSH] Sending to ${userId} (${user.pushToken}): ${notification.title} - ${notification.message}`);
    
    // TODO: Integrate FCM/OneSignal here
    // const payload = {
    //   token: user.pushToken,
    //   notification: {
    //     title: notification.title,
    //     body: notification.message
    //   },
    //   data: notification.metadata
    // };
    // await sendToPushProvider(payload);

  } catch (error) {
    console.error('Error sending push notification:', error);
  }
};
