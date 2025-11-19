# Google OAuth Implementation Guide for React Native

Complete guide for implementing Google OAuth in your React Native mobile app.

---

## 📱 Overview

React Native requires a different approach than web apps because:
- No browser redirects (uses in-app browser or native modules)
- Different token handling
- Platform-specific configuration (iOS & Android)

---

## 🚀 Quick Start

### Option 1: Using Expo (Recommended for Expo projects)
### Option 2: Using React Native with `@react-native-google-signin/google-signin`

We'll cover both approaches.

---

## 📦 Option 1: Expo Implementation

### Step 1: Install Dependencies

```bash
npx expo install expo-auth-session expo-web-browser
```

### Step 2: Configure app.json

```json
{
  "expo": {
    "scheme": "aeko",
    "android": {
      "package": "com.yourcompany.aeko"
    },
    "ios": {
      "bundleIdentifier": "com.yourcompany.aeko"
    }
  }
}
```

### Step 3: Create OAuth Hook

```javascript
// hooks/useGoogleAuth.js
import { useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';

WebBrowser.maybeCompleteAuthSession();

const API_URL = 'http://your-backend-url.com'; // Change this

export default function useGoogleAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Create redirect URI
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'aeko',
    path: 'auth/callback'
  });

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);

      // Open in-app browser to backend OAuth endpoint
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_URL}/api/auth/google`,
        redirectUri
      );

      if (result.type === 'success') {
        // Extract token from URL
        const url = result.url;
        const token = extractTokenFromUrl(url);

        if (token) {
          // Store token
          await AsyncStorage.setItem('authToken', token);

          // Fetch user data
          const userData = await fetchUserData(token);
          setUser(userData);

          return { success: true, user: userData };
        } else {
          throw new Error('No token received');
        }
      } else if (result.type === 'cancel') {
        setError('Authentication cancelled');
        return { success: false, error: 'cancelled' };
      }
    } catch (err) {
      console.error('Google sign in error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
      setUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        const userData = await fetchUserData(token);
        setUser(userData);
      }
    } catch (err) {
      console.error('Check auth error:', err);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  return {
    user,
    loading,
    error,
    signInWithGoogle,
    signOut,
    isAuthenticated: !!user
  };
}

// Helper functions
function extractTokenFromUrl(url) {
  const match = url.match(/[?&]token=([^&]+)/);
  return match ? match[1] : null;
}

async function fetchUserData(token) {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user data');
  }

  const data = await response.json();
  return data.user;
}
```

### Step 4: Create Google Sign In Button

```javascript
// components/GoogleSignInButton.js
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useGoogleAuth from '../hooks/useGoogleAuth';

export default function GoogleSignInButton() {
  const { signInWithGoogle, loading, error } = useGoogleAuth();

  const handlePress = async () => {
    const result = await signInWithGoogle();
    if (result.success) {
      console.log('Signed in successfully:', result.user);
    } else {
      console.error('Sign in failed:', result.error);
    }
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.button}
        onPress={handlePress}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="logo-google" size={20} color="#fff" style={styles.icon} />
            <Text style={styles.text}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginVertical: 8,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: 'red',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});
```

### Step 5: Use in Your Login Screen

```javascript
// screens/LoginScreen.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import GoogleSignInButton from '../components/GoogleSignInButton';
import useGoogleAuth from '../hooks/useGoogleAuth';

export default function LoginScreen({ navigation }) {
  const { user, isAuthenticated } = useGoogleAuth();

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigation.replace('Home');
    }
  }, [isAuthenticated]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Aeko</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>
      
      <GoogleSignInButton />
      
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>Or</Text>
        <View style={styles.line} />
      </View>
      
      {/* Your email/password form here */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#666',
  },
});
```

---

## 📦 Option 2: React Native CLI Implementation

### Step 1: Install Dependencies

```bash
npm install @react-native-google-signin/google-signin
npm install @react-native-async-storage/async-storage
```

### Step 2: Configure Android

#### 2.1 Get SHA-1 Certificate Fingerprint

```bash
cd android
./gradlew signingReport
```

Copy the SHA-1 fingerprint.

#### 2.2 Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to "Credentials"
4. Create "OAuth 2.0 Client ID" for Android:
   - Application type: Android
   - Package name: `com.yourcompany.aeko`
   - SHA-1: Paste your SHA-1 fingerprint
5. Copy the Client ID

#### 2.3 Update android/app/build.gradle

```gradle
dependencies {
    // ... other dependencies
    implementation 'com.google.android.gms:play-services-auth:20.7.0'
}
```

### Step 3: Configure iOS

#### 3.1 Install Pods

```bash
cd ios
pod install
cd ..
```

#### 3.2 Configure Google Cloud Console

1. Create "OAuth 2.0 Client ID" for iOS:
   - Application type: iOS
   - Bundle ID: `com.yourcompany.aeko`
2. Copy the Client ID

#### 3.3 Update Info.plist

Add your reversed client ID:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.YOUR-CLIENT-ID</string>
    </array>
  </dict>
</array>
```

