import { prisma } from "../config/db.js";
import emailService from "../services/emailService.js";

/**
 * Check for subscriptions expiring in 7 days and send notifications
 * This function should be called by a scheduled job (e.g., daily)
 */
export async function checkExpiringSubscriptions() {
  try {
    console.log('[Subscription Notifications] Starting expiration check...');
    
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    // Find all paid communities
    // Using Prisma JSON filtering
    const paidCommunities = await prisma.community.findMany({
      where: {
        settings: {
          path: ['payment', 'isPaidCommunity'],
          equals: true
        }
      },
      select: {
        id: true,
        name: true,
        members: true,
        settings: true
      }
    });
    
    let notificationsSent = 0;
    let notificationsFailed = 0;
    
    for (const community of paidCommunities) {
      // Members is a JSON array
      const members = Array.isArray(community.members) ? community.members : [];
      
      // Find members with subscriptions expiring in 7 days
      const expiringMembers = members.filter(member => {
        if (!member.subscription || !member.subscription.isActive) {
          return false;
        }
        
        const endDate = new Date(member.subscription.endDate);
        
        // Check if subscription expires within the next 7 days
        return endDate > now && endDate <= sevenDaysFromNow;
      });
      
      // Send notification to each expiring member
      for (const member of expiringMembers) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: member.user },
            select: { email: true, username: true, name: true }
          });
          
          if (!user || !user.email) {
            console.warn(`[Subscription Notifications] User ${member.user} not found or has no email`);
            continue;
          }
          
          const result = await sendExpirationNotification(user, community, member.subscription);
          
          if (result.success) {
            notificationsSent++;
            
            // Log notification event for analytics
            console.log(`[Subscription Notifications] Sent to ${user.email} for community ${community.name}`);
          } else {
            notificationsFailed++;
            console.error(`[Subscription Notifications] Failed to send to ${user.email}:`, result.message);
          }
        } catch (error) {
          notificationsFailed++;
          console.error(`[Subscription Notifications] Error processing member ${member.user}:`, error);
        }
      }
    }
    
    console.log(`[Subscription Notifications] Check complete. Sent: ${notificationsSent}, Failed: ${notificationsFailed}`);
    
    return {
      success: true,
      notificationsSent,
      notificationsFailed
    };
  } catch (error) {
    console.error('[Subscription Notifications] Error checking expiring subscriptions:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send expiration notification email to user
 */
async function sendExpirationNotification(user, community, subscription) {
  if (!emailService.isAvailable()) {
    return { success: false, message: 'Email service not configured' };
  }
  
  const endDate = new Date(subscription.endDate);
  const daysUntilExpiration = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
  
  // Generate renewal link (adjust based on your frontend URL structure)
  // Used community.id instead of community._id
  const renewalLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/community/${community.id}/renew`;
  
  const mailOptions = {
    from: `"Aeko" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: `⏰ Your ${community.name} subscription expires in ${daysUntilExpiration} days`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px; }
          .header { background-color: #6C5CE7; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { padding: 20px; }
          .button { display: inline-block; background-color: #6C5CE7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { margin-top: 20px; text-align: center; font-size: 12px; color: #888; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Subscription Expiring Soon</h1>
          </div>
          <div class="content">
            <p>Hi ${user.name || user.username},</p>
            <p>Your subscription to the <strong>${community.name}</strong> community will expire in <strong>${daysUntilExpiration} days</strong> on ${endDate.toLocaleDateString()}.</p>
            <p>To keep your access to exclusive content and features, please renew your subscription.</p>
            <center>
              <a href="${renewalLink}" class="button">Renew Subscription</a>
            </center>
            <p>If you have any questions, please reply to this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Aeko. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
  
  return emailService.sendEmail(mailOptions);
}
