import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  // Send 4-digit verification code
  async sendVerificationCode(email, code, username) {
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
                <li>🔗 Connect your Solana wallet</li>
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
              <p>Need help? Contact us at <a href="mailto:support@aeko.com">support@aeko.com</a></p>
              <p>This code was requested from IP address and expires in 10 minutes.</p>
              <p>If you didn't request this code, please ignore this email.</p>
              <p style="font-size: 12px; margin-top: 20px;">
                © 2024 Aeko. All rights reserved.<br>
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
                <li>✅ Wallet connected</li>
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
              <p>© 2024 Aeko. All rights reserved.</p>
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
                  <li>🔗 Connect your Solana wallet</li>
                </ul>
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
              <p>Questions? Contact us at <a href="mailto:support@aeko.com">support@aeko.com</a></p>
              <p>Follow us: <a href="#">Twitter</a> | <a href="#">Discord</a> | <a href="#">Telegram</a></p>
              <p>© 2024 Aeko. All rights reserved.</p>
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