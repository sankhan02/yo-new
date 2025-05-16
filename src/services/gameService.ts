import { redis, redisHelpers } from '@/lib/redis';
import { REDIS_CONFIG } from '@/config/redis';
import { gameStateService } from './gameStateService';
import type { GameState } from './gameStateService';
import { errorHandler } from './errorHandler';
import { offlineManager } from './offlineManager';
import { supabase } from '@/storage/config/supabase';

// Custom error class for rate limiting
class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export interface PowerUp {
  id: number;
  name: string;
  description: string;
  duration: number;
  multiplier: number;
  cooldown: number;
  active: boolean;
  timeRemaining: number;
  cooldownRemaining: number;
}

export interface StreakReward {
  id: number;
  streakDays: number;
  type: 'clicks' | 'multiplier' | 'power_up';
  value: number;
  description: string;
  claimed: boolean;
}

// Extended GameState with streak rewards
interface ExtendedGameState extends GameState {
  streakRewards?: StreakReward[];
}

class GameService {
  /**
   * Initialize a user's game session
   */
  async initSession(walletAddress: string): Promise<GameState | null> {
    try {
      // Load game state
      const gameState = await gameStateService.loadGameState(walletAddress);
      if (!gameState) return null;

      // Check and update streak
      await this.checkStreak(walletAddress, gameState as ExtendedGameState);
      
      // Calculate offline earnings
      await this.calculateOfflineEarnings(walletAddress, gameState);
      
      // Update power-up status
      this.updatePowerUpStatus(gameState);
      
      return gameState;
    } catch (error) {
      if (error instanceof Error) {
        errorHandler.handleError(error, 'Initializing game session');
      } else {
        errorHandler.handleError(new Error(String(error)), 'Initializing game session');
      }
      return null;
    }
  }

  /**
   * Add coins to a player's balance
   */
  async addCoins(walletAddress: string, amount: number, options: {
    trackClick?: boolean;
    applyMultipliers?: boolean;
  } = {}): Promise<{success: boolean; finalAmount: number}> {
    const { trackClick = true, applyMultipliers = true } = options;
    
    if (amount <= 0) {
      return { success: false, finalAmount: 0 };
    }
    
    try {
      // Apply rate limiting if needed
      if (trackClick) {
        const isRateLimited = await this.checkRateLimit(walletAddress);
        if (isRateLimited) {
          throw new RateLimitError('Click rate limit exceeded');
        }
      }
      
      return await gameStateService.updateGameState(walletAddress, async (state) => {
        let finalAmount = amount;
        
        // Apply multipliers if needed
        if (applyMultipliers) {
          // Apply streak multiplier
          const isStreakActive = this.isStreakActive(state);
          if (isStreakActive) {
            const streakMultiplier = this.calculateStreakMultiplier(state as ExtendedGameState);
            finalAmount *= streakMultiplier;
          }
          
          // Apply prestige multiplier if available
          const prestigeMultiplier = await this.getPrestigeMultiplier(walletAddress);
          finalAmount *= prestigeMultiplier;
          
          // Apply coin rush multiplier if active
          if (state.powerUps.coinRush.active) {
            finalAmount *= state.powerUps.coinRush.multiplier;
          }
        }
        
        // Round down to whole coins
        finalAmount = Math.floor(finalAmount);
        
        // Update state
        state.coins += finalAmount;
        
        // Track click if needed
        if (trackClick) {
          state.totalClicks += 1;
          state.lastClickTime = Date.now();
        }
        
        return state;
      }) ? { success: true, finalAmount: amount } : { success: false, finalAmount: 0 };
    } catch (error) {
      if (error instanceof RateLimitError) {
        return { success: false, finalAmount: 0 };
      }
      if (error instanceof Error) {
        errorHandler.handleError(error, 'Adding coins');
      } else {
        errorHandler.handleError(new Error(String(error)), 'Adding coins');
      }
      return { success: false, finalAmount: 0 };
    }
  }

  /**
   * Place a bet (deduct coins)
   */
  async placeBet(walletAddress: string, amount: number): Promise<boolean> {
    if (amount <= 0) return false;
    
    try {
      return await gameStateService.updateGameState(walletAddress, async (state) => {
        if (state.coins < amount) {
          return state; // No changes if insufficient funds
        }
        
        state.coins -= amount;
        return state;
      }) !== null;
    } catch (error) {
      if (error instanceof Error) {
        errorHandler.handleError(error, 'Placing bet');
      } else {
        errorHandler.handleError(new Error(String(error)), 'Placing bet');
      }
      return false;
    }
  }

