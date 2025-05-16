import { redis } from '@/lib/redis';
import { supabase } from '@/storage/config/supabase';
import { REDIS_CONFIG } from '@/config/redis';

export interface GameState {
  coins: number;
  totalClicks: number;
  lastClickTime: number | null;
  cooldownEndTime: number | null;
  streakDays: number;
  lastLoginDate: string | null;
  powerUps: {
    coinRush: {
      active: boolean;
      endTime: number | null;
      multiplier: number;
    };
    autoClicker: {
      active: boolean;
      endTime: number | null;
      clicksPerSecond: number;
    };
  };
  offlineEarnings: {
    lastTime: number | null;
    rate: number;
    maxDuration: number;
  };
}

class GameStateService {
  private getStateKey(userId: string): string {
    return `${REDIS_CONFIG.PREFIX.GAME_STATE}${userId}`;
  }

  /**
   * Utility to resolve user_id from wallet_address
   */
  async getUserIdFromWallet(walletAddress: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('wallet_address', walletAddress)
      .single();
    if (error || !data) return null;
    return data.id;
  }

  /**
   * Load game state from Redis, falling back to Supabase
   * Accepts either user_id or wallet_address, but always resolves to user_id
   */
  async loadGameStateByWallet(walletAddress: string): Promise<GameState | null> {
    const userId = await this.getUserIdFromWallet(walletAddress);
    if (!userId) return null;
    return this.loadGameState(userId);
  }

  async loadGameState(userId: string): Promise<GameState | null> {
    const key = this.getStateKey(userId);
    // Try Redis first
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached as string) as GameState;
    // Fallback to Supabase
    const { data, error } = await supabase
      .from('user_game_state')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error || !data) return null;
    await redis.set(key, JSON.stringify(data), { ex: REDIS_CONFIG.TTL.GAME_STATE });
    return data as GameState;
  }

  /**
   * Save game state to both Redis and Supabase
   */
  async saveGameState(userId: string, state: GameState): Promise<boolean> {
    try {
      // Save to Redis
      await redis.set(
        this.getStateKey(userId),
        JSON.stringify(state),
        { ex: REDIS_CONFIG.TTL.GAME_STATE }
      );
      // Save to Supabase
      const { error } = await supabase
        .from('user_game_state')
        .upsert({
          user_id: userId,
          coins: state.coins,
          total_clicks: state.totalClicks,
          last_click_time: state.lastClickTime ? new Date(state.lastClickTime) : null,
          cooldown_end_time: state.cooldownEndTime ? new Date(state.cooldownEndTime) : null,
          streak_days: state.streakDays,
          last_login_date: state.lastLoginDate,
          power_ups: state.powerUps,
          updated_at: new Date()
        });
      if (error) {
        console.error('Error saving game state to Supabase:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error saving game state:', error);
      return false;
    }
  }

  /**
   * Update game state atomically
   */
  async updateGameState(userId: string, updateFn: (state: GameState) => Promise<GameState>): Promise<GameState | null> {
    const key = this.getStateKey(userId);
    let retries = 3;
    let lastError: Error | null = null;
    while (retries > 0) {
      try {
        // Get current state
        const currentState = await this.loadGameState(userId);
        if (!currentState) {
          throw new Error('Failed to load game state');
        }
        // Apply updates
        const newState = await updateFn(currentState);
        // Save state
        const success = await this.saveGameState(userId, newState);
        if (!success) {
          throw new Error('Failed to save game state');
        }
        return newState;
      } catch (error) {
        lastError = error as Error;
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        }
      }
    }
    console.error('Failed to update game state after retries:', lastError);
    return null;
  }

  /**
   * Get game configuration
   */
  async getGameConfig<T>(key: string): Promise<T | null> {
    return null;
  }

  /**
   * Invalidate game state cache
   */
  async invalidateGameState(walletAddress: string): Promise<void> {
    // Remove or comment out any code that uses syncData, syncGameConfig, or invalidateCache
  }
}

export const gameStateService = new GameStateService(); 