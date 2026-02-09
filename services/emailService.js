import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Shared Styles & Layout
const getEmailTemplate = (title, content, username = '') => {
  const currentYear = new Date().getFullYear();
  const frontendUrl = process.env.FRONTEND_URL || 'https://aeko.social';
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - Aeko</title>
      <!-- Import Inter Font -->
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        /* Reset & Base */
        body { 
          font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          margin: 0; 
          padding: 0; 
          background-color: #f3f4f6; 
          color: #1f2937;
          -webkit-font-smoothing: antialiased;
        }
        
        /* Layout */
        .wrapper {
          width: 100%;
          background-color: #f3f4f6;
          padding: 40px 0;
        }
        
        .container { 
          max-width: 500px; 
          margin: 0 auto; 
          background-color: #ffffff; 
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }
        
        /* Header */
        .header { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          padding: 30px 40px; 
          text-align: center;
        }
        
        .logo {
          font-size: 28px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -1px;
          margin: 0;
          text-transform: lowercase;
        }

        .header-title {
          color: rgba(255, 255, 255, 0.9);
          font-size: 16px;
          font-weight: 500;
          margin-top: 10px;
          margin-bottom: 0;
        }
        
        /* Content */
        .content { 
          padding: 40px; 
          line-height: 1.6;
        }
        
        h2 {
          font-size: 22px;
          font-weight: 700;
          color: #111827;
          margin-top: 0;
          margin-bottom: 20px;
        }
        
        p {
          font-size: 15px;
          color: #4b5563;
          margin-bottom: 20px;
        }
        
        /* Components */
        .btn { 
          display: inline-block; 
          padding: 14px 32px; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          color: #ffffff !important; 
          text-decoration: none; 
          border-radius: 50px; 
          font-weight: 600;
          font-size: 15px;
          text-align: center;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 6px -1px rgba(102, 126, 234, 0.4);
          margin: 20px 0;
        }
        
        .code-box { 
          background-color: #f9fafb; 
          border: 1px dashed #d1d5db; 
          border-radius: 12px; 
          padding: 24px; 
          text-align: center; 
          margin: 24px 0; 
        }
        
        .verification-code { 
          font-family: 'Courier New', monospace;
          font-size: 32px; 
          font-weight: 700; 
          color: #4f46e5; 
          letter-spacing: 8px; 
          margin: 10px 0; 
        }

        .alert-box {
          background-color: #fffbeb;
          border-left: 4px solid #f59e0b;
          padding: 16px;
          border-radius: 4px;
          font-size: 14px;
          color: #92400e;
          margin: 24px 0;
        }

        .feature-list {
          list-style: none;
          padding: 0;
          margin: 20px 0;
        }

        .feature-item {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
          font-size: 15px;
          color: #4b5563;
        }

        .feature-icon {
          margin-right: 12px;
          font-size: 18px;
        }
        
        /* Footer */
        .footer { 
          background-color: #f9fafb; 
          padding: 30px; 
          text-align: center; 
          border-top: 1px solid #e5e7eb; 
        }
        
        .footer p {
          font-size: 13px;
          color: #9ca3af;
          margin-bottom: 10px;
        }
        
        .social-links a {
          color: #6b7280;
          text-decoration: none;
          margin: 0 8px;
          font-size: 13px;
          font-weight: 500;
        }

        .divider {
          height: 1px;
          background-color: #e5e7eb;
          margin: 30px 0;
        }

        /* Responsive */
        @media only screen and (max-width: 600px) {
          .wrapper { padding: 20px 10px; }
          .container { width: 100% !important; }
          .content { padding: 30px 20px; }
          .header { padding: 30px 20px; }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <!-- Header -->
          <div class="header">
            <h1 class="logo">aeko</h1>
            <p class="header-title">${title}</p>
          </div>
          
          <!-- Content -->
          <div class="content">
            ${username ? `<h2>Hi ${username} 👋</h2>` : ''}
            ${content}
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p>&copy; ${currentYear} Aeko Social. All rights reserved.</p>
            <div class="social-links">
              <a href="${frontendUrl}/help">Help Center</a> •
              <a href="${frontendUrl}/privacy">Privacy</a> •
              <a href="${frontendUrl}/terms">Terms</a>
            </div>
            <p style="margin-top: 20px;">
              You received this email because you have an account on Aeko.<br>
              If you didn't make this request, please contact support.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

class EmailService {
  constructor() {
    this.transporter = null;

    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD
        }
      });
      console.log('✅ Gmail SMTP Configured (Primary)');
    } else {
      console.warn('❌ Gmail credentials missing. Email service disabled.');
    }
  }

  // Check if email service is available
  isAvailable() {
    return this.transporter !== null;
  }

  // Send email using Gmail
  async sendEmail(toEmail, subject, htmlContent) {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const mailOptions = {
      from: `"${process.env.EMAIL_SENDER_NAME || 'Aeko'}" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: subject,
      html: htmlContent
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email sent to ${toEmail}. Message ID: ${info.messageId}`);
      return { success: true, message: 'Email sent successfully', messageId: info.messageId };
    } catch (error) {
      console.error(`❌ Failed to send email to ${toEmail}:`, error.message);
      throw error;
    }
  }

  // Send 4-digit verification code
  async sendVerificationCode(email, code, username) {
    if (!this.isAvailable()) {
      console.warn('Email service not available. Verification code not sent.');
      console.log(`🔐 [MOCK EMAIL] Verification code for ${email}: ${code}`);
      return { success: true, message: 'Verification code generated (Email service unavailable)' };
    }

    const content = `
      <p>Thank you for joining <strong>Aeko</strong> - the next-generation social media platform! We're excited to have you on board.</p>
      
      <p>To ensure the security of your account, please verify your email address using the code below:</p>
      
      <div class="code-box">
        <p style="margin-bottom: 5px; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Verification Code</p>
        <div class="verification-code">${code}</div>
        <p style="color: #9ca3af; font-size: 13px; margin-top: 5px;">Expires in 10 minutes</p>
      </div>
      
      <div class="alert-box">
        <strong>⚠️ Security Notice:</strong> Never share this code with anyone. Aeko staff will never ask for your verification code.
      </div>
    `;

    const htmlContent = getEmailTemplate("Verify Your Email", content, username);
    const subject = "🔐 Verify your Aeko account";

    try {
      await this.sendEmail(email, subject, htmlContent);
      return { success: true, message: 'Verification email sent successfully' };
    } catch (error) {
      console.log(`🔐 [FAILOVER] Verification code for ${email}: ${code}`);
      // Even if email fails, return success so the frontend moves to the code entry screen
      // The user can find the code in the server logs (which we just printed)
      return { success: true, message: 'Verification code generated (Email delivery failed)' };
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(email, username, resetLink) {
    if (!this.isAvailable()) {
      console.warn('Email service not available. Password reset email not sent.');
      return { success: false, message: 'Email service not configured' };
    }

    const content = `
      <p>We received a request to reset the password for your Aeko account. If you made this request, click the button below:</p>
      
      <div style="text-align: center;">
        <a href="${resetLink}" class="btn">Reset Password</a>
      </div>
      
      <p style="text-align: center; font-size: 13px; color: #6b7280; margin-top: 0;">Link expires in 15 minutes</p>

      <div class="divider"></div>
      
      <p style="font-size: 13px; color: #6b7280;">Or copy and paste this URL into your browser:</p>
      <div style="background: #f3f4f6; padding: 12px; border-radius: 8px; word-break: break-all; font-family: monospace; font-size: 12px; color: #4b5563;">
        ${resetLink}
      </div>
      
      <div class="alert-box" style="margin-top: 24px;">
        <strong>Didn't request this?</strong> You can safely ignore this email. Your password will remain unchanged.
      </div>
    `;

    const htmlContent = getEmailTemplate("Reset Password", content, username);
    const subject = "🔑 Reset Your Aeko Password";

    try {
      await this.sendEmail(email, subject, htmlContent);
      return { success: true, message: 'Password reset email sent successfully' };
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to send password reset email',
        error: error.message 
      };
    }
  }

  // Send login notification
  async sendLoginNotification(email, username, time, device) {
    if (!this.isAvailable()) {
       console.warn('Email service not available. Login notification not sent.');
       return { success: false, message: 'Email service not configured' };
    }

    const content = `
      <p>We detected a new login to your Aeko account from a new device or location.</p>
      
      <div style="background-color: #f8f9ff; border-left: 4px solid #667eea; padding: 20px; border-radius: 4px; margin: 24px 0;">
        <div class="feature-item">
          <span class="feature-icon">🕒</span>
          <strong>Time:</strong>&nbsp; ${time}
        </div>
        <div class="feature-item" style="margin-bottom: 0;">
          <span class="feature-icon">📱</span>
          <strong>Device:</strong>&nbsp; ${device}
        </div>
      </div>
      
      <p>If this was you, you can safely ignore this email.</p>
      
      <div class="alert-box">
        <strong>Not you?</strong> Please change your password immediately to secure your account.
      </div>
    `;

    const htmlContent = getEmailTemplate("New Login Detected", content, username);
    const subject = "🛡️ New Login Alert - Aeko";

    // Attempt 1: ZeptoMail
    if (this.client) {
      try {
        const emailParams = this.createEmailParams(email, username, subject, htmlContent);
        await this.client.sendMail(emailParams);
        return { success: true, message: 'Login notification sent' };
      } catch (error) {
        console.error('Email sending error (ZeptoMail):', error.message);
      }
    }

    // Attempt 2: Gmail Backup
    if (this.gmailTransporter) {
      try {
        await this.sendWithGmail(email, subject, htmlContent);
        return { success: true, message: 'Login notification sent (Backup)' };
      } catch (error) {
        console.error('Email sending error (Gmail):', error.message);
      }
    }

    return { success: false, message: 'Failed to send login notification' };
  }

  // Send golden tick notification
  async sendGoldenTickNotification(email, username) {
    if (!this.isAvailable()) {
       console.warn('Email service not available. Golden tick email not sent.');
       return { success: false, message: 'Email service not configured' };
    }

    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="font-size: 64px; margin-bottom: 10px;">🏆</div>
        <h2 style="color: #d97706; margin-bottom: 10px;">Premium Unlocked!</h2>
      </div>

      <p style="text-align: center;">You've officially earned the <strong>Golden Tick</strong>! You are now a Premium Golden Member on Aeko.</p>
      
      <div class="code-box" style="border-color: #fbbf24; background-color: #fffbeb;">
        <h3 style="margin-top: 0; color: #d97706;">Your New Superpowers</h3>
        <ul class="feature-list" style="text-align: left; display: inline-block;">
          <li class="feature-item"><span class="feature-icon">✨</span> Exclusive Golden Badge</li>
          <li class="feature-item"><span class="feature-icon">🚀</span> Boosted Post Visibility</li>
          <li class="feature-item"><span class="feature-icon">💎</span> Priority Support</li>
          <li class="feature-item"><span class="feature-icon">📊</span> Advanced Analytics</li>
        </ul>
      </div>

      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL}/profile" class="btn" style="background: linear-gradient(135deg, #f6d365 0%, #fda085 100%); box-shadow: 0 4px 6px -1px rgba(253, 160, 133, 0.4);">View My Profile</a>
      </div>
    `;

    const htmlContent = getEmailTemplate("Golden Status Awarded", content, username);
    const subject = "🏆 You are now a Golden Member!";

    try {
      await this.sendEmail(email, subject, htmlContent);
      return { success: true, message: 'Golden tick notification sent' };
    } catch (error) {
      console.error('Email sending error:', error.message);
      return { success: false, message: 'Failed to send golden tick notification' };
    }
  }

  // Send blue tick notification
  async sendBlueTickNotification(email, username) {
    if (!this.isAvailable()) {
       console.warn('Email service not available. Blue tick email not sent.');
       return { success: false, message: 'Email service not configured' };
    }

    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="font-size: 64px; margin-bottom: 10px; color: #3b82f6;">✓</div>
        <h2 style="color: #2563eb; margin-bottom: 10px;">You're Verified!</h2>
      </div>

      <p style="text-align: center;">Congratulations! You've earned the <strong>Blue Tick</strong>. You are now a verified creator on Aeko.</p>
      
      <div class="code-box" style="border-color: #3b82f6; background-color: #eff6ff;">
        <p>This badge lets everyone know that your account is authentic and trustworthy. Keep creating amazing content!</p>
      </div>

      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL}/profile" class="btn" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.4);">View My Profile</a>
      </div>
    `;

    const htmlContent = getEmailTemplate("Verified Status Awarded", content, username);
    const subject = "🎉 You earned the Blue Tick!";

    try {
      await this.sendEmail(email, subject, htmlContent);
      return { success: true, message: 'Blue tick notification sent' };
    } catch (error) {
      console.error('Email sending error:', error.message);
      return { success: false, message: 'Failed to send blue tick notification' };
    }
  }

  // Send warning email
  async sendWarningEmail(email, username, reason, warningCount) {
    if (!this.isAvailable()) {
       console.warn('Email service not available. Warning email not sent.');
       return { success: false, message: 'Email service not configured' };
    }

    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="font-size: 64px; margin-bottom: 10px;">⚠️</div>
        <h2 style="color: #d97706; margin-bottom: 10px;">Community Warning</h2>
      </div>

      <p>We are writing to inform you that your account has received a warning for violating our Community Guidelines.</p>
      
      <div class="alert-box">
        <strong>Reason:</strong> ${reason}<br>
        <strong>Total Warnings:</strong> ${warningCount}
      </div>

      <p>Please review our guidelines to ensure your future activity complies with our rules. Repeated violations may result in account suspension.</p>
      
      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL}/guidelines" class="btn" style="background: #d97706;">Review Guidelines</a>
      </div>
    `;

    const htmlContent = getEmailTemplate("Account Warning", content, username);
    const subject = "⚠️ Account Warning - Aeko";

    // Attempt 1: ZeptoMail
    if (this.client) {
      try {
        const emailParams = this.createEmailParams(email, username, subject, htmlContent);
        await this.client.sendMail(emailParams);
        return { success: true, message: 'Warning email sent' };
      } catch (error) {
        console.error('Email sending error (ZeptoMail):', error.message);
      }
    }

    // Attempt 2: Gmail Backup
    if (this.gmailTransporter) {
      try {
        await this.sendWithGmail(email, subject, htmlContent);
        return { success: true, message: 'Warning email sent (Backup)' };
      } catch (error) {
        console.error('Email sending error (Gmail):', error.message);
      }
    }

    return { success: false, message: 'Failed to send warning email' };
  }

  // Send welcome email after verification
  async sendWelcomeEmail(email, username) {
    if (!this.isAvailable()) {
       console.warn('Email service not available. Welcome email not sent.');
       return { success: false, message: 'Email service not configured' };
    }

    const content = `
      <p>Welcome to the future of social media! Your email has been successfully verified, and you're all set to start your journey.</p>
      
      <h3>🚀 Quick Start Guide</h3>
      
      <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <div class="feature-item">
          <span class="feature-icon">📸</span>
          <div>
            <strong>Complete Profile</strong>
            <div style="font-size: 13px; color: #6b7280;">Add a photo and bio to get discovered</div>
          </div>
        </div>
        <div class="divider" style="margin: 15px 0;"></div>
        <div class="feature-item">
          <span class="feature-icon">🤖</span>
          <div>
            <strong>Meet Your AI Bot</strong>
            <div style="font-size: 13px; color: #6b7280;">Customize your personal AI assistant</div>
          </div>
        </div>
        <div class="divider" style="margin: 15px 0;"></div>
        <div class="feature-item">
          <span class="feature-icon">👥</span>
          <div>
            <strong>Connect</strong>
            <div style="font-size: 13px; color: #6b7280;">Find friends and join communities</div>
          </div>
        </div>
      </div>
      
      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL}/profile" class="btn">Setup My Profile</a>
      </div>
      
      <p style="text-align: center; font-size: 14px; margin-top: 20px;">
        Need help? Visit our <a href="${process.env.FRONTEND_URL}/help" style="color: #667eea; text-decoration: none; font-weight: 500;">Help Center</a>
      </p>
    `;

    const htmlContent = getEmailTemplate("Welcome to Aeko", content, username);
    const subject = "🎉 Welcome to Aeko - Your Journey Begins!";

    try {
      await this.sendEmail(email, subject, htmlContent);
      return { success: true, message: 'Welcome email sent' };
    } catch (error) {
      console.error('Email sending error:', error.message);
      return { success: false, message: 'Failed to send welcome email' };
    }
  }
}

export default new EmailService();
