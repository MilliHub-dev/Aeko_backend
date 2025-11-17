import Community from "../models/Community.js";
import User from "../models/User.js";
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
    const paidCommunities = await Community.find({
      'settings.payment.isPaidCommunity': true
    }).select('name members settings.payment');
    
    let notificationsSent = 0;
    let notificationsFailed = 0;
    
    for (const community of paidCommunities) {
      // Find members with subscriptions expiring in 7 days
      const expiringMembers = community.members.filter(member => {
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
          const user = await User.findById(member.user).select('email username name');
          
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
  const renewalLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/community/${community._id}/renew`;
  
  const mailOptions = {
    from: `"Aeko" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: `⏰ Your ${community.name} subscription expires in ${daysUntilExpiration} days`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Expiring - Aeko</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5; 
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: white; 
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); 
            color: white; 
            padding: 40px 20px; 
            text-align: center; 
          }
          .content { 
            padding: 30px; 
            line-height: 1.6;
          }
          .expiration-box {
            background-color: #fff3cd;
            border: 2px solid #ffc107;
            border-radius: 10px;
            padding: 20px;
            margin: 25px 0;
            text-align: center;
          }
          .days-remaining {
            font-size: 48px;
            font-weight: bold;
            color: #ff6b6b;
            margin: 10px 0;
          }
          .pricing-box {
            background-color: #f8f9ff;
            border: 2px solid #667eea;
            border-radius: 10px;
            padding: 20px;
            margin: 25px 0;
          }
          .price {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
            margin: 10px 0;
          }
          .button { 
            display: inline-block; 
            padding: 15px 40px; 
            background-color: #667eea; 
            color: white !important; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0; 
            font-weight: 600;
            font-size: 16px;
          }
          .footer { 
            background-color: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            color: #6c757d; 
            border-top: 1px solid #dee2e6;
            font-size: 14px;
          }
          .benefits {
            background-color: #e8f5e9;
            border-left: 4px solid #4caf50;
            padding: 15px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Subscription Expiring Soon</h1>
            <p>Don't lose access to ${community.name}</p>
          </div>
          
          <div class="content">
            <h2>Hi ${user.name || user.username}! 👋</h2>
            
            <p>Your subscription to <strong>${community.name}</strong> is expiring soon.</p>
            
            <div class="expiration-box">
              <p style="margin: 0; font-size: 18px; color: #856404;">⚠️ Time Remaining</p>
              <div class="days-remaining">${daysUntilExpiration}</div>
              <p style="margin: 0; font-size: 16px; color: #856404;">
                ${daysUntilExpiration === 1 ? 'day' : 'days'} until expiration
              </p>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #6c757d;">
                Expires on: ${endDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            
            <div class="benefits">
              <h3 style="margin-top: 0;">🎯 What You'll Lose:</h3>
              <ul style="margin: 10px 0;">
                <li>Access to exclusive community content</li>
                <li>Ability to post and comment</li>
                <li>Member-only discussions and events</li>
                <li>Community chat access</li>
              </ul>
            </div>
            
            <div class="pricing-box">
              <h3 style="margin-top: 0; text-align: center;">💎 Renewal Pricing</h3>
              <div style="text-align: center;">
                <div class="price">${community.settings.payment.currency} ${community.settings.payment.price}</div>
                <p style="color: #6c757d; margin: 5px 0;">
                  ${subscription.type === 'monthly' ? 'per month' : subscription.type === 'yearly' ? 'per year' : 'one-time payment'}
                </p>
                ${community.settings.payment.paymentMethods && community.settings.payment.paymentMethods.length > 0 ? `
                  <p style="color: #6c757d; font-size: 14px; margin: 10px 0;">
                    Payment methods: ${community.settings.payment.paymentMethods.join(', ').replace('aeko_wallet', 'Aeko Wallet').replace('paystack', 'Paystack').replace('stripe', 'Stripe')}
                  </p>
                ` : ''}
              </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${renewalLink}" class="button">🔄 Renew Subscription Now</a>
            </div>
            
            <p style="color: #6c757d; font-size: 14px; text-align: center;">
              Renew now to maintain uninterrupted access to ${community.name}
            </p>
            
            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
            
            <h3>❓ Questions?</h3>
            <p>If you have any questions about your subscription or need assistance with renewal, please contact the community owner or our support team.</p>
          </div>
          
          <div class="footer">
            <p>Need help? Contact us at <a href="mailto:support@aeko.social" style="color: #667eea;">support@aeko.social</a></p>
            <p style="margin-top: 10px; font-size: 12px; color: #999;">
              © ${new Date().getFullYear()} Aeko. All rights reserved.<br>
              You're receiving this email because you have an active subscription to ${community.name}.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };
  
  try {
    await emailService.transporter.sendMail(mailOptions);
    return { success: true, message: 'Expiration notification sent successfully' };
  } catch (error) {
    console.error('Error sending expiration notification:', error);
    return { 
      success: false, 
      message: 'Failed to send expiration notification',
      error: error.message 
    };
  }
}

export default checkExpiringSubscriptions;
