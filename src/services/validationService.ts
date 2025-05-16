import { redis } from '../lib/redis';
import { REDIS_CONFIG } from '../config/redis';
import { atomicTransaction } from '../utils/atomicUtils';
import { gameStateService } from './gameStateService';
import { requestQueue } from '../utils/requestQueue';
import { slidingWindowRateLimiter } from '../utils/slidingWindowRateLimiter';

/**
 * Service for validating user actions to prevent cheating and ensure data integrity
 */
class ValidationService {
  /**
   * Validate and process a click action using atomic Redis transactions
   * 
   * @param walletAddress The user's wallet address
   * @param cooldownDuration The cooldown duration in milliseconds
   * @returns Object with validation result
   */
  async validateClick(
    walletAddress: string, 
    cooldownDuration: number
  ): Promise<{ 
    valid: boolean; 
    limited: boolean;
    cooldownActive: boolean;
    reason?: string;
    timestamp?: number;
  }> {
    // Use request queue to handle concurrent requests
    return requestQueue.enqueue(walletAddress, async () => {
      try {
        if (!walletAddress) {
          return { valid: false, limited: false, cooldownActive: false, reason: 'No wallet address provided' };
        }

        const timestamp = Date.now();
        const clicksKey = `${REDIS_CONFIG.PREFIX.GAME_STATE}totalClicks:${walletAddress}`;
        const lastClickKey = `${REDIS_CONFIG.PREFIX.GAME_STATE}lastClick:${walletAddress}`;
        const cooldownKey = `${REDIS_CONFIG.PREFIX.GAME_STATE}cooldown:${walletAddress}`;

        // First check if user is on cooldown
        const cooldownValue = await redis.get(cooldownKey);
        if (cooldownValue) {
          const cooldownEnd = parseInt(cooldownValue as string);
          if (cooldownEnd > timestamp) {
            return { 
              valid: false, 
              limited: false, 
              cooldownActive: true, 
              reason: 'Cooldown active',
              timestamp
            };
          }
        }

        // Use sliding window rate limiter for more accurate rate limiting
        const rateLimitKey = `clicks:${walletAddress}`;
        const rateLimitResult = await slidingWindowRateLimiter.isAllowed(
          rateLimitKey,
          REDIS_CONFIG.RATE_LIMIT.CLICKS.limit,
          REDIS_CONFIG.RATE_LIMIT.CLICKS.windowSeconds
        );
        
        if (!rateLimitResult.isAllowed) {
          return { 
            valid: false, 
            limited: true, 
            cooldownActive: false, 
            reason: `Rate limit exceeded. Resets in ${rateLimitResult.resetSeconds} seconds`,
            timestamp
          };
        }

        // Use atomic transaction to process the click
        const results = await atomicTransaction<any>([
          // This array contains commands to be executed in a transaction
          ['multi'], // Start transaction
          ['incr', clicksKey], // Increment total clicks
          ['set', lastClickKey, timestamp], // Set last click time
          ['set', cooldownKey, timestamp + cooldownDuration], // Set cooldown
          ['expire', cooldownKey, Math.ceil(cooldownDuration / 1000)], // Set cooldown expiry
          ['exec'] // Execute transaction
        ]);

        // Check if transaction was successful
        if (!results[5] || results[5].length === 0) {
          return { 
            valid: false, 
            limited: false, 
            cooldownActive: false, 
            reason: 'Transaction failed',
            timestamp 
          };
        }

        // Transaction successful - click is valid
        return { 
          valid: true, 
          limited: false, 
          cooldownActive: false,
          timestamp
        };
      } catch (error) {
        console.error('Click validation error:', error);
        return { 
          valid: false, 
          limited: false, 
          cooldownActive: false, 
          reason: 'Validation error'
        };
      }
    });
  }

  /**
   * Validate power-up activation
   * 
   * @param walletAddress The user's wallet address
   * @param powerUpId The ID of the power-up to activate
   * @param cost The cost of the power-up
   * @returns Object with validation result
   */
  async validatePowerUpActivation(
    walletAddress: string,
    powerUpId: string,
    cost: number
  ): Promise<{
    valid: boolean;
    reason?: string;
    state?: any;
  }> {
    // Use request queue to handle concurrent requests
    return requestQueue.enqueue(walletAddress, async () => {
      try {
        if (!walletAddress) {
          return { valid: false, reason: 'No wallet address provided' };
        }

        // Get current game state
        const state = await gameStateService.loadGameState(walletAddress);
        if (!state) {
          return { valid: false, reason: 'Could not load game state' };
        }

        // Check if user has enough coins
        if (state.coins < cost) {
          return { valid: false, reason: 'Insufficient coins', state };
        }

        // Check if power-up is already active
        if (
          powerUpId === 'coinRush' && 
          state.powerUps.coinRush.active && 
          state.powerUps.coinRush.endTime && 
          state.powerUps.coinRush.endTime > Date.now()
        ) {
          return { valid: false, reason: 'Power-up already active', state };
        }

        if (
          powerUpId === 'autoClicker' && 
          state.powerUps.autoClicker.active && 
          state.powerUps.autoClicker.endTime && 
          state.powerUps.autoClicker.endTime > Date.now()
        ) {
          return { valid: false, reason: 'Power-up already active', state };
        }

        return { valid: true, state };
      } catch (error) {
        console.error('Power-up validation error:', error);
        return { valid: false, reason: 'Validation error' };
      }
    });
  }

  /**
   * Validate an upgrade purchase
   * 
   * @param walletAddress The user's wallet address
   * @param upgradeId The ID of the upgrade to purchase
   * @param cost The cost of the upgrade
   * @returns Object with validation result
   */
  async validateUpgradePurchase(
    walletAddress: string,
    upgradeId: string,
    cost: number
  ): Promise<{
    valid: boolean;
    reason?: string;
    state?: any;
  }> {
    // Use request queue to handle concurrent requests
    return requestQueue.enqueue(walletAddress, async () => {
      try {
        if (!walletAddress) {
          return { valid: false, reason: 'No wallet address provided' };
        }

        // Get current game state
        const state = await gameStateService.loadGameState(walletAddress);
        if (!state) {
          return { valid: false, reason: 'Could not load game state' };
        }

        // Check if user has enough coins
        if (state.coins < cost) {
          return { valid: false, reason: 'Insufficient coins', state };
        }

        return { valid: true, state };
      } catch (error) {
        console.error('Upgrade validation error:', error);
        return { valid: false, reason: 'Validation error' };
      }
    });
  }
}

export const validationService = new ValidationService(); 