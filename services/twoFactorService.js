import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from "../config/db.js";
import SecurityLogger from './securityLogger.js';

class TwoFactorService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.secretKey = process.env.TWO_FACTOR_SECRET_KEY || crypto.randomBytes(32);
  }

  /**
   * Generate a TOTP secret for a user
   * @param {string} userId - The user ID
   * @returns {Object} - Object containing secret and otpauth_url
   */
  async generateSecret(userId) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new Error('User not found');
      }

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `Aeko (${user.username})`,
        issuer: 'Aeko Social Platform',
        length: 32
      });

      return {
        secret: secret.base32,
        otpauth_url: secret.otpauth_url,
        manual_entry_key: secret.base32
      };
    } catch (error) {
      throw new Error(`Failed to generate secret: ${error.message}`);
    }
  }

  /**
   * Generate QR code for authenticator app setup
   * @param {string} userId - The user ID
   * @param {string} secret - The TOTP secret
   * @returns {string} - Base64 encoded QR code image
   */
  async generateQRCode(userId, secret) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new Error('User not found');
      }

      const otpauth_url = speakeasy.otpauthURL({
        secret: secret,
        label: `Aeko (${user.username})`,
        issuer: 'Aeko Social Platform',
        encoding: 'base32'
      });

      // Generate QR code as data URL
      const qrCodeDataURL = await QRCode.toDataURL(otpauth_url);
      return qrCodeDataURL;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  /**
   * Verify TOTP token
   * @param {string} userId - The user ID
   * @param {string} token - The TOTP token to verify
   * @param {Object} req - Express request object for logging
   * @returns {boolean} - True if token is valid
   */
  async verifyTOTP(userId, token, req = null) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const twoFactorAuth = user?.twoFactorAuth || {};
      
      if (!user || !twoFactorAuth.isEnabled || !twoFactorAuth.secret) {
        const error = new Error('2FA not enabled for this user');
        await SecurityLogger.log2FAUsedEvent(userId, req, false, error.message);
        throw error;
      }

      // Decrypt the stored secret
      const decryptedSecret = this.decryptSecret(twoFactorAuth.secret);

      // Verify the token with a window of ±1 (30 seconds before/after)
      const verified = speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: 'base32',
        token: token,
        window: 1
      });

      if (verified) {
        // Update last used timestamp
        twoFactorAuth.lastUsed = new Date();
        await prisma.user.update({
          where: { id: userId },
          data: { twoFactorAuth }
        });

        // Log successful 2FA usage
        await SecurityLogger.log2FAUsedEvent(userId, req, true, null, { method: 'totp' });
      } else {
        // Log failed 2FA attempt
        await SecurityLogger.log2FAUsedEvent(userId, req, false, 'Invalid TOTP token', { method: 'totp' });
      }

      return verified;
    } catch (error) {
      // Log failed 2FA attempt if not already logged
      if (!error.message.includes('2FA not enabled')) {
        await SecurityLogger.log2FAUsedEvent(userId, req, false, error.message, { method: 'totp' });
      }
      throw new Error(`Failed to verify TOTP: ${error.message}`);
    }
  }

  /**
   * Generate backup codes for account recovery
   * @param {string} userId - The user ID
   * @param {number} count - Number of backup codes to generate (default: 10)
   * @param {Object} req - Express request object for logging
   * @returns {Array} - Array of backup codes
   */
  async generateBackupCodes(userId, count = 10, req = null) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        const error = new Error('User not found');
        await SecurityLogger.logBackupCodesGeneratedEvent(userId, req, false, error.message);
        throw error;
      }

      const backupCodes = [];
      const hashedCodes = [];

      // Generate backup codes
      for (let i = 0; i < count; i++) {
        // Generate 8-character alphanumeric code
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        backupCodes.push(code);

        // Hash the code for storage
        const hashedCode = await bcrypt.hash(code, 12);
        hashedCodes.push({
          code: hashedCode,
          used: false,
          usedAt: null
        });
      }

      // Update user with new backup codes
      const twoFactorAuth = user.twoFactorAuth || {};
      twoFactorAuth.backupCodes = hashedCodes;
      
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorAuth }
      });

      // Log successful backup code generation
      await SecurityLogger.logBackupCodesGeneratedEvent(userId, req, true, null, {
        codesCount: count,
        regenerated: (twoFactorAuth.backupCodes || []).length > 0
      });

      return backupCodes;
    } catch (error) {
      // Log failed backup code generation if not already logged
      if (!error.message.includes('User not found')) {
        await SecurityLogger.logBackupCodesGeneratedEvent(userId, req, false, error.message);
      }
      throw new Error(`Failed to generate backup codes: ${error.message}`);
    }
  }

  /**
   * Verify backup code
   * @param {string} userId - The user ID
   * @param {string} code - The backup code to verify
   * @param {Object} req - Express request object for logging
   * @returns {boolean} - True if backup code is valid and unused
   */
  async verifyBackupCode(userId, code, req = null) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const twoFactorAuth = user?.twoFactorAuth || {};
      
      if (!user || !twoFactorAuth.isEnabled) {
        const error = new Error('2FA not enabled for this user');
        await SecurityLogger.logBackupCodeUsedEvent(userId, req, false, error.message);
        throw error;
      }

      // Find matching unused backup code
      let backupCodeIndex = -1;
      const backupCodes = twoFactorAuth.backupCodes || [];
      
      for (let i = 0; i < backupCodes.length; i++) {
        const storedCode = backupCodes[i];
        if (!storedCode.used && await bcrypt.compare(code, storedCode.code)) {
          backupCodeIndex = i;
          break;
        }
      }

      if (backupCodeIndex === -1) {
        // Log failed backup code attempt
        await SecurityLogger.logBackupCodeUsedEvent(userId, req, false, 'Invalid or already used backup code');
        return false;
      }

      // Mark the backup code as used
      backupCodes[backupCodeIndex].used = true;
      backupCodes[backupCodeIndex].usedAt = new Date();
      twoFactorAuth.lastUsed = new Date();
      twoFactorAuth.backupCodes = backupCodes;

      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorAuth }
      });

      // Calculate remaining codes
      const remainingCodes = backupCodes.filter(c => !c.used).length;

      // Log successful backup code usage
      await SecurityLogger.logBackupCodeUsedEvent(userId, req, true, null, {
        codeIndex: backupCodeIndex,
        remainingCodes
      });

      return true;
    } catch (error) {
      // Log failed backup code attempt if not already logged
      if (!error.message.includes('2FA not enabled')) {
        await SecurityLogger.logBackupCodeUsedEvent(userId, req, false, error.message);
      }
      throw new Error(`Failed to verify backup code: ${error.message}`);
    }
  }

  /**
   * Encrypt secret for secure storage
   * @param {string} secret - The secret to encrypt
   * @returns {string} - Encrypted secret with IV
   */
  encryptSecret(secret) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipherGCM(this.algorithm, this.secretKey, iv);
      
      let encrypted = cipher.update(secret, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine IV, authTag, and encrypted data
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      throw new Error(`Failed to encrypt secret: ${error.message}`);
    }
  }

  /**
   * Decrypt secret from storage
   * @param {string} encryptedSecret - The encrypted secret with IV
   * @returns {string} - Decrypted secret
   */
  decryptSecret(encryptedSecret) {
    try {
      const parts = encryptedSecret.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted secret format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipherGCM(this.algorithm, this.secretKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Failed to decrypt secret: ${error.message}`);
    }
  }

  /**
   * Check if user has 2FA enabled
   * @param {string} userId - The user ID
   * @returns {boolean} - True if 2FA is enabled
   */
  async is2FAEnabled(userId) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const twoFactorAuth = user?.twoFactorAuth || {};
      return user && twoFactorAuth.isEnabled;
    } catch (error) {
      return false;
    }
  }

  /**
   * Enable two-factor authentication for a user
   * @param {string} userId - The user ID
   * @param {string} secret - The TOTP secret
   * @param {string} verificationToken - The TOTP token for verification
   * @param {Object} req - Express request object for logging
   * @returns {Array} - Array of backup codes
   */
  async enableTwoFactor(userId, secret, verificationToken, req = null) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        const error = new Error('User not found');
        await SecurityLogger.log2FAEnabledEvent(userId, req, false, error.message);
        throw error;
      }

      const twoFactorAuth = user.twoFactorAuth || {};

      if (twoFactorAuth.isEnabled) {
        const error = new Error('2FA is already enabled for this user');
        await SecurityLogger.log2FAEnabledEvent(userId, req, false, error.message);
        throw error;
      }

      // Verify the TOTP token before enabling
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: verificationToken,
        window: 1
      });

      if (!verified) {
        const error = new Error('Invalid verification token');
        await SecurityLogger.log2FAEnabledEvent(userId, req, false, error.message);
        throw error;
      }

      // Encrypt the secret for storage
      const encryptedSecret = this.encryptSecret(secret);

      // Generate backup codes
      const backupCodes = [];
      const hashedCodes = [];

      for (let i = 0; i < 10; i++) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        backupCodes.push(code);

        const hashedCode = await bcrypt.hash(code, 12);
        hashedCodes.push({
          code: hashedCode,
          used: false,
          usedAt: null
        });
      }

      // Update user with 2FA settings
      const updatedAuth = {
        ...twoFactorAuth,
        isEnabled: true,
        secret: encryptedSecret,
        backupCodes: hashedCodes,
        enabledAt: new Date(),
        lastUsed: new Date()
      };

      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorAuth: updatedAuth }
      });

      // Log successful 2FA enablement
      await SecurityLogger.log2FAEnabledEvent(userId, req, true, null, { method: 'totp' });

      return backupCodes;
    } catch (error) {
      // Log failed 2FA enablement if not already logged
      if (!error.message.includes('User not found') && 
          !error.message.includes('already enabled') && 
          !error.message.includes('Invalid verification')) {
        await SecurityLogger.log2FAEnabledEvent(userId, req, false, error.message);
      }
      throw new Error(`Failed to enable 2FA: ${error.message}`);
    }
  }

  /**
   * Disable two-factor authentication for a user
   * @param {string} userId - The user ID
   * @param {string} password - User's current password
   * @param {string} totpToken - Current TOTP token for verification
   * @param {Object} req - Express request object for logging
   * @returns {boolean} - True if successfully disabled
   */
  async disableTwoFactor(userId, password, totpToken, req = null) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        const error = new Error('User not found');
        await SecurityLogger.log2FADisabledEvent(userId, req, false, error.message);
        throw error;
      }

      const twoFactorAuth = user.twoFactorAuth || {};

      if (!twoFactorAuth.isEnabled) {
        const error = new Error('2FA is not enabled for this user');
        await SecurityLogger.log2FADisabledEvent(userId, req, false, error.message);
        throw error;
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.password);
      if (!passwordValid) {
        const error = new Error('Invalid password');
        await SecurityLogger.log2FADisabledEvent(userId, req, false, error.message);
        throw error;
      }

      // Verify TOTP token (without logging since verifyTOTP will handle it)
      const totpValid = await this.verifyTOTP(userId, totpToken, req);
      if (!totpValid) {
        const error = new Error('Invalid TOTP token');
        await SecurityLogger.log2FADisabledEvent(userId, req, false, error.message);
        throw error;
      }

      // Disable 2FA and clear all related data
      const updatedAuth = {
        ...twoFactorAuth,
        isEnabled: false,
        secret: null,
        backupCodes: [],
        enabledAt: null,
        lastUsed: null
      };

      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorAuth: updatedAuth }
      });

      // Log successful 2FA disablement
      await SecurityLogger.log2FADisabledEvent(userId, req, true, null, { method: 'manual' });

      return true;
    } catch (error) {
      // Log failed 2FA disablement if not already logged
      if (!error.message.includes('User not found') && 
          !error.message.includes('not enabled') && 
          !error.message.includes('Invalid password') &&
          !error.message.includes('Invalid TOTP')) {
        await SecurityLogger.log2FADisabledEvent(userId, req, false, error.message);
      }
      throw new Error(`Failed to disable 2FA: ${error.message}`);
    }
  }

  /**
   * Verify backup code for emergency access
   * @param {string} userId - The user ID
   * @param {string} code - The backup code to verify
   * @returns {boolean} - True if backup code is valid and unused
   */
  async verifyBackupCodeForLogin(userId, code) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const twoFactorAuth = user?.twoFactorAuth || {};

      if (!user || !twoFactorAuth.isEnabled) {
        throw new Error('2FA not enabled for this user');
      }

      const backupCodes = twoFactorAuth.backupCodes || [];

      // Find matching unused backup code
      let backupCodeIndex = -1;
      for (let i = 0; i < backupCodes.length; i++) {
        const storedCode = backupCodes[i];
        if (!storedCode.used && await bcrypt.compare(code, storedCode.code)) {
          backupCodeIndex = i;
          break;
        }
      }

      if (backupCodeIndex === -1) {
        return false;
      }

      // Mark the backup code as used
      backupCodes[backupCodeIndex].used = true;
      backupCodes[backupCodeIndex].usedAt = new Date();

      const updatedAuth = {
        ...twoFactorAuth,
        backupCodes: backupCodes,
        lastUsed: new Date()
      };

      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorAuth: updatedAuth }
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to verify backup code: ${error.message}`);
    }
  }

  /**
   * Validate login with 2FA
   * @param {string} userId - The user ID
   * @param {string} totpToken - The TOTP token to verify
   * @returns {boolean} - True if token is valid
   */
  async validateLoginWith2FA(userId, totpToken) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const twoFactorAuth = user?.twoFactorAuth || {};

      if (!user || !twoFactorAuth.isEnabled) {
        throw new Error('2FA not enabled for this user');
      }

      return await this.verifyTOTP(userId, totpToken);
    } catch (error) {
      throw new Error(`Failed to validate 2FA login: ${error.message}`);
    }
  }

  /**
   * Get 2FA status for user
   * @param {string} userId - The user ID
   * @returns {Object} - 2FA status information
   */
  async get2FAStatus(userId) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new Error('User not found');
      }

      const twoFactorAuth = user.twoFactorAuth || {};

      return {
        isEnabled: twoFactorAuth.isEnabled || false,
        enabledAt: twoFactorAuth.enabledAt || null,
        lastUsed: twoFactorAuth.lastUsed || null,
        backupCodesCount: (twoFactorAuth.backupCodes || []).filter(code => !code.used).length
      };
    } catch (error) {
      throw new Error(`Failed to get 2FA status: ${error.message}`);
    }
  }
}

export default new TwoFactorService();