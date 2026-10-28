import { SendMailClient } from "zeptomail";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

// Shared layout. Brand colours come from the logo (deep teal #003334, lime
// #99fe00) and the web app's primary (#007f6d). Tables and inline styles so
// Gmail, Outlook and Apple Mail all render it the same.
const BRAND = {
  teal: "#003334",
  green: "#007f6d",
  lime: "#99fe00",
  tint: "#e6f6f4",
  text: "#1f3a37",
  muted: "#5f7472",
  line: "#d8e8e5",
  page: "#f1f6f5",
};

const siteUrl = () => (process.env.FRONTEND_URL || "https://www.aeko.online").replace(/\/+$/, "");
const logoUrl = () => process.env.EMAIL_LOGO_URL || "https://www.aeko.online/aeko-logo.png";

const getEmailTemplate = (title, content, username = "") => {
  const year = new Date().getFullYear();
  const site = siteUrl();
  const greeting = username ? `Hi ${username},` : "Hello,";
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${title} · Aeko</title>
  <style>
    body { margin: 0; padding: 0; background: ${BRAND.page}; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse; }
    img { border: 0; display: block; }
    p { margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: ${BRAND.text}; }
    a { color: ${BRAND.green}; }
    h2 { margin: 0 0 16px; font-size: 24px; line-height: 1.3; font-weight: 700; color: ${BRAND.teal}; }
    h3 { margin: 24px 0 8px; font-size: 16px; font-weight: 700; color: ${BRAND.teal}; }
    .btn { display: inline-block; padding: 14px 28px; background: ${BRAND.green}; color: #ffffff !important; text-decoration: none; border-radius: 999px; font-weight: 600; font-size: 15px; }
    .code-box { background: ${BRAND.tint}; border-radius: 14px; padding: 22px 16px; text-align: center; margin: 24px 0; }
    .code-label { margin: 0 0 6px; font-size: 12px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: ${BRAND.green}; }
    .verification-code { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 36px; font-weight: 700; letter-spacing: 10px; color: ${BRAND.teal}; margin: 6px 0; }
    .code-note { margin: 6px 0 0; font-size: 13px; color: ${BRAND.muted}; }
    .alert-box { border-left: 3px solid ${BRAND.lime}; background: #fbfff0; padding: 14px 16px; border-radius: 0 10px 10px 0; font-size: 14px; line-height: 1.55; color: ${BRAND.text}; margin: 24px 0; }
    .divider { height: 1px; background: ${BRAND.line}; margin: 24px 0; }
    .feature-list { list-style: none; padding: 0; margin: 0; }
    .feature-item { display: flex; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid ${BRAND.line}; font-size: 15px; line-height: 1.5; color: ${BRAND.text}; }
    .feature-item:last-child { border-bottom: 0; }
    .feature-icon { flex: 0 0 auto; width: 8px; height: 8px; border-radius: 50%; background: ${BRAND.lime}; margin: 9px 12px 0 0; }
    .feature-sub { font-size: 13px; color: ${BRAND.muted}; }
    .mono { background: ${BRAND.tint}; padding: 12px; border-radius: 10px; word-break: break-all; font-family: Menlo, Consolas, monospace; font-size: 12px; color: ${BRAND.teal}; }
    .footer p { font-size: 12px; line-height: 1.6; color: ${BRAND.muted}; margin: 0 0 8px; }
    .footer a { color: ${BRAND.green}; text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .outer { padding: 16px 8px !important; }
      .card { border-radius: 16px !important; }
      .pad { padding-left: 20px !important; padding-right: 20px !important; }
      .verification-code { font-size: 30px !important; letter-spacing: 6px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${BRAND.page};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.page};">
    <tr>
      <td class="outer" align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" class="card" style="width:560px;max-width:100%;background:#ffffff;border-radius:20px;overflow:hidden;">
          <tr>
            <td class="pad" style="padding:28px 36px 0;font-family:${font};">
              <a href="${site}" style="text-decoration:none;">
                <img src="${logoUrl()}" width="112" alt="Aeko" style="width:112px;height:auto;">
              </a>
            </td>
          </tr>
          <tr>
            <td class="pad" style="padding:20px 36px 0;">
              <div style="height:3px;width:44px;background:${BRAND.lime};border-radius:2px;"></div>
            </td>
          </tr>
          <tr>
            <td class="pad" style="padding:20px 36px 32px;font-family:${font};">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${BRAND.green};">${title}</p>
              <p style="margin:0 0 18px;font-size:16px;color:${BRAND.text};">${greeting}</p>
              ${content}
            </td>
          </tr>
          <tr>
            <td class="pad footer" style="padding:20px 36px 28px;background:${BRAND.tint};font-family:${font};">
              <p>
                <a href="${site}/help">Help</a> &nbsp;·&nbsp;
                <a href="${site}/privacy">Privacy</a> &nbsp;·&nbsp;
                <a href="${site}/terms">Terms</a>
              </p>
              <p>You're receiving this because you have an Aeko account. If you didn't expect it, you can ignore it or contact support.</p>
              <p style="margin:0;">&copy; ${year} Aeko</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

let transporter = null;

const hasGmailCredentials = () =>
  Boolean(
    process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim(),
  );

const hasZeptoMailCredentials = () =>
  Boolean(
    process.env.ZEPTOMAIL_API_URL?.trim() &&
    process.env.ZEPTOMAIL_API_KEY?.trim(),
  );

// ZeptoMail only accepts senders on a domain verified in its console; Gmail
// only lets the authenticated account send as itself.
const zeptoSenderAddress = () =>
  process.env.ZEPTOMAIL_SENDER_ADDRESS?.trim() || "noreply@aeko.social";
const senderName = () => process.env.EMAIL_SENDER_NAME || "Aeko";

const getGmailTransporter = () => {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
  return transporter;
};

/** A provider error as one log line, without the message body or credentials. */
const describeError = (error) => {
  if (!error) return "unknown error";
  if (typeof error === "string") return error.slice(0, 500);
  const parts = [error.code, error.message, error.response, error.error?.code, error.error?.message];
  const details = error.error?.details ?? error.details;
  if (details) parts.push(JSON.stringify(details).slice(0, 400));
  const text = parts.filter(Boolean).join(" | ").replace(/\s+/g, " ");
  return (text || JSON.stringify(error)).slice(0, 300);
};

class EmailService {
  constructor() {
    this.client = null;
    this.lastError = null;
    this.lastSentAt = null;
    if (hasZeptoMailCredentials()) {
      this.client = new SendMailClient({
        url: process.env.ZEPTOMAIL_API_URL,
        token: process.env.ZEPTOMAIL_API_KEY,
      });
      console.log(`✅ ZeptoMail Service Configured (sender ${zeptoSenderAddress()})`);
    }

    if (hasGmailCredentials()) {
      console.log("✅ Gmail Service Configured (fallback)");
    }

    if (!this.client && !hasGmailCredentials()) {
      console.warn("❌ Email service disabled: no provider is configured.");
    }
  }

  // Check if email service is available
  isAvailable() {
    return hasGmailCredentials() || this.client !== null;
  }

  /** What /api/health reports: which providers are set up and the last failure. Never includes secrets. */
  status() {
    return {
      configured: this.isAvailable(),
      providers: {
        zeptomail: this.client !== null,
        gmail: hasGmailCredentials(),
      },
      sender: this.client ? zeptoSenderAddress() : hasGmailCredentials() ? process.env.GMAIL_USER : null,
      lastSentAt: this.lastSentAt,
      lastError: this.lastError,
    };
  }

  recordFailure(provider, toEmail, error) {
    const detail = describeError(error);
    this.lastError = { provider, at: new Date().toISOString(), detail };
    console.error(`❌ ${provider} delivery failed for ${toEmail}: ${detail}`);
  }

  // Send email through ZeptoMail, then Gmail if ZeptoMail is missing or fails.
  async sendEmail(toEmail, subject, htmlContent, username = "") {
    if (!this.isAvailable()) {
      throw new Error("Email service not configured");
    }
    const recipientName = username || toEmail.split("@")[0];
    const failures = [];

    if (this.client) {
      try {
        await this.client.sendMail({
          from: { address: zeptoSenderAddress(), name: senderName() },
          to: [{ email_address: { address: toEmail, name: recipientName } }],
          subject,
          htmlbody: htmlContent,
        });
        this.lastSentAt = new Date().toISOString();
        console.log(`✅ Email sent to ${toEmail} via ZeptoMail`);
        return { success: true, message: "Email sent successfully" };
      } catch (error) {
        this.recordFailure("ZeptoMail", toEmail, error);
        failures.push(`ZeptoMail: ${describeError(error)}`);
      }
    }

    if (hasGmailCredentials()) {
      try {
        await getGmailTransporter().sendMail({
          from: { address: process.env.GMAIL_USER, name: senderName() },
          to: { address: toEmail, name: recipientName },
          subject,
          html: htmlContent,
        });
        this.lastSentAt = new Date().toISOString();
        console.log(`✅ Email sent to ${toEmail} via Gmail`);
        return { success: true, message: "Email sent successfully" };
      } catch (error) {
        this.recordFailure("Gmail", toEmail, error);
        failures.push(`Gmail: ${describeError(error)}`);
      }
    }

    throw new Error(`Unable to send email (${failures.join("; ")})`);
  }

  // Send 4-digit verification code
  async sendVerificationCode(email, code, username) {
    if (!this.isAvailable()) {
      console.warn("Email service not available. Verification code not sent.");
      return {
        success: false,
        message: "Email service not configured",
      };
    }

    const content = `
      <h2>Confirm your email</h2>
      <p>Enter this code in the app to finish setting up your Aeko account.</p>
      <div class="code-box">
        <p class="code-label">Verification code</p>
        <div class="verification-code">${code}</div>
        <p class="code-note">Valid for 10 minutes</p>
      </div>
      <div class="alert-box">
        Keep this code to yourself. Aeko will never ask you for it by message or phone.
      </div>
    `;

    const htmlContent = getEmailTemplate(
      "Verify Your Email",
      content,
      username,
    );
    const subject = `${code} is your Aeko verification code`;

    try {
      const result = await this.sendEmail(
        email,
        subject,
        htmlContent,
        username,
      );
      if (result.success) {
        return {
          success: true,
          message: "Verification email sent successfully",
        };
      }

      return {
        success: false,
        message: "Failed to send verification email",
      };
    } catch (error) {
      console.error(`Verification code email to ${email} failed: ${error?.message ?? error}`);
      return {
        success: false,
        message: "Failed to send verification email",
      };
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(email, username, resetLink) {
    if (!this.isAvailable()) {
      console.warn(
        "Email service not available. Password reset email not sent.",
      );
      return { success: false, message: "Email service not configured" };
    }

    const content = `
      <h2>Reset your password</h2>
      <p>Someone asked to reset the password for your Aeko account. If that was you, use the button below. The link works for 1 hour.</p>
      <p style="text-align:center;margin:24px 0;"><a href="${resetLink}" class="btn">Reset password</a></p>
      <p style="font-size:13px;color:#5f7472;">If the button doesn't open, paste this address into your browser:</p>
      <div class="mono">${resetLink}</div>
      <div class="alert-box">
        Didn't ask for this? Ignore this email and your password stays as it is.
      </div>
    `;

    const htmlContent = getEmailTemplate("Reset Password", content, username);
    const subject = "Reset your Aeko password";

    try {
      const result = await this.sendEmail(
        email,
        subject,
        htmlContent,
        username,
      );
      if (result.success) {
        return {
          success: true,
          message: "Password reset email sent successfully",
        };
      }

      return {
        success: false,
        message: "Failed to send password reset email",
      };
    } catch {
      return {
        success: false,
        message: "Failed to send password reset email",
      };
    }
  }

  // Send 6-digit password reset code
  async sendPasswordResetCode(email, username, code) {
    if (!this.isAvailable()) {
      console.warn(
        "Email service not available. Password reset code not sent.",
      );
      return { success: false, message: "Email service not configured" };
    }

    const content = `
      <h2>Reset your password</h2>
      <p>Enter this code in the app to choose a new password.</p>
      <div class="code-box">
        <p class="code-label">Password reset code</p>
        <div class="verification-code">${code}</div>
        <p class="code-note">Valid for 10 minutes</p>
      </div>
      <div class="alert-box">
        Keep this code to yourself. If you didn't ask to reset your password, ignore this email and nothing changes.
      </div>
    `;

    const htmlContent = getEmailTemplate("Reset Password", content, username);
    const subject = `${code} is your Aeko password reset code`;

    try {
      const result = await this.sendEmail(
        email,
        subject,
        htmlContent,
        username,
      );
      if (result.success) {
        return {
          success: true,
          message: "Password reset code sent successfully",
        };
      }

      return {
        success: false,
        message: "Failed to send password reset code",
      };
    } catch {
      return {
        success: false,
        message: "Failed to send password reset code",
      };
    }
  }

  // Send login notification
  async sendLoginNotification(email, username, time, device) {
    if (!this.isAvailable()) {
      console.warn("Email service not available. Login notification not sent.");
      return { success: false, message: "Email service not configured" };
    }

    const content = `
      <h2>New sign-in to your account</h2>
      <p>Your Aeko account was just used from a device or place we haven't seen before.</p>
      <ul class="feature-list">
        <li class="feature-item"><span class="feature-icon"></span><span><strong>When</strong><br>${time}</span></li>
        <li class="feature-item"><span class="feature-icon"></span><span><strong>Device</strong><br>${device}</span></li>
      </ul>
      <p style="margin-top:16px;">If this was you, there's nothing to do.</p>
      <div class="alert-box">
        Wasn't you? Change your password now from Settings, then sign out of other devices.
      </div>
    `;

    const htmlContent = getEmailTemplate(
      "New Login Detected",
      content,
      username,
    );
    const subject = "New sign-in to your Aeko account";

    try {
      await this.sendEmail(email, subject, htmlContent, username);
      return { success: true, message: "Login notification sent" };
    } catch (error) {
      console.error("Email sending error:", error.message);
      return { success: false, message: "Failed to send login notification" };
    }
  }

  // Send golden tick notification
  async sendGoldenTickNotification(email, username) {
    if (!this.isAvailable()) {
      console.warn("Email service not available. Golden tick email not sent.");
      return { success: false, message: "Email service not configured" };
    }

    const content = `
      <h2>You've got the Golden Tick</h2>
      <p>Your account now carries Aeko's golden badge. Here's what comes with it:</p>
      <ul class="feature-list">
        <li class="feature-item"><span class="feature-icon"></span>The golden badge on your profile and posts</li>
        <li class="feature-item"><span class="feature-icon"></span>More reach for what you post</li>
        <li class="feature-item"><span class="feature-icon"></span>Priority support</li>
        <li class="feature-item"><span class="feature-icon"></span>Detailed analytics</li>
      </ul>
      <p style="text-align:center;margin:28px 0 0;"><a href="${siteUrl()}/profile" class="btn">See your profile</a></p>
    `;

    const htmlContent = getEmailTemplate(
      "Golden Status Awarded",
      content,
      username,
    );
    const subject = "Your Golden Tick is live";

    try {
      await this.sendEmail(email, subject, htmlContent, username);
      return { success: true, message: "Golden tick notification sent" };
    } catch (error) {
      console.error("Email sending error:", error.message);
      return {
        success: false,
        message: "Failed to send golden tick notification",
      };
    }
  }

  // Send blue tick notification
  async sendBlueTickNotification(email, username) {
    if (!this.isAvailable()) {
      console.warn("Email service not available. Blue tick email not sent.");
      return { success: false, message: "Email service not configured" };
    }

    const content = `
      <h2>You're verified</h2>
      <p>Your account has earned the Blue Tick. It tells everyone on Aeko that your profile is the real you.</p>
      <div class="alert-box">
        The badge shows next to your name on your profile, posts and comments from now on.
      </div>
      <p style="text-align:center;margin:28px 0 0;"><a href="${siteUrl()}/profile" class="btn">See your profile</a></p>
    `;

    const htmlContent = getEmailTemplate(
      "Verified Status Awarded",
      content,
      username,
    );
    const subject = "Your account is now verified";

    try {
      await this.sendEmail(email, subject, htmlContent, username);
      return { success: true, message: "Blue tick notification sent" };
    } catch (error) {
      console.error("Email sending error:", error.message);
      return {
        success: false,
        message: "Failed to send blue tick notification",
      };
    }
  }

  // Send warning email
  async sendWarningEmail(email, username, reason, warningCount) {
    if (!this.isAvailable()) {
      console.warn("Email service not available. Warning email not sent.");
      return { success: false, message: "Email service not configured" };
    }

    const content = `
      <h2>A warning on your account</h2>
      <p>Something posted from your account went against the Aeko community guidelines, so we've added a warning to it.</p>
      <ul class="feature-list">
        <li class="feature-item"><span class="feature-icon"></span><span><strong>Reason</strong><br>${reason}</span></li>
        <li class="feature-item"><span class="feature-icon"></span><span><strong>Warnings on this account</strong><br>${warningCount}</span></li>
      </ul>
      <p style="margin-top:16px;">Please read the guidelines before posting again. Further warnings can lead to the account being suspended.</p>
      <p style="text-align:center;margin:24px 0 0;"><a href="${siteUrl()}/guidelines" class="btn">Read the guidelines</a></p>
    `;

    const htmlContent = getEmailTemplate("Account Warning", content, username);
    const subject = "A warning has been added to your Aeko account";

    try {
      await this.sendEmail(email, subject, htmlContent, username);
      return { success: true, message: "Warning email sent" };
    } catch (error) {
      console.error("Email sending error:", error.message);
      return { success: false, message: "Failed to send warning email" };
    }
  }

  // Send welcome email after verification
  async sendWelcomeEmail(email, username) {
    if (!this.isAvailable()) {
      console.warn("Email service not available. Welcome email not sent.");
      return { success: false, message: "Email service not configured" };
    }

    const content = `
      <h2>Welcome to Aeko</h2>
      <p>Your email is confirmed and your account is ready. A few things worth doing first:</p>
      <ul class="feature-list">
        <li class="feature-item"><span class="feature-icon"></span><span><strong>Finish your profile</strong><br><span class="feature-sub">A photo and a short bio help people find you.</span></span></li>
        <li class="feature-item"><span class="feature-icon"></span><span><strong>Pick your interests</strong><br><span class="feature-sub">They shape what shows up in your feed.</span></span></li>
        <li class="feature-item"><span class="feature-icon"></span><span><strong>Open your wallet</strong><br><span class="feature-sub">Every account comes with an Aeko wallet, ready to use.</span></span></li>
      </ul>
      <p style="text-align:center;margin:28px 0 0;"><a href="${siteUrl()}/profile" class="btn">Set up your profile</a></p>
    `;

    const htmlContent = getEmailTemplate("Welcome to Aeko", content, username);
    const subject = "Welcome to Aeko";

    try {
      await this.sendEmail(email, subject, htmlContent, username);
      return { success: true, message: "Welcome email sent" };
    } catch (error) {
      console.error("Email sending error:", error.message);
      return { success: false, message: "Failed to send welcome email" };
    }
  }
}

export default new EmailService();
