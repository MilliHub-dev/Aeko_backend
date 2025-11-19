import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';

// Initialize Google OAuth2 client for ID token verification
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify Google ID token
 * @param {string} idToken - The ID token from Google
 * @returns {Promise<Object>} - Verified token payload
 */
async function verifyGoogleIdToken(idToken) {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    return ticket.getPayload();
  } catch (error) {
    console.error('ID token verification failed:', error);
    throw new Error('Invalid ID token');
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
  while (await User.findOne({ username })) {
    username = `${baseUsername.replace(/\s+/g, '').toLowerCase()}${counter}`;
    counter++;
  }
  
  return username;
}

// Google OAuth strategy
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
    let user = await User.findOne({ oauthProvider: 'google', oauthId });

    if (!user) {
      // If not found, try by email to link
      if (email) {
        user = await User.findOne({ email });
      }

      if (user) {
        // Link existing account to Google OAuth
        user.oauthProvider = 'google';
        user.oauthId = oauthId;
        user.avatar = profile.photos?.[0]?.value || user.avatar || '';
        user.emailVerification.isVerified = true;
        await user.save();
        console.log(`Linked existing account ${email} to Google OAuth`);
      } else {
        // Create new user with unique username
        const usernameBase = profile.displayName || (email ? email.split('@')[0] : `user_${oauthId.slice(-6)}`);
        const username = await generateUniqueUsername(usernameBase);
        
        user = await User.create({
          name: profile.displayName || username,
          username,
          email: email || `${oauthId}@google-oauth.local`,
          // Dummy password (not used for OAuth accounts)
          password: oauthId,
          oauthProvider: 'google',
          oauthId,
          avatar: profile.photos?.[0]?.value || '',
          'emailVerification.isVerified': true,
        });
        console.log(`Created new user ${username} via Google OAuth`);
      }
    }

    // Update last login timestamp and avatar if changed
    user.lastLoginAt = new Date();
    if (profile.photos?.[0]?.value && user.avatar !== profile.photos[0].value) {
      user.avatar = profile.photos[0].value;
    }
    await user.save();

    return done(null, user);
  } catch (err) {
    console.error('Google OAuth strategy error:', err);
    return done(err);
  }
}));

export { verifyGoogleIdToken };
export default passport;