### Step 4: Create Auth Service

```javascript
// services/authService.js
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://your-backend-url.com';

// Configure Google Sign In
GoogleSignin.configure({
  webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // From Google Cloud Console
  offlineAccess: true,
  forceCodeForRefreshToken: true,
});

class AuthService {
  async signInWithGoogle() {
    try {
      // Check if device supports Google Play Services
      await GoogleSignin.hasPlayServices();

      // Get user info
      const userInfo = await GoogleSignin.signIn();

      // Get ID token
      const tokens = await GoogleSignin.getTokens();
      const idToken = tokens.idToken;

      // Send ID token to your backend
      const response = await fetch(`${API_URL}/api/auth/google/mobile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken: idToken,
          user: userInfo.user,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Store token
        await AsyncStorage.setItem('authToken', data.token);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));

        return { success: true, user: data.user };
      } else {
        throw new Error(data.message || 'Authentication failed');
      }
    } catch (error) {
      console.error('Google Sign In Error:', error);
      return { success: false, error: error.message };
    }
  }

  async signOut() {
    try {
      await GoogleSignin.signOut();
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
      return { success: true };
    } catch (error) {
      console.error('Sign Out Error:', error);
      return { success: false, error: error.message };
    }
  }

  async getCurrentUser() {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return null;

      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      return data.success ? data.user : null;
    } catch (error) {
      console.error('Get Current User Error:', error);
      return null;
    }
  }

  async isSignedIn() {
    const token = await AsyncStorage.getItem('authToken');
    return !!token;
  }
}

export default new AuthService();
```

### Step 5: Create Backend Endpoint for Mobile

Add this to your `routes/auth.js`:

```javascript
// Mobile Google OAuth endpoint
router.post('/google/mobile', async (req, res) => {
  try {
    const { idToken, user } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'ID token is required'
      });
    }

    // Verify the ID token
    const { verifyGoogleIdToken } = await import('../config/passport.js');
    const payload = await verifyGoogleIdToken(idToken);

    if (!payload) {
      return res.status(401).json({
        success: false,
        message: 'Invalid ID token'
      });
    }

    const email = payload.email?.toLowerCase();
    const oauthId = payload.sub;

    // Find or create user (same logic as web OAuth)
    let dbUser = await User.findOne({ oauthProvider: 'google', oauthId });

    if (!dbUser) {
      if (email) {
        dbUser = await User.findOne({ email });
      }

      if (dbUser) {
        // Link existing account
        dbUser.oauthProvider = 'google';
        dbUser.oauthId = oauthId;
        dbUser.avatar = user.photo || dbUser.avatar || '';
        dbUser.emailVerification.isVerified = true;
        await dbUser.save();
      } else {
        // Create new user
        const usernameBase = user.name || (email ? email.split('@')[0] : `user_${oauthId.slice(-6)}`);
        let username = usernameBase.replace(/\s+/g, '').toLowerCase();
        let counter = 1;
        
        while (await User.findOne({ username })) {
          username = `${usernameBase.replace(/\s+/g, '').toLowerCase()}${counter}`;
          counter++;
        }

        dbUser = await User.create({
          name: user.name || username,
          username,
          email: email || `${oauthId}@google-oauth.local`,
          password: oauthId,
          oauthProvider: 'google',
          oauthId,
          avatar: user.photo || '',
          'emailVerification.isVerified': true,
        });
      }
    }

    // Update last login
    dbUser.lastLoginAt = new Date();
    await dbUser.save();

    // Generate JWT
    const token = jwt.sign(
      { id: dbUser._id, email: dbUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        _id: dbUser._id,
        name: dbUser.name,
        username: dbUser.username,
        email: dbUser.email,
        profilePicture: dbUser.profilePicture,
        avatar: dbUser.avatar,
        bio: dbUser.bio,
        blueTick: dbUser.blueTick,
        goldenTick: dbUser.goldenTick,
        aekoBalance: dbUser.aekoBalance,
        emailVerification: { isVerified: dbUser.emailVerification.isVerified },
        profileCompletion: dbUser.profileCompletion,
        isAdmin: dbUser.isAdmin,
        oauthProvider: dbUser.oauthProvider,
      }
    });
  } catch (error) {
    console.error('Mobile Google OAuth error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
});
```

### Step 6: Create Google Sign In Button

```javascript
// components/GoogleSignInButton.js
import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import authService from '../services/authService';

