import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { OAuth2Client } from 'google-auth-library';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { prisma } from './db.js';
import { ensureUserWallet } from '../services/walletProvisioning.js';

const googleClient = new OAuth2Client();

const splitAudienceList = (value) =>
  value
    ? value
        .split(',')
        .map((audience) => audience.trim())
        .filter(Boolean)
    : [];

/**
 * Return the Google OAuth client IDs whose ID tokens this API accepts.
 *
 * GOOGLE_ID_TOKEN_AUDIENCES is an explicit allow-list for deployments that
 * have separate web, iOS, and Android OAuth clients. Existing deployments
 * continue to work with GOOGLE_CLIENT_ID alone.
 */
const getGoogleIdTokenAudiences = () => {
  const configuredAudiences = splitAudienceList(
    process.env.GOOGLE_ID_TOKEN_AUDIENCES,
  );

  if (configuredAudiences.length > 0) {
    return [...new Set(configuredAudiences)];
  }

  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
  ]
    .map((audience) => audience?.trim())
    .filter(Boolean)
    .filter((audience, index, audiences) => audiences.indexOf(audience) === index);
};

const isGoogleIdTokenVerificationConfigured = () =>
  getGoogleIdTokenAudiences().length > 0;

const hasConflictingGoogleOAuthIdentity = (user, oauthId) =>
  Boolean(
    user?.oauthProvider &&
      (user.oauthProvider !== 'google' ||
        (user.oauthId && user.oauthId !== oauthId)),
  );

class GoogleIdTokenConfigurationError extends Error {
  constructor() {
    super('Google ID token verification is not configured');
    this.name = 'GoogleIdTokenConfigurationError';
  }
}

class GoogleIdTokenVerificationError extends Error {
  constructor() {
    super('Invalid Google ID token');
    this.name = 'GoogleIdTokenVerificationError';
  }
}

/**
 * Verify Google ID token
 * @param {string} idToken - The ID token from Google
 * @returns {Promise<Object>} - Verified token payload
 */
async function verifyGoogleIdToken(idToken) {
  if (typeof idToken !== 'string' || idToken.trim().length === 0) {
    throw new GoogleIdTokenVerificationError();
  }

  const audiences = getGoogleIdTokenAudiences();
  if (audiences.length === 0) {
    throw new GoogleIdTokenConfigurationError();
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: audiences,
    });
    const payload = ticket.getPayload();

    if (!payload) {
      throw new GoogleIdTokenVerificationError();
    }

    return payload;
  } catch (error) {
    if (error instanceof GoogleIdTokenVerificationError) {
      throw error;
    }

    // Do not log the provider error: it can include untrusted token details.
    console.warn('Google ID token verification failed');
    throw new GoogleIdTokenVerificationError();
  }
}

/**
 * Generate unique username
 * @param {string} baseUsername - Base username to start with
 * @returns {Promise<string>} - Unique username
 */
async function generateUniqueUsername(baseUsername) {
  let username = baseUsername.replace(/\s+/g, '').toLowerCase();
  let counter = 1;
  
  // Check if username exists and append number if needed
  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${baseUsername.replace(/\s+/g, '').toLowerCase()}${counter}`;
    counter++;
  }
  
  return username;
}

// Google OAuth strategy - only initialize if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
  }, async (accessToken, refreshToken, profile, done) => {
  try {
    // Verify ID token if available (enhanced security)
    if (profile._json && profile._json.sub) {
      // The 'sub' field is the unique Google user ID
      console.log('Google ID token verified for user:', profile._json.sub);
    }

    const email = profile.emails?.[0]?.value?.toLowerCase() || null;
    const oauthId = profile.id;

    // Validate that we have essential information
    if (!oauthId) {
      return done(new Error('No OAuth ID received from Google'));
    }

    // Try existing by provider id first
    let user = await prisma.user.findUnique({
        where: {
          oauthProvider_oauthId: { oauthProvider: 'google', oauthId },
        }
    });

    if (!user) {
      // If not found, try by email to link
      if (email) {
        user = await prisma.user.findUnique({ where: { email } });
      }

      if (user) {
        if (hasConflictingGoogleOAuthIdentity(user, oauthId)) {
          // A Google subject is stable; an email address must never replace
          // an existing OAuth identity. Linking a second provider belongs in
          // an authenticated account-settings flow.
          return done(null, false);
        }

        // Link existing account to Google OAuth
        const currentEmailVerification = user.emailVerification || {};
        
        user = await prisma.user.update({
            where: { id: user.id },
            data: {
                oauthProvider: 'google',
                oauthId: oauthId,
                avatar: profile.photos?.[0]?.value || user.avatar || '',
                emailVerification: { ...currentEmailVerification, isVerified: true }
            }
        });
        console.log(`Linked existing account ${email} to Google OAuth`);
      } else {
        // Create new user with unique username
        const usernameBase = profile.displayName || (email ? email.split('@')[0] : `user_${oauthId.slice(-6)}`);
        const username = await generateUniqueUsername(usernameBase);
        
        user = await prisma.user.create({
          data: {
            name: profile.displayName || username,
            username,
            email: email || `${oauthId}@google-oauth.local`,
            // OAuth accounts do not have a user-known password by default.
            password: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
            oauthProvider: 'google',
            oauthId,
            avatar: profile.photos?.[0]?.value || '',
            emailVerification: { isVerified: true },
          }
        });
        console.log(`Created new user ${username} via Google OAuth`);
      }
    }

    // New accounts get their wallet address here, and older accounts without
    // one pick it up on their next Google sign-in.
    if (!user.walletAddress) await ensureUserWallet(user.id);

    // Update last login timestamp and avatar if changed
    const updateData = { lastLoginAt: new Date() };
    if (profile.photos?.[0]?.value && user.avatar !== profile.photos[0].value) {
      updateData.avatar = profile.photos[0].value;
    }
    
    user = await prisma.user.update({
        where: { id: user.id },
        data: updateData
    });

    return done(null, user);
  } catch (err) {
    console.error('Google OAuth strategy error:', err);
    return done(err);
  }
  }));
} else {
  console.warn('Google OAuth credentials not configured. Google OAuth will be disabled.');
}

export {
  getGoogleIdTokenAudiences,
  GoogleIdTokenConfigurationError,
  GoogleIdTokenVerificationError,
  hasConflictingGoogleOAuthIdentity,
  isGoogleIdTokenVerificationConfigured,
  verifyGoogleIdToken,
};
export default passport;
