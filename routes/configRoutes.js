import express from "express";

const router = express.Router();

/**
 * Client presentation config.
 *
 * The mobile app fetches this blob on ten screens to populate option lists,
 * categories, FAQs and tool palettes. The route did not exist, so every one of
 * those requests 404'd and the screens rendered empty (the client swallows the
 * failure).
 *
 * This is deliberately unauthenticated and static: the mobile client calls it
 * with the unauthenticated `request()` helper, and everything here is
 * presentation copy rather than per-user data. Keep it that way — anything
 * user-specific belongs on its own authenticated route.
 *
 * Shapes must match aeko-mobile/types/config.ts.
 */

const CONFIG = {
  settings: {
    // { label, value, change } — AdsStat
    adsStats: [
      { label: "Impressions", value: "0", change: "0%" },
      { label: "Clicks", value: "0", change: "0%" },
      { label: "Spend", value: "$0.00", change: "0%" },
      { label: "Conversions", value: "0", change: "0%" },
    ],

    // { question, answer, category } — Faq. Grouped in the help centre.
    faqs: [
      {
        category: "Getting started",
        question: "How do I create a post?",
        answer:
          "Tap the + button in the bottom tab bar, choose text, photo or video, write your caption, then tap Post.",
      },
      {
        category: "Getting started",
        question: "How do I add hashtags or tag someone?",
        answer:
          "Type # or @ directly in your caption, or use the buttons under the composer. Typing @ shows a list of matching accounts \u2014 pick one and it is added for you. Tagged people get a notification.",
      },
      {
        category: "Getting started",
        question: "What is the difference between a post and a status?",
        answer:
          "Posts stay on your profile until you delete them. A status disappears after 24 hours and shows you who viewed it.",
      },
      {
        category: "Privacy & safety",
        question: "How do I make my account private?",
        answer:
          "Open Settings, then Private Account, and turn the toggle on. Only approved followers will be able to see your posts.",
      },
      {
        category: "Privacy & safety",
        question: "How do I control who sees an individual post?",
        answer:
          "Tap Privacy on the composer before posting and choose Public, Followers, Close Friends or Only Me. You can change it later from the post's menu.",
      },
      {
        category: "Privacy & safety",
        question: "How do I block or report someone?",
        answer:
          "Open their profile, tap the menu in the top right, then Block or Report. Blocked accounts cannot message you, see your posts or find your profile. Manage them under Settings, then Blocked Accounts.",
      },
      {
        category: "Privacy & safety",
        question: "What is two-factor authentication?",
        answer:
          "It asks for a code from your authenticator app in addition to your password, so a stolen password alone is not enough to sign in. Turn it on under Settings, then Two-Factor Authentication, and keep your backup codes somewhere safe.",
      },
      {
        category: "Notifications",
        question: "How do I turn off notifications?",
        answer:
          "Open Settings, then Push Notifications, and switch off the categories you do not want. Pause All silences everything without changing your individual choices.",
      },
      {
        category: "Notifications",
        question: "Why am I not receiving notifications?",
        answer:
          "Check that notifications are allowed for Aeko in your device settings, that Pause All is off, and that you are signed in. Notifications only reach the device you most recently signed in on.",
      },
      {
        category: "Account",
        question: "How do I reset my password?",
        answer:
          "Sign out, tap Forgot Password on the login screen, and follow the code sent to your email address. Resetting signs you out everywhere else.",
      },
      {
        category: "Account",
        question: "How do I change my username or profile picture?",
        answer:
          "Open Settings, then Edit Profile. Your username must be unique across Aeko.",
      },
      {
        category: "Account",
        question: "How do I delete my account?",
        answer:
          "Open Settings, then Account, and choose Delete Account. This removes your posts, comments and messages and cannot be undone.",
      },
      {
        category: "Wallet",
        question: "What is the Aeko wallet?",
        answer:
          "It holds your AEKO balance and any NFTs you own. Your wallet is created for you when you first open it \u2014 there is no seed phrase to write down.",
      },
      {
        category: "Wallet",
        question: "Why did my transfer fail?",
        answer:
          "Most often the balance does not cover the amount plus the network fee, or the destination address is mistyped. Nothing is deducted when a transfer fails.",
      },
    ],

    // { code, name, nativeName } — LanguageOption
    languages: [
      { code: "en", name: "English", nativeName: "English" },
      { code: "fr", name: "French", nativeName: "Français" },
      { code: "es", name: "Spanish", nativeName: "Español" },
      { code: "pt", name: "Portuguese", nativeName: "Português" },
      { code: "ar", name: "Arabic", nativeName: "العربية" },
      { code: "sw", name: "Swahili", nativeName: "Kiswahili" },
      { code: "ha", name: "Hausa", nativeName: "Hausa" },
      { code: "yo", name: "Yoruba", nativeName: "Yorùbá" },
      { code: "ig", name: "Igbo", nativeName: "Asụsụ Igbo" },
      { code: "de", name: "German", nativeName: "Deutsch" },
      { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
      { code: "zh", name: "Chinese", nativeName: "中文" },
    ],

    // { value, label, description, icon } — VisibilityOption
    whoCanSeePostsOptions: [
      {
        value: "everyone",
        label: "Everyone",
        description: "Anyone on Aeko can see your posts.",
        icon: "globe-outline",
      },
      {
        value: "followers",
        label: "Followers",
        description: "Only people who follow you can see your posts.",
        icon: "people-outline",
      },
      {
        value: "close_friends",
        label: "Close Friends",
        description: "Only people on your close friends list can see your posts.",
        icon: "heart-outline",
      },
    ],
  },

  communities: {
    // Rendered as a horizontal filter strip; the first entry is the default.
    categories: [
      "All",
      "Technology",
      "Art & Design",
      "Music",
      "Gaming",
      "Sports",
      "Business",
      "Education",
      "Health & Fitness",
      "Food",
      "Travel",
      "Photography",
      "Crypto",
      "News",
    ],
  },

  nft: {
    donationPresetAmounts: [5, 10, 20, 40, 100, 250],
  },

  saved: {
    // { id, title, subtitle?, icon } — MenuItem
    menuItems: [
      {
        id: "posts",
        title: "Posts",
        subtitle: "Posts you have bookmarked",
        icon: "🔖",
      },
      {
        id: "reels",
        title: "Reels",
        subtitle: "Videos you have saved",
        icon: "🎬",
      },
      {
        id: "collections",
        title: "Collections",
        subtitle: "Your organised collections",
        icon: "📁",
      },
    ],
  },

  create: {
    // { icon, label } — CreateEditTool. Icons are Ionicons names.
    editTools: [
      { icon: "crop-outline", label: "Crop" },
      { icon: "color-filter-outline", label: "Filter" },
      { icon: "sunny-outline", label: "Adjust" },
      { icon: "text-outline", label: "Text" },
      { icon: "brush-outline", label: "Draw" },
      { icon: "happy-outline", label: "Sticker" },
    ],

    // { key, icon, label, description } — CreatePrivacyOption
    privacyOptions: [
      {
        key: "public",
        icon: "globe-outline",
        label: "Public",
        description: "Anyone on Aeko can see this post.",
      },
      {
        key: "followers",
        icon: "people-outline",
        label: "Followers",
        description: "Only your followers can see this post.",
      },
      {
        key: "custom",
        icon: "person-add-outline",
        label: "Close Friends",
        description: "Only people you choose can see this post.",
      },
      {
        key: "private",
        icon: "lock-closed-outline",
        label: "Only Me",
        description: "Nobody else can see this post.",
      },
    ],
  },
};

/**
 * @swagger
 * /api/config:
 *   get:
 *     tags: [Config]
 *     summary: Client presentation config (option lists, categories, FAQs)
 *     responses:
 *       200:
 *         description: Configuration blob consumed by the mobile client
 */
router.get("/", (req, res) => {
  // Static for the lifetime of the process; safe for clients to cache briefly.
  res.set("Cache-Control", "public, max-age=300");
  res.json(CONFIG);
});

export default router;