export default function GoogleSignInButton({ onSuccess, onError }) {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    setLoading(true);
    const result = await authService.signInWithGoogle();
    setLoading(false);

    if (result.success) {
      onSuccess?.(result.user);
    } else {
      onError?.(result.error);
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handlePress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Icon name="google" size={20} color="#fff" style={styles.icon} />
          <Text style={styles.text}>Continue with Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  icon: {
    marginRight: 12,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

---

## 🔐 Making Authenticated API Requests

### Create API Service

```javascript
// services/apiService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://your-backend-url.com';

class ApiService {
  async request(endpoint, options = {}) {
    try {
      const token = await AsyncStorage.getItem('authToken');

      const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export default new ApiService();
```

### Usage Example

```javascript
import apiService from '../services/apiService';

// Get user profile
const profile = await apiService.get('/api/users/profile');

// Create a post
const post = await apiService.post('/api/posts', {
  content: 'Hello world!',
});
```

---

## 🎯 Complete Example App

```javascript
// App.js
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import authService from './services/authService';

import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import LoadingScreen from './screens/LoadingScreen';

const Stack = createStackNavigator();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const signedIn = await authService.isSignedIn();
    setIsAuthenticated(signedIn);
    setIsLoading(false);
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Home" component={HomeScreen} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

---

## 🧪 Testing

### Test on Android

```bash
npx react-native run-android
```

### Test on iOS

```bash
npx react-native run-ios
```

### Debug Tips

1. **Check logs:**
   ```bash
   npx react-native log-android
   npx react-native log-ios
   ```

2. **Verify Google Sign In configuration:**
   ```javascript
   import { GoogleSignin } from '@react-native-google-signin/google-signin';
   
   const config = GoogleSignin.getCurrentUser();
   console.log('Google Config:', config);
   ```

3. **Test token storage:**
   ```javascript
   import AsyncStorage from '@react-native-async-storage/async-storage';
   
   const token = await AsyncStorage.getItem('authToken');
   console.log('Stored Token:', token);
   ```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. "DEVELOPER_ERROR" on Android
- Verify SHA-1 fingerprint matches Google Console
- Check package name matches
- Ensure Google Play Services is installed

#### 2. "Sign in cancelled" on iOS
- Verify Bundle ID matches Google Console
- Check Info.plist configuration
- Ensure URL scheme is correct

#### 3. "Network request failed"
- Check API_URL is correct
- Verify backend is running
- Check device/emulator can reach backend

#### 4. "Token not found"
- Verify AsyncStorage permissions
- Check token is being saved correctly
- Ensure backend returns token

---

## 📝 Environment Configuration

### Development

```javascript
// config/env.js
const ENV = {
  dev: {
    apiUrl: 'http://10.0.2.2:5000', // Android emulator
    // apiUrl: 'http://localhost:5000', // iOS simulator
    googleWebClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  },
  prod: {
    apiUrl: 'https://api.yourdomain.com',
    googleWebClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  },
};

const getEnvVars = () => {
  if (__DEV__) {
    return ENV.dev;
  }
  return ENV.prod;
};

export default getEnvVars();
```

---

## ✅ Checklist

### Backend
- [ ] `/api/auth/google/mobile` endpoint created
- [ ] ID token verification implemented
- [ ] CORS configured for mobile
- [ ] Backend running and accessible

### Android
- [ ] SHA-1 fingerprint added to Google Console
- [ ] OAuth Client ID created for Android
- [ ] Package name matches
- [ ] Google Play Services dependency added

### iOS
- [ ] OAuth Client ID created for iOS
- [ ] Bundle ID matches
- [ ] Info.plist configured
- [ ] Pods installed

### React Native
- [ ] Dependencies installed
- [ ] Auth service created
- [ ] API service created
- [ ] Google Sign In button implemented
- [ ] Navigation configured
- [ ] Token storage implemented

---

## 🚀 Next Steps

1. Test on both Android and iOS
2. Implement error handling
3. Add loading states
4. Handle token refresh
5. Add biometric authentication
6. Implement deep linking
7. Add analytics

---

**Need help?** Check the main documentation in `docs/GOOGLE_OAUTH_SETUP_GUIDE.md`
