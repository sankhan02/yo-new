import { redis } from '@/lib/redis';
import { REDIS_CONFIG } from '@/config/redis';
import { atomicUpdate } from './atomicUtils';
import { supabase } from '@/storage/config/supabase';

interface GameState {
  coins: number;
  totalClicks: number;
  lastClickTime: number | null;
  cooldownEndTime: number | null;
  streakDays: number;
  lastLoginDate: string | null;
  powerUps: Record<string, any>;
  offlineEarnings: Record<string, any>;
  [key: string]: any;
}

/**
 * Load game state from Redis, falling back to Supabase
 */
export async function loadGameState(userId: string): Promise<GameState | null> {
  const key = `${REDIS_CONFIG.PREFIX.GAME_STATE}${userId}`;
  
  try {
    // Try Redis first
    const cachedState = await redis.get(key);
    if (cachedState) {
      return JSON.parse(cachedState as string) as GameState;
    }

    // Fall back to Supabase
    const { data, error } = await supabase
      .from('user_game_state')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    if (data) {
      const gameState: GameState = {
        coins: data.coins,
        totalClicks: data.total_clicks,
        lastClickTime: data.last_click_time ? new Date(data.last_click_time).getTime() : null,
        cooldownEndTime: data.cooldown_end_time ? new Date(data.cooldown_end_time).getTime() : null,
        streakDays: data.streak_days,
        lastLoginDate: data.last_login_date,
        powerUps: data.power_ups,
        offlineEarnings: data.offline_earnings,
      };

      // Cache in Redis
      await redis.set(key, JSON.stringify(gameState), {
        ex: REDIS_CONFIG.TTL.GAME_STATE
      });

      return gameState;
    }

    // No existing state, create new
    const newState: GameState = {
      coins: 0,
      totalClicks: 0,
      lastClickTime: null,
      cooldownEndTime: null,
      streakDays: 0,
      lastLoginDate: null,
      powerUps: {},
      offlineEarnings: {},
    };

    await redis.set(key, JSON.stringify(newState), {
      ex: REDIS_CONFIG.TTL.GAME_STATE
    });

    return newState;
  } catch (error) {
    console.error('Error loading game state:', error);
    return null;
  }
}

/**
 * Save game state to both Redis and Supabase
 */
export async function saveGameState(
  userId: string,
  state: GameState
): Promise<boolean> {
  const key = `${REDIS_CONFIG.PREFIX.GAME_STATE}${userId}`;
  
  try {
    // Update Redis
    await redis.set(key, JSON.stringify(state), {
      ex: REDIS_CONFIG.TTL.GAME_STATE
    });

    // Update Supabase
    await supabase.from('user_game_state').upsert({
      user_id: userId,
      coins: state.coins,
      total_clicks: state.totalClicks,
      last_click_time: state.lastClickTime ? new Date(state.lastClickTime).toISOString() : null,
      cooldown_end_time: state.cooldownEndTime ? new Date(state.cooldownEndTime).toISOString() : null,
      streak_days: state.streakDays,
      last_login_date: state.lastLoginDate,
      power_ups: state.powerUps,
      offline_earnings: state.offlineEarnings,
      updated_at: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    console.error('Error saving game state:', error);
    return false;
  }
}

/**
 * Update game state atomically
 */
export async function updateGameState(
  userId: string,
  updateFn: (state: GameState) => Promise<GameState>
): Promise<GameState | null> {
  const key = `${REDIS_CONFIG.PREFIX.GAME_STATE}${userId}`;
  
  return atomicUpdate<GameState>(key, async (currentState) => {
    // Load from Supabase if not in Redis
    if (!currentState) {
      currentState = await loadGameState(userId);
      if (!currentState) {
        throw new Error('Failed to load game state');
      }
    }

    // Apply updates
    const newState = await updateFn(currentState);
    
    // Save to Supabase
    await saveGameState(userId, newState);
    
    return newState;
  });
}

/**
 * Clean up inactive game states
 */
export async function cleanupInactiveGames(): Promise<void> {
  try {
    const pattern = `${REDIS_CONFIG.PREFIX.GAME_STATE}*`;
    const keys = await redis.keys(pattern);
    const now = Date.now();
    const maxAge = REDIS_CONFIG.CLEANUP.INACTIVE_GAMES_MAX_AGE * 1000;

    for (const key of keys) {
      const state = await redis.get(key);
      if (!state) continue;

      const gameState = JSON.parse(state as string) as GameState;
      if (gameState.lastLoginDate && now - new Date(gameState.lastLoginDate).getTime() > maxAge) {
        await redis.del(key);
      }
    }
  } catch (error) {
    console.error('Error cleaning up inactive games:', error);
  }
}

// Set up periodic cleanup
setInterval(
  cleanupInactiveGames,
  REDIS_CONFIG.CLEANUP.INTERVAL
);

/**
 * Utility to resolve user_id from wallet_address
 */
export async function getUserIdFromWallet(walletAddress: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('wallet_address', walletAddress)
    .single();
  if (error || !data) return null;
  return data.id;
} 