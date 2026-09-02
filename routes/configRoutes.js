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

    // { question, answer } — Faq
    faqs: [
      {
        question: "How do I create a post?",
        answer:
          "Tap the + button in the bottom tab bar, choose text, photo or video, then tap Post.",
      },
      {
        question: "How do I make my account private?",
        answer:
          "Open Settings, then Private Account, and turn the toggle on. Only approved followers will see your posts.",
      },
      {
        question: "How do I control who sees my posts?",
        answer:
          "Open Settings, then Who Can See My Posts, and choose Everyone, Followers or Close Friends.",
      },
      {
        question: "How do I block someone?",
        answer:
          "Open their profile, tap the options menu in the top right, then tap Block. You can review blocked accounts in Settings.",
      },
      {
        question: "How do I turn off notifications?",
        answer:
          "Open Settings, then Push Notifications, and turn off the categories you do not want. Pause All silences everything.",
      },
      {
        question: "How do I reset my password?",
        answer:
          "Sign out, tap Forgot Password on the login screen, and follow the link sent to your email address.",
      },
      {
        question: "How do I delete my account?",
        answer:
          "Open Settings, then Account, and choose Delete Account. This is permanent and cannot be undone.",
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
