import { validationService } from '../services/validationService';
import { gameStateService } from '../services/gameStateService';
import { requestQueue } from '../utils/requestQueue';
import { errorHandler } from '../services/errorHandler';

/**
 * Game Action Controller
 * 
 * Centralized controller for handling game actions with server-side validation
 */
class GameActionController {
  /**
   * Process a click action
   * 
   * @param walletAddress User's wallet address
   * @param cooldownDuration Cooldown duration in milliseconds
   * @returns Action result
   */
  async processClick(walletAddress: string, cooldownDuration: number): Promise<{
    success: boolean;
    valid: boolean;
    limited: boolean;
    cooldownActive: boolean;
    reward?: number;
    message?: string;
    timestamp?: number;
  }> {
    try {
      if (!walletAddress) {
        return { 
          success: false, 
          valid: false, 
          limited: false, 
          cooldownActive: false,
          message: 'No wallet address provided'
        };
      }
      
      // Validate the action
      const validationResult = await validationService.validateClick(
        walletAddress, 
        cooldownDuration
      );
      
      // If not valid, return validation result
      if (!validationResult.valid) {
        return {
          success: false,
          ...validationResult,
          message: validationResult.reason
        };
      }
      
      // If valid, calculate reward
      // This uses the request queue to ensure atomicity with previous operations
      return requestQueue.enqueue(walletAddress, async () => {
        try {
          const gameState = await gameStateService.loadGameState(walletAddress);
          if (!gameState) {
            return {
              success: false,
              valid: true,
              limited: false,
              cooldownActive: false,
              message: 'Failed to load game state'
            };
          }
          
          // Calculate base reward amount (in a real implementation, 
          // this would factor in all relevant multipliers)
          const baseReward = 1000;
          
          // Calculate multipliers
          const streakMultiplier = gameState.streakDays > 30 ? 2.0 :
                                  gameState.streakDays > 7 ? 1.5 :
                                  gameState.streakDays > 3 ? 1.2 : 1.0;
                                  
          const coinRushMultiplier = gameState.powerUps.coinRush.active ? 
                                  gameState.powerUps.coinRush.multiplier : 1.0;
          
          // Calculate final reward
          const finalReward = Math.floor(baseReward * streakMultiplier * coinRushMultiplier);
          
          // Update game state
          gameState.coins += finalReward;
          await gameStateService.saveGameState(walletAddress, gameState);
          
          return {
            success: true,
            valid: true,
            limited: false,
            cooldownActive: false,
            reward: finalReward,
            timestamp: validationResult.timestamp
          };
        } catch (error) {
          errorHandler.logError(
            error instanceof Error ? error : 
              new Error(`Failed to process click reward: ${error}`)
          );
          
          return {
            success: false,
            valid: true,
            limited: false,
            cooldownActive: false,
            message: 'Failed to process reward'
          };
        }
      });
    } catch (error) {
      errorHandler.logError(
        error instanceof Error ? error : 
          new Error(`Error in click processing: ${error}`)
      );
      
      return {
        success: false,
        valid: false,
        limited: false,
        cooldownActive: false,
        message: 'Internal server error'
      };
    }
  }
  
  /**
   * Activate a power-up
   * 
   * @param walletAddress User's wallet address
   * @param powerUpId Power-up ID
   * @param cost Cost of the power-up
   * @param duration Duration of the power-up in milliseconds
   * @returns Action result
   */
  async activatePowerUp(
    walletAddress: string,
    powerUpId: string,
    cost: number,
    duration: number
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      // Validate the action
      const validationResult = await validationService.validatePowerUpActivation(
        walletAddress,
        powerUpId,
        cost
      );
      
      if (!validationResult.valid) {
        return {
          success: false,
          message: validationResult.reason
        };
      }
      
      // Process power-up activation
      return requestQueue.enqueue(walletAddress, async () => {
        try {
          const gameState = await gameStateService.loadGameState(walletAddress);
          if (!gameState) {
            return {
              success: false,
              message: 'Failed to load game state'
            };
          }
          
          // Deduct cost
          gameState.coins -= cost;
          
          // Activate power-up
          const now = Date.now();
          
          if (powerUpId === 'coinRush') {
            gameState.powerUps.coinRush.active = true;
            gameState.powerUps.coinRush.endTime = now + duration;
          } else if (powerUpId === 'autoClicker') {
            gameState.powerUps.autoClicker.active = true;
            gameState.powerUps.autoClicker.endTime = now + duration;
          }
          
          // Save updated state
          await gameStateService.saveGameState(walletAddress, gameState);
          
          return {
            success: true
          };
        } catch (error) {
          errorHandler.logError(
            error instanceof Error ? error : 
              new Error(`Failed to activate power-up: ${error}`)
          );
          
          return {
            success: false,
            message: 'Failed to activate power-up'
          };
        }
      });
    } catch (error) {
      errorHandler.logError(
        error instanceof Error ? error : 
          new Error(`Error in power-up activation: ${error}`)
      );
      
      return {
        success: false,
        message: 'Internal server error'
      };
    }
  }
  
  /**
   * Purchase an upgrade
   * 
   * @param walletAddress User's wallet address
   * @param upgradeId Upgrade ID
   * @param cost Cost of the upgrade
   * @returns Action result
   */
  async purchaseUpgrade(
    walletAddress: string,
    upgradeId: string,
    cost: number
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      // Validate the action
      const validationResult = await validationService.validateUpgradePurchase(
        walletAddress,
        upgradeId,
        cost
      );
      
      if (!validationResult.valid) {
        return {
          success: false,
          message: validationResult.reason
        };
      }
      
      // Process upgrade purchase
      return requestQueue.enqueue(walletAddress, async () => {
        try {
          const gameState = await gameStateService.loadGameState(walletAddress);
          if (!gameState) {
            return {
              success: false,
              message: 'Failed to load game state'
            };
          }
          
          // Deduct cost
          gameState.coins -= cost;
          
          // Apply upgrade effects
          // In a real implementation, this would update the relevant game state
          // based on the specific upgrade that was purchased
          
          // Save updated state
          await gameStateService.saveGameState(walletAddress, gameState);
          
          return {
            success: true
          };
        } catch (error) {
          errorHandler.logError(
            error instanceof Error ? error : 
              new Error(`Failed to purchase upgrade: ${error}`)
          );
          
          return {
            success: false,
            message: 'Failed to purchase upgrade'
          };
        }
      });
    } catch (error) {
      errorHandler.logError(
        error instanceof Error ? error : 
          new Error(`Error in upgrade purchase: ${error}`)
      );
      
      return {
        success: false,
        message: 'Internal server error'
      };
    }
  }
}

export const gameActionController = new GameActionController(); 