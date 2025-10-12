import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';

// Google OAuth strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value?.toLowerCase() || null;
    const oauthId = profile.id;

    // Try existing by provider id first
    let user = await User.findOne({ oauthProvider: 'google', oauthId });

    if (!user) {
      // If not found, try by email to link
      if (email) {
        user = await User.findOne({ email });
      }

      if (user) {
        // Link
        user.oauthProvider = 'google';
        user.oauthId = oauthId;
        user.avatar = profile.photos?.[0]?.value || user.avatar || '';
        user.emailVerification.isVerified = true;
        await user.save();
      } else {
        // Create
        const usernameBase = profile.displayName || (email ? email.split('@')[0] : `user_${oauthId.slice(-6)}`);
        const username = usernameBase.replace(/\s+/g, '').toLowerCase();
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
      }
    }

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await user.save();

    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

export default passport;
