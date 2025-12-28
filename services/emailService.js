import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
  constructor() {
    // Check if email credentials are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('Email credentials not configured. Email functionality will be disabled.');
      this.transporter = null;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // Use SSL
        family: 4, // Force IPv4 to avoid timeouts in some environments
        connectionTimeout: 20000, // 20 seconds timeout for initial connection
        socketTimeout: 30000,     // 30 seconds timeout for socket
        greetingTimeout: 20000,   // 20 seconds to wait for greeting
        debug: process.env.NODE_ENV === 'development', // Enable debug logging in development
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      });
    } catch (error) {
      console.error('Failed to create email transporter:', error);
      this.transporter = null;
    }
  }

  // Check if email service is available
  isAvailable() {
    return this.transporter !== null;
  }

  // Send 4-digit verification code
  async sendVerificationCode(email, code, username) {
    // Check if email service is available
    if (!this.isAvailable()) {
      console.warn('Email service not available. Verification code not sent.');
      return { success: false, message: 'Email service not configured' };
    }
    const mailOptions = {
      from: `"Aeko" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Your Aeko Verification Code',
      html: `
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
              
                             <h3>🎯 What's Next?</h3>
               <p>Once verified, complete your profile to earn a <strong style="color: #1da1f2;">Blue Tick ✓</strong>:</p>
               <ul>
                 <li>✅ Verify your email (you're doing this now!)</li>
                 <li>📸 Add a profile picture</li>
                 <li>📝 Write a bio (minimum 10 characters)</li>
                 <li>👥 Get at least 1 follower</li>
               </ul>
               
               <h3>🔗 Optional Features:</h3>
               <ul>
                 <li>🔗 Connect your Solana wallet for Web3 features</li>
               </ul>
              
              <h3>🚀 Aeko Features You'll Love:</h3>
              <ul>
                <li>🎨 <strong>NFT Marketplace:</strong> Mint your viral posts as NFTs</li>
                <li>🪙 <strong>Aeko Coin:</strong> Earn and trade our native cryptocurrency</li>
                <li>🤖 <strong>AI Chat Bot:</strong> Intelligent conversations with 7 personalities</li>
                <li>🎥 <strong>Live Streaming:</strong> Stream and earn crypto donations</li>
                <li>💬 <strong>Enhanced Chat:</strong> Voice messages, reactions, and more</li>
              </ul>
            </div>
            
            <div class="footer">
              <p>Need help? Contact us at <a href="mailto:support@aeko.social">support@aeko.social</a></p>
              <p>This code was requested from IP address and expires in 10 minutes.</p>
              <p>If you didn't request this code, please ignore this email.</p>
              <p style="font-size: 12px; margin-top: 20px;">
                © 2025 Aeko. All rights reserved.<br>
                Aeko - The Future of Social Media is Here 🌟
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return { success: true, message: 'Verification code sent successfully' };
    } catch (error) {
      console.error('Email sending error:', error);
      return { success: false, message: 'Failed to send verification code' };
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(email, username, resetLink) {
    if (!this.isAvailable()) {
      console.warn('Email service not available. Password reset email not sent.');
      return { success: false, message: 'Email service not configured' };
    }

    const mailOptions = {
      from: `"Aeko" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔑 Reset Your Aeko Password',
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset - Aeko</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 0; 
              padding: 0; 
              background-color: #f5f5f5; 
              color: #333;
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
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white; 
              padding: 40px 20px; 
              text-align: center; 
            }
            .content { 
              padding: 30px; 
              line-height: 1.6;
            }
            .button { 
              display: inline-block; 
              padding: 12px 30px; 
              background-color: #667eea; 
              color: white !important; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 20px 0; 
              font-weight: 500;
            }
            .footer { 
              background-color: #f8f9fa; 
              padding: 20px; 
              text-align: center; 
              color: #6c757d; 
              border-top: 1px solid #dee2e6;
              font-size: 14px;
            }
            .code-box { 
              background-color: #f8f9ff; 
              border: 2px dashed #667eea; 
              border-radius: 10px; 
              padding: 15px; 
              margin: 25px 0;
              text-align: center;
            }
            .warning { 
              background-color: #fff3cd; 
              border: 1px solid #ffeaa7; 
              color: #856404; 
              padding: 15px; 
              border-radius: 5px; 
              margin: 20px 0;
              font-size: 14px;
            }
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
                <strong>⚠️ Security Tip:</strong> If you didn't request this password reset, please ignore this email or contact support if you have concerns.
              </div>
              
              <p>For security reasons, this link will expire in 15 minutes. If you need to reset your password again, you can request a new link from the login page.</p>
              
              <p>Thanks,<br>The Aeko Team</p>
            </div>
            
            <div class="footer">
              <p>Need help? Contact us at <a href="mailto:support@aeko.social" style="color: #667eea;">support@aeko.social</a></p>
              <p style="margin-top: 10px; font-size: 12px; color: #999;">
                © ${new Date().getFullYear()} Aeko. All rights reserved.<br>
                You're receiving this email because a password reset was requested for this account.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return { success: true, message: 'Password reset email sent successfully' };
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return { 
        success: false, 
        message: 'Failed to send password reset email',
        error: error.message 
      };
    }
  }

  // Send blue tick notification
  async sendBlueTickNotification(email, username) {
    const mailOptions = {
      from: `"Aeko" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🎉 Congratulations! You earned your Blue Tick!',
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
                <h3 style="color: #1da1f2; margin: 10px 0;">BLUE TICK AWARDED</h3>
                <p>Your profile is now verified!</p>
              </div>
              
                             <p>You've successfully completed all the requirements for a Blue Tick verification:</p>
               <ul>
                 <li>✅ Email verified</li>
                 <li>✅ Profile picture added</li>
                 <li>✅ Bio completed</li>
                 <li>✅ Got your first follower</li>
               </ul>
              
              <h3>🚀 Blue Tick Benefits:</h3>
              <ul>
                <li>🔹 Enhanced credibility and trust</li>
                <li>🔹 Priority in search results</li>
                <li>🔹 Access to premium features</li>
                <li>🔹 Higher NFT minting priority</li>
                <li>🔹 VIP support</li>
              </ul>
              
              <p>Your verified status is now visible on your profile and throughout the platform!</p>
            </div>
            
            <div class="footer">
              <p>Keep creating amazing content! 🎨</p>
              <p>© 2025 Aeko. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return { success: true, message: 'Blue tick notification sent' };
    } catch (error) {
      console.error('Email sending error:', error);
      return { success: false, message: 'Failed to send notification' };
    }
  }

  // Send welcome email after verification
  async sendWelcomeEmail(email, username) {
    const mailOptions = {
      from: `"Aeko" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🎉 Welcome to Aeko - Your Journey Begins!',
      html: `
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
              <h1>🎉 Welcome to Aeko, ${username}!</h1>
              <p>Your email has been successfully verified</p>
            </div>
            
            <div class="content">
              <h2>Get Started with Aeko 🚀</h2>
              <p>You're now part of the next-generation social media platform! Here's how to make the most of your experience:</p>
              
                             <div class="feature-box">
                 <h3>🎯 Complete Your Profile (Earn Blue Tick)</h3>
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
                  <li>💰 NFT transactions</li>
                  <li>💸 Stream donations</li>
                  <li>🎁 Giveaways and tips</li>
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
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return { success: true, message: 'Welcome email sent' };
    } catch (error) {
      console.error('Email sending error:', error);
      return { success: false, message: 'Failed to send welcome email' };
    }
  }
}

export default new EmailService();