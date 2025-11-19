# React Native Google OAuth - Quick Start

Get Google OAuth working in your React Native app in 15 minutes.

---

## 🎯 Choose Your Path

### Path A: Expo (Easier, Recommended)
- ✅ Simpler setup
- ✅ Works with Expo Go
- ✅ Cross-platform by default
- ❌ Limited customization

### Path B: React Native CLI (More Control)
- ✅ Full native control
- ✅ Better performance
- ✅ More customization
- ❌ More complex setup

---

## 🚀 Path A: Expo (15 minutes)

### 1. Install (2 min)
```bash
npx expo install expo-auth-session expo-web-browser @react-native-async-storage/async-storage
```

### 2. Backend Endpoint (Already Done! ✅)
The `/api/auth/google/mobile` endpoint is already created in your backend.

### 3. Create Auth Hook (5 min)
```javascript
// hooks/useGoogleAuth.js
import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

WebBrowser.maybeCompleteAuthSession();

const API_URL = 'http://YOUR_BACKEND_URL';

export default function useGoogleAuth() {
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_URL}/api/auth/google`,
        'aeko://auth/callback'
      );

      if (result.type === 'success') {
        const token = result.url.match(/token=([^&]+)/)?.[1];
        if (token) {
          await AsyncStorage.setItem('authToken', token);
          return { success: true };
        }
      }
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return { signIn, loading };
}
```

### 4. Add Button (3 min)
```javascript
// screens/LoginScreen.js
import { TouchableOpacity, Text } from 'react-native';
import useGoogleAuth from '../hooks/useGoogleAuth';

export default function LoginScreen() {
  const { signIn, loading } = useGoogleAuth();

  return (
    <TouchableOpacity 
      onPress={signIn}
      disabled={loading}
      style={{ backgroundColor: '#4285F4', padding: 15, borderRadius: 8 }}
    >
      <Text style={{ color: 'white', textAlign: 'center' }}>
        {loading ? 'Loading...' : 'Sign in with Google'}
      </Text>
    </TouchableOpacity>
  );
}
```

### 5. Configure app.json (2 min)
```json
{
  "expo": {
    "scheme": "aeko"
  }
}
```

### 6. Test (3 min)
```bash
npx expo start
```

**Done! 🎉**

---

## 🚀 Path B: React Native CLI (20 minutes)

### 1. Install (3 min)
```bash
npm install @react-native-google-signin/google-signin @react-native-async-storage/async-storage
cd ios && pod install && cd ..
```

### 2. Get Google Credentials (5 min)

#### Android:
```bash
cd android && ./gradlew signingReport
```
Copy SHA-1, add to [Google Console](https://console.cloud.google.com/)

#### iOS:
Add Bundle ID to [Google Console](https://console.cloud.google.com/)

### 3. Configure (5 min)

#### Android: `android/app/build.gradle`
```gradle
dependencies {
    implementation 'com.google.android.gms:play-services-auth:20.7.0'
}
```

#### iOS: `ios/YourApp/Info.plist`
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

### 4. Create Auth Service (5 min)
```javascript
// services/authService.js
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';

GoogleSignin.configure({
  webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
});

const API_URL = 'http://YOUR_BACKEND_URL';

export const signInWithGoogle = async () => {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const tokens = await GoogleSignin.getTokens();

    const response = await fetch(`${API_URL}/api/auth/google/mobile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: tokens.idToken,
        user: userInfo.user,
      }),
    });

    const data = await response.json();
    if (data.success) {
      await AsyncStorage.setItem('authToken', data.token);
      return { success: true, user: data.user };
    }
    return { success: false };
  } catch (error) {
    console.error(error);
    return { success: false, error: error.message };
  }
};
```

### 5. Add Button (2 min)
```javascript
import { TouchableOpacity, Text } from 'react-native';
import { signInWithGoogle } from '../services/authService';

export default function LoginScreen() {
  const handlePress = async () => {
    const result = await signInWithGoogle();
    if (result.success) {
      // Navigate to home
    }
  };

  return (
    <TouchableOpacity 
      onPress={handlePress}
      style={{ backgroundColor: '#4285F4', padding: 15, borderRadius: 8 }}
    >
      <Text style={{ color: 'white', textAlign: 'center' }}>
        Sign in with Google
      </Text>
    </TouchableOpacity>
  );
}
```

### 6. Test
```bash
npx react-native run-android
npx react-native run-ios
```

**Done! 🎉**

---

## 🔧 Backend Configuration

### Already Configured! ✅

Your backend already has:
- ✅ `/api/auth/google/mobile` endpoint
- ✅ ID token verification
- ✅ User creation/linking
- ✅ JWT token generation

Just make sure your backend is running:
```bash
npm run dev
```

---

## 📱 Testing

### Test Backend
```bash
# In backend directory
npm run test:oauth
```

### Test Mobile App

#### Expo:
```bash
npx expo start
# Press 'a' for Android or 'i' for iOS
```

#### React Native CLI:
```bash
# Android
npx react-native run-android

# iOS
npx react-native run-ios
```

---

## 🐛 Common Issues

### "DEVELOPER_ERROR" (Android)
```bash
# Get correct SHA-1
cd android && ./gradlew signingReport

# Add to Google Console
# Credentials > OAuth 2.0 Client IDs > Android
```

### "Sign in cancelled" (iOS)
```bash
# Check Info.plist has correct URL scheme
# Format: com.googleusercontent.apps.YOUR-CLIENT-ID
```

### "Network request failed"
```javascript
// For Android emulator, use:
const API_URL = 'http://10.0.2.2:5000';

// For iOS simulator, use:
const API_URL = 'http://localhost:5000';

// For physical device, use your computer's IP:
const API_URL = 'http://192.168.1.XXX:5000';
```

---

## 📚 Full Documentation

Need more details? See:
- **Complete Guide**: [GOOGLE_OAUTH_REACT_NATIVE_GUIDE.md](GOOGLE_OAUTH_REACT_NATIVE_GUIDE.md)
- **Web Setup**: [GOOGLE_OAUTH_SETUP_GUIDE.md](GOOGLE_OAUTH_SETUP_GUIDE.md)
- **API Reference**: [GOOGLE_OAUTH_QUICK_REFERENCE.md](GOOGLE_OAUTH_QUICK_REFERENCE.md)

---

## ✅ Checklist

### Backend
- [ ] Backend running (`npm run dev`)
- [ ] `/api/auth/google/mobile` endpoint working
- [ ] CORS configured for mobile

### Mobile App
- [ ] Dependencies installed
- [ ] Google credentials configured
- [ ] Auth service created
- [ ] Sign in button added
- [ ] Token storage implemented

### Google Console
- [ ] Project created
- [ ] OAuth consent screen configured
- [ ] Android client ID created (if using Android)
- [ ] iOS client ID created (if using iOS)
- [ ] Web client ID created (for backend)

---

## 🎉 Success!

Once everything is working:
1. User taps "Sign in with Google"
2. Google sign in screen appears
3. User grants permission
4. Token is stored in AsyncStorage
5. User is logged in!

**Next Steps:**
- Add user profile screen
- Implement logout
- Add token refresh
- Handle errors gracefully

---

**Questions?** Check the [full React Native guide](GOOGLE_OAUTH_REACT_NATIVE_GUIDE.md)