  /**
   * Check and update streak
   */
  async checkStreak(walletAddress: string, state: ExtendedGameState): Promise<ExtendedGameState> {
    const today = new Date().toISOString().split('T')[0];
    let updated = false;
    
    if (!state.lastLoginDate) {
      // First time playing, start streak at 1
      state.streakDays = 1;
      state.lastLoginDate = today;
      updated = true;
    } else if (state.lastLoginDate !== today) {
      const lastPlayed = new Date(state.lastLoginDate);
      const currentDate = new Date(today);
      const dayDifference = Math.floor((currentDate.getTime() - lastPlayed.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dayDifference === 1) {
        // Played yesterday, increase streak
        state.streakDays += 1;
      } else if (dayDifference > 1) {
        // Missed a day, reset streak
        state.streakDays = 1;
        // Reset claimed status for streak rewards if they exist
        if (state.streakRewards) {
          state.streakRewards.forEach(reward => {
            reward.claimed = false;
          });
        }
      }
      
      state.lastLoginDate = today;
      updated = true;
    }
    
    if (updated) {
      await gameStateService.saveGameState(walletAddress, state);
    }
    
    return state;
  }

  /**
   * Calculate and apply offline earnings
   */
  async calculateOfflineEarnings(walletAddress: string, state: GameState): Promise<GameState> {
    if (!state.lastClickTime || !state.offlineEarnings) return state;
    
    const now = Date.now();
    const timeDiff = now - state.lastClickTime;
    
    // Only calculate if away for more than 5 minutes
    if (timeDiff < 5 * 60 * 1000) return state;
    
    // Use game-specific constants
    const baseRate = 100; // coins per hour
    const cappedTimeDiff = Math.min(timeDiff, state.offlineEarnings.maxDuration);
    const hoursOffline = cappedTimeDiff / (1000 * 60 * 60);
    const earnedCoins = Math.floor(baseRate * hoursOffline * state.offlineEarnings.rate);
    
    if (earnedCoins > 0) {
      state.coins += earnedCoins;
      state.offlineEarnings.lastTime = now;
      await gameStateService.saveGameState(walletAddress, state);
    }
    
    return state;
  }

  /**
   * Check if a player is rate-limited
   */
  async checkRateLimit(walletAddress: string): Promise<boolean> {
    try {
      // Apply rate limiting using Redis
      const rateKey = `${REDIS_CONFIG.PREFIX.RATE_LIMIT}clicks:${walletAddress}`;
      const clickCount = await redisHelpers.increment(rateKey);
      
      // Set expiry on first click
      if (clickCount === 1) {
        await redisHelpers.expire(rateKey, REDIS_CONFIG.RATE_LIMIT.CLICKS.windowSeconds);
      }
      
      // Check rate limit
      if (clickCount > REDIS_CONFIG.RATE_LIMIT.CLICKS.limit) {
        return true; // Rate limited
      }
      
      // Update click counter in Redis directly (separate from game state for high frequency)
      await redis.incr(`${REDIS_CONFIG.PREFIX.GAME_STATE}totalClicks:${walletAddress}`);
      
      return false; // Not rate limited
    } catch (error) {
      // Log error but don't rate limit on error
      if (error instanceof Error) {
        errorHandler.handleError(error, 'Checking rate limit');
      } else {
        errorHandler.handleError(new Error(String(error)), 'Checking rate limit');
      }
      return false;
    }
  }

  /**
   * Start cooldown timer
   */
  async startCooldown(walletAddress: string, duration: number): Promise<boolean> {
    try {
      return await gameStateService.updateGameState(walletAddress, async (state) => {
        state.cooldownEndTime = Date.now() + duration;
        return state;
      }) !== null;
    } catch (error) {
      if (error instanceof Error) {
        errorHandler.handleError(error, 'Starting cooldown');
      } else {
        errorHandler.handleError(new Error(String(error)), 'Starting cooldown');
      }
      return false;
    }
  }

  /**
   * Activate Coin Rush power-up
   */
  async activateCoinRush(walletAddress: string, duration: number): Promise<boolean> {
    try {
      return await gameStateService.updateGameState(walletAddress, async (state) => {
        state.powerUps.coinRush.active = true;
        state.powerUps.coinRush.endTime = Date.now() + duration;
        return state;
      }) !== null;
    } catch (error) {
      if (error instanceof Error) {
        errorHandler.handleError(error, 'Activating coin rush');
      } else {
        errorHandler.handleError(new Error(String(error)), 'Activating coin rush');
      }
      return false;
    }
  }

  /**
   * Activate Auto-Clicker power-up
   */
  async activateAutoClicker(walletAddress: string, duration: number): Promise<boolean> {
    try {
      return await gameStateService.updateGameState(walletAddress, async (state) => {
        state.powerUps.autoClicker.active = true;
        state.powerUps.autoClicker.endTime = Date.now() + duration;
        return state;
      }) !== null;
    } catch (error) {
      if (error instanceof Error) {
        errorHandler.handleError(error, 'Activating auto clicker');
      } else {
        errorHandler.handleError(new Error(String(error)), 'Activating auto clicker');
      }
      return false;
    }
  }

  /**
   * Update power-up status (check if they should be deactivated)
   */
  updatePowerUpStatus(state: GameState): boolean {
    const now = Date.now();
    let updated = false;
    
    // Check Coin Rush
    if (state.powerUps.coinRush.active && state.powerUps.coinRush.endTime && now > state.powerUps.coinRush.endTime) {
      state.powerUps.coinRush.active = false;
      state.powerUps.coinRush.endTime = null;
      updated = true;
    }
    
    // Check Auto-Clicker
    if (state.powerUps.autoClicker.active && state.powerUps.autoClicker.endTime && now > state.powerUps.autoClicker.endTime) {
      state.powerUps.autoClicker.active = false;
      state.powerUps.autoClicker.endTime = null;
      updated = true;
    }
    
    return updated;
  }

  /**
   * Check if streak is active
   */
  isStreakActive(state: GameState): boolean {
    return state.streakDays > 0;
  }

  /**
   * Calculate streak multiplier based on streak days
   */
  calculateStreakMultiplier(state: ExtendedGameState): number {
    let multiplier = 1.0;
    
    // Check for claimed multiplier rewards if they exist
    if (state.streakRewards) {
      state.streakRewards.forEach((reward: StreakReward) => {
        if (reward.claimed && reward.type === 'multiplier' && state.streakDays >= reward.streakDays) {
          // Apply the highest value
          multiplier = Math.max(multiplier, reward.value);
        }
      });
    }
    
    // If no multiplier rewards claimed yet, use default streak logic
    if (multiplier === 1.0) {
      if (state.streakDays >= 30) {
        multiplier = 2.0;
      } else if (state.streakDays >= 7) {
        multiplier = 1.5;
      } else if (state.streakDays >= 3) {
        multiplier = 1.2;
      }
    }
    
    return multiplier;
  }

  /**
   * Get prestige multiplier
   */
  async getPrestigeMultiplier(walletAddress: string): Promise<number> {
    // This would typically fetch from a prestige service or storage
    // For now, just default to 1.0
    return 1.0;
  }

  /**
   * Claim a streak reward
   */
  async claimReward(walletAddress: string, rewardId: number): Promise<{
    success: boolean;
    message: string;
    reward?: StreakReward;
  }> {
    try {
      const result = await gameStateService.updateGameState(walletAddress, async (state) => {
        const extendedState = state as ExtendedGameState;
        if (!extendedState.streakRewards) {
          return state;
        }
        
        const reward = extendedState.streakRewards.find(r => r.id === rewardId);
        
        if (!reward || reward.claimed || state.streakDays < reward.streakDays) {
          throw new Error('Cannot claim this reward');
        }
        
        // Apply reward effect
        if (reward.type === 'clicks') {
          state.coins += reward.value;
        } else if (reward.type === 'power_up') {
          // Apply power-up buffs
          if (reward.id === 4) { // Double duration reward
            state.powerUps.coinRush.multiplier *= 2;
            state.powerUps.autoClicker.clicksPerSecond *= 2;
          }
        }
        
        // Mark as claimed
        reward.claimed = true;
        
        return state;
      });
      
      if (!result) {
        return { success: false, message: 'Failed to process reward claim' };
      }
      
      const extendedResult = result as ExtendedGameState;
      const reward = extendedResult.streakRewards?.find(r => r.id === rewardId);
      
      return { 
        success: true, 
        message: reward ? `Claimed: ${reward.description}` : 'Reward claimed', 
        reward 
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error claiming reward';
      return { success: false, message };
    }
  }

  /**
   * Flush batched clicks from Redis to Postgres
   */
  async flushClicksToPostgres(walletAddress: string) {
    // Get and reset the click count from Redis
    const redisKey = `user:${walletAddress}:clicks`;
    const clicks = await redis.getdel(redisKey);
    if (typeof clicks === 'string' && parseInt(clicks, 10) > 0) {
      // Look up user_id from wallet_address
      const userId = await gameStateService.getUserIdFromWallet(walletAddress);
      if (!userId) return;
      // Update user_game_state in Postgres
      await supabase.rpc('increment_clicks', { user_id: userId, clicks: parseInt(clicks, 10) });
    }
  }

  /**
   * Process a game click event with Redis batching and anti-cheat
   */
  async handleClick(walletAddress: string, baseAmount: number): Promise<{
    success: boolean;
    amount: number;
    bonusTriggered?: boolean;
  }> {
    try {
      // Anti-cheat: Rate limit using Redis (max 20 clicks/sec)
      const rateKey = `user:${walletAddress}:clickrate`;
      const count = await redis.incr(rateKey);
      if (count === 1) await redis.expire(rateKey, 1); // 1 second window
      if (count > 20) {
        // Look up user_id from wallet_address
        const userId = await gameStateService.getUserIdFromWallet(walletAddress);
        // Log suspicious activity
        await supabase.from('user_action_logs').insert({
          user_id: userId || walletAddress, // fallback for logging
          action_type: 'suspicious_click',
          details: JSON.stringify({ count, window: '1s' }),
          created_at: new Date().toISOString()
        });
        return { success: false, amount: 0 };
      }
      // Batch click: Increment Redis counter
      await redis.incr(`user:${walletAddress}:clicks`);
      // (Optional) You can flush to Postgres periodically or on logout/session end
      // Add coins to local state (not persisted until flush)
      const userId = await gameStateService.getUserIdFromWallet(walletAddress);
      if (!userId) return { success: false, amount: 0 };
      const { success, finalAmount } = await this.addCoins(userId, baseAmount, {
        trackClick: true,
        applyMultipliers: true
      });
      if (!success) {
        return { success: false, amount: 0 };
      }
      const gameState = await gameStateService.loadGameState(userId);
      if (!gameState) {
        return { success: true, amount: finalAmount };
      }
      let bonusTriggered = false;
      if (Math.random() < 0.001) {
        await this.activateAutoClicker(userId, 60000);
        bonusTriggered = true;
      }
      if (gameState.totalClicks % 500 === 0) {
        await this.activateCoinRush(userId, 30000);
        bonusTriggered = true;
      }
      return {
        success: true,
        amount: finalAmount,
        bonusTriggered
      };
    } catch (error) {
      if (error instanceof Error) {
        errorHandler.handleError(error, 'Processing click event');
      } else {
        errorHandler.handleError(new Error(String(error)), 'Processing click event');
      }
      return { success: false, amount: 0 };
    }
  }

  /**
   * Get current game state
   */
  async getState(walletAddress: string): Promise<GameState | null> {
    return gameStateService.loadGameState(walletAddress);
  }

  /**
   * Save game state
   */
  async saveGameState(walletAddress: string, state: GameState): Promise<boolean> {
    return gameStateService.saveGameState(walletAddress, state);
  }

  /**
   * Get default streak rewards
   */
  getDefaultStreakRewards(): StreakReward[] {
    return [
      { id: 1, streakDays: 3, type: 'multiplier', value: 1.2, description: '1.2x Multiplier', claimed: false },
      { id: 2, streakDays: 5, type: 'clicks', value: 5000, description: '5,000 Bonus Coins', claimed: false },
      { id: 3, streakDays: 7, type: 'multiplier', value: 1.5, description: '1.5x Multiplier', claimed: false },
      { id: 4, streakDays: 10, type: 'power_up', value: 2, description: 'Double Power-Up Duration', claimed: false },
      { id: 5, streakDays: 15, type: 'clicks', value: 15000, description: '15,000 Bonus Coins', claimed: false },
      { id: 6, streakDays: 30, type: 'multiplier', value: 2.0, description: '2.0x Multiplier', claimed: false }
    ];
  }
}

export const gameService = new GameService(); 