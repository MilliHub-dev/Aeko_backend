// Virtual gift catalog — each gift has a unique id, display name, coin cost,
// an emoji/icon, and an animation type for the frontend to render.
export const GIFT_CATALOG = [
  {
    id: 'rose',
    name: 'Rose',
    emoji: '🌹',
    coinCost: 10,
    animation: 'float',
    category: 'basic',
    description: 'A beautiful rose for the streamer',
  },
  {
    id: 'heart',
    name: 'Heart',
    emoji: '❤️',
    coinCost: 20,
    animation: 'pulse',
    category: 'basic',
    description: 'Show some love',
  },
  {
    id: 'star',
    name: 'Star',
    emoji: '⭐',
    coinCost: 50,
    animation: 'spin',
    category: 'standard',
    description: 'You\'re a star!',
  },
  {
    id: 'fire',
    name: 'Fire',
    emoji: '🔥',
    coinCost: 100,
    animation: 'burst',
    category: 'standard',
    description: 'This stream is on fire',
  },
  {
    id: 'diamond',
    name: 'Diamond',
    emoji: '💎',
    coinCost: 250,
    animation: 'sparkle',
    category: 'premium',
    description: 'Diamond tier appreciation',
  },
  {
    id: 'crown',
    name: 'Crown',
    emoji: '👑',
    coinCost: 500,
    animation: 'crown_drop',
    category: 'premium',
    description: 'Crown the streamer',
  },
  {
    id: 'rocket',
    name: 'Rocket',
    emoji: '🚀',
    coinCost: 1000,
    animation: 'launch',
    category: 'elite',
    description: 'Send them to the moon',
  },
  {
    id: 'trophy',
    name: 'Trophy',
    emoji: '🏆',
    coinCost: 2000,
    animation: 'confetti',
    category: 'elite',
    description: 'The ultimate tribute',
  },
];

// Coin packages available for purchase
export const COIN_PACKAGES = [
  { id: 'coins_100',  coins: 100,   priceUSD: 0.99,  pricePaise: 99,   label: '100 Coins' },
  { id: 'coins_500',  coins: 500,   priceUSD: 4.99,  pricePaise: 499,  label: '500 Coins' },
  { id: 'coins_1200', coins: 1200,  priceUSD: 9.99,  pricePaise: 999,  label: '1,200 Coins', bonus: 200 },
  { id: 'coins_2500', coins: 2500,  priceUSD: 19.99, pricePaise: 1999, label: '2,500 Coins', bonus: 500 },
  { id: 'coins_6500', coins: 6500,  priceUSD: 49.99, pricePaise: 4999, label: '6,500 Coins', bonus: 1500 },
];

// How many coins the host earns per coin gifted (e.g. 0.7 = 70% goes to host)
export const HOST_COIN_SHARE = 0.7;

export const getGiftById = (id) => GIFT_CATALOG.find((g) => g.id === id) || null;
export const getCoinPackageById = (id) => COIN_PACKAGES.find((p) => p.id === id) || null;
