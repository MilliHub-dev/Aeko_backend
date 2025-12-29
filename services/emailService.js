import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
  constructor() {
    // Check if MailerSend API key is configured
    if (!process.env.MAILERSEND_API_KEY) {
      console.warn('MailerSend API key not configured. Email functionality will be disabled.');
      this.mailerSend = null;
      return;
    }
    
    this.mailerSend = new MailerSend({
      apiKey: process.env.MAILERSEND_API_KEY,
    });
    
    console.log('✅ MailerSend Email Service Configured');
  }

  // Check if email service is available
  isAvailable() {
    return this.mailerSend !== null;
  }

  // Helper to create common email params
  createEmailParams(toEmail, toName, subject, htmlContent) {
    const sentFrom = new Sender(
      process.env.EMAIL_SENDER_ADDRESS || "noreply@aeko.social",
      process.env.EMAIL_SENDER_NAME || "Aeko"
    );

    const recipients = [
      new Recipient(toEmail, toName)
    ];

    return new EmailParams()
      .setFrom(sentFrom)
      .setTo(recipients)
      .setSubject(subject)
      .setHtml(htmlContent);
  }

  // Send 4-digit verification code
  async sendVerificationCode(email, code, username) {
    // Check if email service is available
    if (!this.isAvailable()) {
      console.warn('Email service not available. Verification code not sent.');
      console.log(`🔐 [MOCK EMAIL] Verification code for ${email}: ${code}`);
      return { success: true, message: 'Verification code generated (Email service unavailable)' };
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification - Aeko</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
          .content { padding: 40px 30px; }
          .code-box { background-color: #f8f9ff; border: 2px dashed #667eea; border-radius: 10px; padding: 20px; text-align: center; margin: 30px 0; }
          .verification-code { font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; margin: 10px 0; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; border-top: 1px solid #dee2e6; }
          .button { display: inline-block; padding: 12px 30px; background-color: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 Welcome to Aeko!</h1>
            <p>Verify your email to get started</p>
          </div>
          
          <div class="content">
            <h2>Hi ${username}! 👋</h2>
            <p>Thank you for joining <strong>Aeko</strong> - the next-generation social media platform with Web3 integration!</p>
            
            <p>To complete your registration and unlock all features, please verify your email address using the code below:</p>
            
            <div class="code-box">
              <p><strong>Your Verification Code:</strong></p>
              <div class="verification-code">${code}</div>
              <p style="color: #6c757d; font-size: 14px;">This code expires in 10 minutes</p>
            </div>
            
            <div class="warning">
              <strong>⚠️ Important:</strong> You have 3 attempts to enter the correct code. If you fail, you'll need to request a new one.
            </div>
            
            <p>If you didn't create an account with Aeko, you can safely ignore this email.</p>
          </div>
          
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Aeko Social. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const emailParams = this.createEmailParams(email, username, "🔐 Your Aeko Verification Code", htmlContent);
      const response = await this.mailerSend.email.send(emailParams);
      console.log('✅ Verification email sent successfully. ID:', response); // MailerSend usually returns empty object or ID in header, SDK handles it
      return { success: true, message: 'Verification email sent successfully' };
    } catch (error) {
      console.error('❌ Failed to send verification email:', error);
      
      // FAILOVER: Log code if email fails
      console.log(`🔐 [FAILOVER] Verification code for ${email}: ${code}`);
      return { success: true, message: 'Verification code generated (Email delivery failed)' };
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(email, username, resetLink) {
    if (!this.isAvailable()) {
      console.warn('Email service not available. Password reset email not sent.');
      return { success: false, message: 'Email service not configured' };
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - Aeko</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
          .content { padding: 40px 30px; }
          .code-box { background-color: #f8f9ff; border: 2px dashed #667eea; border-radius: 10px; padding: 20px; text-align: center; margin: 30px 0; }
          .button { display: inline-block; padding: 12px 30px; background-color: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; border-top: 1px solid #dee2e6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔑 Reset Your Password</h1>
            <p>Hello ${username || 'User'}, we received a request to reset your password</p>
          </div>
          
          <div class="content">
            <p>Click the button below to reset your password. This link will expire in 15 minutes.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </div>
            
            <div class="code-box">
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #667eea; font-size: 14px;">${resetLink}</p>
            </div>
            
            <div class="warning">
              <strong>⚠️ Security Tip:</strong> If you didn't request this password reset, please ignore this email.
            </div>
            
            <p>For security reasons, this link will expire in 15 minutes.</p>
            
            <p>Thanks,<br>The Aeko Team</p>
          </div>
          
          <div class="footer">
            <p>Need help? Contact us at <a href="mailto:support@aeko.social">support@aeko.social</a></p>
            <p>© ${new Date().getFullYear()} Aeko. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const emailParams = this.createEmailParams(email, username || 'User', "🔑 Reset Your Aeko Password", htmlContent);
      await this.mailerSend.email.send(emailParams);
      console.log('✅ Password reset email sent successfully.');
      return { success: true, message: 'Password reset email sent successfully' };
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      return { 
        success: false, 
        message: 'Failed to send password reset email',
        error: error.message 
      };
    }
  }

  // Send blue tick notification
  async sendBlueTickNotification(email, username) {
    if (!this.isAvailable()) {
       console.warn('Email service not available. Blue tick email not sent.');
       return { success: false, message: 'Email service not configured' };
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Blue Tick Awarded - Aeko</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #1da1f2 0%, #1991db 100%); color: white; padding: 40px 20px; text-align: center; }
            .content { padding: 40px 30px; }
            .tick-box { background-color: #e8f5ff; border: 2px solid #1da1f2; border-radius: 10px; padding: 30px; text-align: center; margin: 30px 0; }
            .blue-tick { font-size: 48px; color: #1da1f2; margin: 10px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; border-top: 1px solid #dee2e6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
            <p>You've earned your Blue Tick!</p>
          </div>
          <div class="content">
            <h2>Amazing work, ${username}! 🌟</h2>
            <div class="tick-box">
              <div class="blue-tick">✓</div>
            </div>
            <p>You are now a verified creator on Aeko!</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Aeko. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const emailParams = this.createEmailParams(email, username, "🎉 Congratulations! You earned your Blue Tick!", htmlContent);
      await this.mailerSend.email.send(emailParams);
      return { success: true, message: 'Blue tick notification sent' };
    } catch (error) {
      console.error('Email sending error:', error);
      return { success: false, message: 'Failed to send blue tick notification' };
    }
  }

  // Send login notification
  async sendLoginNotification(email, username, time, device) {
    if (!this.isAvailable()) {
       console.warn('Email service not available. Login notification not sent.');
       return { success: false, message: 'Email service not configured' };
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>New Login Detected - Aeko</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 40px 20px; text-align: center; }
            .content { padding: 40px 30px; }
            .info-box { background-color: #fff5f5; border-left: 4px solid #f5576c; padding: 20px; margin: 20px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; border-top: 1px solid #dee2e6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛡️ New Login Detected</h1>
          </div>
          <div class="content">
            <h2>Hello ${username},</h2>
            <p>We detected a new login to your Aeko account.</p>
            
            <div class="info-box">
              <p><strong>Time:</strong> ${time}</p>
              <p><strong>Device:</strong> ${device}</p>
            </div>
            
            <p>If this was you, you can safely ignore this email.</p>
            <p><strong>If you did not authorize this login, please change your password immediately.</strong></p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Aeko. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const emailParams = this.createEmailParams(email, username, "🛡️ New Login Alert - Aeko", htmlContent);
      await this.mailerSend.email.send(emailParams);
      return { success: true, message: 'Login notification sent' };
    } catch (error) {
      console.error('Email sending error:', error);
      return { success: false, message: 'Failed to send login notification' };
    }
  }

  // Send golden tick notification
  async sendGoldenTickNotification(email, username) {
    if (!this.isAvailable()) {
       console.warn('Email service not available. Golden tick email not sent.');
       return { success: false, message: 'Email service not configured' };
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Golden Tick Awarded - Aeko</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #f6d365 0%, #fda085 100%); color: white; padding: 40px 20px; text-align: center; }
            .content { padding: 40px 30px; }
            .tick-box { background-color: #fff9e6; border: 2px solid #fda085; border-radius: 10px; padding: 30px; text-align: center; margin: 30px 0; }
            .golden-tick { font-size: 48px; color: #fda085; margin: 10px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; border-top: 1px solid #dee2e6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏆 Premium Status Unlocked!</h1>
            <p>You've earned the Golden Tick!</p>
          </div>
          <div class="content">
            <h2>Congratulations, ${username}! 🌟</h2>
            <div class="tick-box">
              <div class="golden-tick">✨ ✓ ✨</div>
            </div>
            <p>You are now a Premium Golden Member on Aeko!</p>
            <p>Enjoy exclusive features, higher limits, and priority support.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Aeko. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const emailParams = this.createEmailParams(email, username, "🏆 Congratulations! You are now a Golden Member!", htmlContent);
      await this.mailerSend.email.send(emailParams);
      return { success: true, message: 'Golden tick notification sent' };
    } catch (error) {
      console.error('Email sending error:', error);
      return { success: false, message: 'Failed to send golden tick notification' };
    }
  }

  // Send welcome email after verification
  async sendWelcomeEmail(email, username) {
    if (!this.isAvailable()) {
       console.warn('Email service not available. Welcome email not sent.');
       return { success: false, message: 'Email service not configured' };
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Aeko</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
            .content { padding: 40px 30px; }
            .feature-box { background-color: #f8f9ff; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; border-top: 1px solid #dee2e6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1> Welcome to Aeko, ${username}!</h1>
              <p>Your email has been successfully verified</p>
            </div>
            
            <div class="content">
              <h2>Get Started with Aeko </h2>
              <p>You're now part of the next-generation social media platform! Here's how to make the most of your experience:</p>
              
              <div class="feature-box">
                <h3> Complete Your Profile (Earn Blue Tick)</h3>
                <p>Complete these steps to earn your verified status:</p>
                <ul>
                  <li>📸 Add a profile picture</li>
                  <li>📝 Write an engaging bio</li>
                  <li>👥 Get your first follower</li>
                </ul>
                <p><strong>Optional:</strong> Connect your Solana wallet for Web3 features</p>
              </div>
              
              <div class="feature-box">
                <h3>🪙 Explore Aeko Coin</h3>
                <p>Our native cryptocurrency powers the entire platform. Use it for:</p>
                <ul>
                  <li> NFT transactions</li>
                  <li> Stream donations</li>
                  <li> Giveaways and tips</li>
                </ul>
              </div>
              
              <div class="feature-box">
                <h3>🎨 NFT Marketplace</h3>
                <p>When your posts hit 200k views, mint them as NFTs and earn royalties!</p>
              </div>
              
              <div class="feature-box">
                <h3>🤖 AI Chat Bot</h3>
                <p>Chat with our AI bot featuring 7 unique personalities. Enable auto-replies in your settings!</p>
              </div>
              
              <h3>🔗 Useful Links</h3>
              <ul>
                <li><a href="${process.env.FRONTEND_URL}/profile">Complete Your Profile</a></li>
                <li><a href="${process.env.FRONTEND_URL}/wallet">Connect Wallet</a></li>
                <li><a href="${process.env.FRONTEND_URL}/nft">Explore NFT Marketplace</a></li>
                <li><a href="${process.env.FRONTEND_URL}/help">Help Center</a></li>
              </ul>
            </div>
            
            <div class="footer">
              <p>Questions? Contact us at <a href="mailto:support@aeko.social">support@aeko.social</a></p>
              <p>Follow us: <a href="#">Twitter</a> | <a href="#">Discord</a> | <a href="#">Telegram</a></p>
              <p>© 2025 Aeko. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
    `;

    try {
      const emailParams = this.createEmailParams(email, username, "🎉 Welcome to Aeko - Your Journey Begins!", htmlContent);
      await this.mailerSend.email.send(emailParams);
      return { success: true, message: 'Welcome email sent' };
    } catch (error) {
      console.error('Email sending error:', error);
      return { success: false, message: 'Failed to send welcome email' };
    }
  }
}

export default new EmailService();