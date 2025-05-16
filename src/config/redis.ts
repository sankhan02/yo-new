export const REDIS_CONFIG = {
  // Cache TTLs (in seconds)
  TTL: {
    DEFAULT: 3600, // 1 hour
    SESSION: 86400, // 24 hours
    GAME_STATE: 3600, // 1 hour
    GAME_CONFIG: 3600, // 1 hour
    PVP_MATCH: 7200, // 2 hours
    CLAN_DATA: 1800, // 30 minutes
    LEADERBOARD: 300, // 5 minutes
    MATCHMAKING: 60, // 1 minute
    USER_DATA: 3600, // 1 hour
  },

  // Rate limiting
  RATE_LIMIT: {
    DEFAULT: {
      limit: 100,
      windowSeconds: 60, // 1 minute
    },
    CLICKS: {
      limit: 10,
      windowSeconds: 1, // 1 second
    },
    PVP_ACTIONS: {
      limit: 20,
      windowSeconds: 1, // 1 second
    },
    CLAN_ACTIONS: {
      limit: 50,
      windowSeconds: 60, // 1 minute
    },
    CLAN_CHAT: {
      limit: 20,
      windowSeconds: 10, // 10 seconds
    }
  },

  // Key prefixes
  PREFIX: {
    CACHE: 'cache:',
    SESSION: 'session:',
    GAME_STATE: 'game:state:',
    GAME_CONFIG: 'game:config:',
    PVP_MATCH: 'pvp:match:',
    PVP_QUEUE: 'pvp:queue:',
    CLAN: 'clan:',
    CLAN_MEMBERS: 'clan:members:',
    CLAN_ACTIVITY: 'clan:activity:',
    CLAN_STATS: 'clan:stats:',
    LEADERBOARD: 'leaderboard:',
    RATE_LIMIT: 'rate-limit:',
    USER_PROFILE: 'user:profile:',
  },

  // Cleanup settings
  CLEANUP: {
    BATCH_SIZE: 100,
    INTERVAL: 300, // 5 minutes
    INACTIVE_GAMES_MAX_AGE: 86400, // 24 hours
    CLAN_DATA_MAX_AGE: 86400, // 24 hours
    INACTIVE_CLANS_MAX_AGE: 604800, // 7 days
    PATTERNS: [
      'cache:*',
      'game:state:*',
      'pvp:match:*',
      'rate-limit:*',
      'clan:*',
      'clan:members:*',
      'clan:activity:*',
      'user:profile:*'
    ],
  },

  // PvP settings
  PVP: {
    MATCH_DURATION: 180, // 3 minutes
    QUEUE_TIMEOUT: 60, // 1 minute
    MAX_CLICK_RATE: 20, // clicks per second
  },

  // Clan settings
  CLAN: {
    MEMBER_LIST_TTL: 300, // 5 minutes
    ACTIVITY_LOG_TTL: 86400, // 24 hours
    MAX_MEMBERS: 10,
  },
} as const;

// Environment validation
const requiredEnvVars = [
  'VITE_UPSTASH_REDIS_URL',
  'VITE_UPSTASH_REDIS_TOKEN',
] as const;

export function validateRedisConfig(): void {
  // In a testing environment, we'll skip validation
  if (process.env.NODE_ENV === 'test') {
    console.log('Skipping Redis config validation in test environment');
    return;
  }

  try {
    // Check for Vite environment
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const missing = requiredEnvVars.filter(
        (envVar) => !import.meta.env[envVar]
      );

      if (missing.length > 0) {
        throw new Error(
          `Missing required Redis environment variables: ${missing.join(', ')}`
        );
      }
    } else {
      // Node.js environment
      const missing = requiredEnvVars.filter(
        (envVar) => !process.env[envVar]
      );

      if (missing.length > 0) {
        throw new Error(
          `Missing required Redis environment variables: ${missing.join(', ')}`
        );
      }
    }
  } catch (error) {
    // For testing purposes, we'll just log the error
    if (process.env.NODE_ENV === 'test') {
      console.error('Redis config validation error (ignored in test):', error);
      return;
    }
    throw error;
  }
} 