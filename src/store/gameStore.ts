import { defineStore } from 'pinia';
import { computed, ref, onUnmounted } from 'vue';
import { userWallet } from '@/lib/auth';
import { gameService } from '@/services/gameService';
import type { StreakReward, PowerUp } from '@/services/gameService';
import type { GameState } from '@/services/gameStateService';
import { errorHandler } from '@/services/errorHandler';

// Re-export needed interfaces for components
export type { StreakReward, PowerUp, GameState };

// Define interfaces used only in store
export interface Upgrade {
  id: number;
  name: string;
  description: string;
  cost: number;
  multiplier: number;
  owned: boolean;
}

// Extended UI-specific GameState
interface UIGameState extends GameState {
  streakRewards?: StreakReward[];
}

export const useGameStore = defineStore('game', () => {
  // State (for UI reactivity)
  const coins = ref(0);
  const totalClicks = ref(0);
  const lastClickTime = ref<number | null>(null);
  const cooldownEndTime = ref<number | null>(null);
  const streakDays = ref(0);
  const lastLoginDate = ref<string | null>(null);
  const isStreakActive = ref(false);
  const streakMultiplier = ref(1.0);
  const prestigeMultiplier = ref(1.0);
  const autoClickerSpeed = ref(1.0);
  const powerUps = ref<{
    coinRush: {
      active: boolean;
      endTime: number | null;
      multiplier: number;
    },
    autoClicker: {
      active: boolean;
      endTime: number | null;
      clicksPerSecond: number;
    }
  }>({
    coinRush: {
      active: false,
      endTime: null,
      multiplier: 2 // 2x multiplier
    },
    autoClicker: {
      active: false,
      endTime: null,
      clicksPerSecond: 1
    }
  });
  const offlineEarnings = ref({
    lastTime: null as number | null,
    rate: 0.1, // 10% of last session earnings
    maxDuration: 8 * 60 * 60 * 1000 // 8 hours max
  });

  // Streak rewards data
  const streakRewards = ref<StreakReward[]>([]);

  // Auto-clicker interval reference
  let autoClickerInterval: ReturnType<typeof setInterval> | null = null;

  // Computed properties
  const isCooldown = computed(() => {
    if (!cooldownEndTime.value) return false;
    return Date.now() < cooldownEndTime.value;
  });

  const cooldownTimeLeft = computed(() => {
    if (!cooldownEndTime.value) return 0;
    const timeLeft = cooldownEndTime.value - Date.now();
    return timeLeft > 0 ? timeLeft : 0;
  });

  const availableRewards = computed(() => {
    return streakRewards.value.filter(reward => 
      !reward.claimed && streakDays.value >= reward.streakDays
    );
  });

  const hasUnclaimedRewards = computed(() => availableRewards.value.length > 0);

  const nextReward = computed(() => {
    return streakRewards.value
      .filter(reward => !reward.claimed && streakDays.value < reward.streakDays)
      .sort((a, b) => a.streakDays - b.streakDays)[0];
  });

  const totalMultiplier = computed(() => {
    return streakMultiplier.value * prestigeMultiplier.value;
  });

  // Actions
  async function init() {
    try {
      if (!userWallet.value) {
        loadFromLocalStorage();
        return;
      }
      
      // Use gameService to initialize
      const gameState = await gameService.initSession(userWallet.value);
      if (gameState) {
        updateUIFromGameState(gameState);
        startAutoClicker();
      } else {
        // Fallback to local storage if service fails
        loadFromLocalStorage();
      }
      
      // Set up auto-save interval
      const syncInterval = setInterval(async () => {
        if (userWallet.value) {
          await saveGameState();
        }
      }, 30000); // Sync every 30 seconds
      
      // Clean up interval when component unmounts
      onUnmounted(() => {
        if (syncInterval) clearInterval(syncInterval);
        if (autoClickerInterval) clearInterval(autoClickerInterval);
      });
    } catch (error) {
      errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), 'Initializing game store');
      loadFromLocalStorage();
    }
  }

  function loadFromLocalStorage(): boolean {
    try {
      const savedCoins = localStorage.getItem('coins');
      const savedClicks = localStorage.getItem('totalClicks');
      const savedLastClickTime = localStorage.getItem('lastClickTime');
      const savedCooldownEndTime = localStorage.getItem('cooldownEndTime');
      const savedStreakDays = localStorage.getItem('streakDays');
      const savedLastLoginDate = localStorage.getItem('lastLoginDate');
      const savedPowerUps = localStorage.getItem('powerUps');
      const savedOfflineEarnings = localStorage.getItem('offlineEarnings');
      const savedStreakRewards = localStorage.getItem('streakRewards');
      
      if (!savedCoins) return false;
      
      if (savedCoins) coins.value = parseInt(savedCoins, 10);
      if (savedClicks) totalClicks.value = parseInt(savedClicks, 10);
      if (savedLastClickTime) lastClickTime.value = parseInt(savedLastClickTime, 10);
      if (savedCooldownEndTime) cooldownEndTime.value = parseInt(savedCooldownEndTime, 10);
      if (savedStreakDays) streakDays.value = parseInt(savedStreakDays, 10);
      if (savedLastLoginDate) lastLoginDate.value = savedLastLoginDate;
      if (savedPowerUps) powerUps.value = JSON.parse(savedPowerUps);
      if (savedOfflineEarnings) offlineEarnings.value = JSON.parse(savedOfflineEarnings);
      if (savedStreakRewards) streakRewards.value = JSON.parse(savedStreakRewards);
      
      // Update derived values
      updateStreakMultiplier();
      startAutoClicker();
      
      return true;
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return false;
    }
  }

  function updateUIFromGameState(gameState: UIGameState) {
    coins.value = gameState.coins;
    totalClicks.value = gameState.totalClicks;
    lastClickTime.value = gameState.lastClickTime;
    cooldownEndTime.value = gameState.cooldownEndTime;
    streakDays.value = gameState.streakDays;
    lastLoginDate.value = gameState.lastLoginDate;
    powerUps.value = gameState.powerUps;
    offlineEarnings.value = gameState.offlineEarnings;
    
    // Handle streak rewards if present
    if (gameState.streakRewards) {
      streakRewards.value = gameState.streakRewards;
    } else {
      // Get defaults from service
      streakRewards.value = gameService.getDefaultStreakRewards();
    }
    
    // Update derived values
    updateStreakMultiplier();
  }

  function saveToLocalStorage() {
    try {
      localStorage.setItem('coins', coins.value.toString());
      localStorage.setItem('totalClicks', totalClicks.value.toString());
      localStorage.setItem('lastClickTime', lastClickTime.value?.toString() || '');
      localStorage.setItem('cooldownEndTime', cooldownEndTime.value?.toString() || '');
      localStorage.setItem('streakDays', streakDays.value.toString());
      localStorage.setItem('lastLoginDate', lastLoginDate.value || '');
      localStorage.setItem('powerUps', JSON.stringify(powerUps.value));
      localStorage.setItem('offlineEarnings', JSON.stringify(offlineEarnings.value));
      localStorage.setItem('streakRewards', JSON.stringify(streakRewards.value));
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  }

  async function saveGameState() {
    if (!userWallet.value) {
      saveToLocalStorage();
      return;
    }
    
    // Construct game state from UI state
    const gameState: UIGameState = {
      coins: coins.value,
      totalClicks: totalClicks.value,
      lastClickTime: lastClickTime.value,
      cooldownEndTime: cooldownEndTime.value,
      streakDays: streakDays.value,
      lastLoginDate: lastLoginDate.value,
      powerUps: powerUps.value,
      offlineEarnings: offlineEarnings.value,
      streakRewards: streakRewards.value
    };
    
    // Use service to save
    await gameService.saveGameState(userWallet.value, gameState);
    
    // Also save to localStorage as fallback
    saveToLocalStorage();
  }

  // Handle reward from clicker button
  async function handleReward(amount: number) {
    if (!userWallet.value) {
      // Offline mode - handle locally
      const multipliedAmount = Math.floor(amount * totalMultiplier.value);
      coins.value += multipliedAmount;
      totalClicks.value += 1;
      lastClickTime.value = Date.now();
      saveToLocalStorage();
      return multipliedAmount;
    }
    
    // Logged in - use service
    const result = await gameService.handleClick(userWallet.value, amount);
    if (result.success) {
      // Update UI state with new values
      const gameState = await gameService.getState(userWallet.value);
      if (gameState) {
        updateUIFromGameState(gameState);
      }
      
      return result.amount;
    }
    
    return 0;
  }

  function startCooldown(duration: number) {
    cooldownEndTime.value = Date.now() + duration;
    lastClickTime.value = Date.now();
    saveGameState();
  }

  /**
   * Synchronize local cooldown state with server timestamp
   * @param serverTimestamp Server timestamp to calculate cooldown from
   */
  function syncCooldownWithServer(serverTimestamp?: number) {
    if (!serverTimestamp) {
      console.error('Cannot sync cooldown: No server timestamp provided');
      return;
    }
    
    // Use the server timestamp to keep client and server in sync
    const cooldownTime = 15 * 60 * 1000; // Default 15 minutes, should match server
    cooldownEndTime.value = serverTimestamp + cooldownTime;
    lastClickTime.value = serverTimestamp;
    saveGameState();
  }

  function activateCoinRush(duration: number) {
    if (!userWallet.value) {
      // Handle locally for offline mode
      powerUps.value.coinRush.active = true;
      powerUps.value.coinRush.endTime = Date.now() + duration;
      saveToLocalStorage();
      
      // Set timeout to deactivate
      setTimeout(() => {
        powerUps.value.coinRush.active = false;
        powerUps.value.coinRush.endTime = null;
        saveToLocalStorage();
      }, duration);
      
      return;
    }
    
    // Use service for online mode
    gameService.activateCoinRush(userWallet.value, duration).then(() => {
      powerUps.value.coinRush.active = true;
      powerUps.value.coinRush.endTime = Date.now() + duration;
      
      // Set timeout to update UI
      setTimeout(() => {
        powerUps.value.coinRush.active = false;
        powerUps.value.coinRush.endTime = null;
      }, duration);
    });
  }

  function activateAutoClicker(duration: number) {
    if (!userWallet.value) {
      // Handle locally for offline mode
      powerUps.value.autoClicker.active = true;
      powerUps.value.autoClicker.endTime = Date.now() + duration;
      saveToLocalStorage();
      
      // Set timeout to deactivate
      setTimeout(() => {
        powerUps.value.autoClicker.active = false;
        powerUps.value.autoClicker.endTime = null;
        saveToLocalStorage();
      }, duration);
      
      return;
    }
    
    // Use service for online mode
    gameService.activateAutoClicker(userWallet.value, duration).then(() => {
      powerUps.value.autoClicker.active = true;
      powerUps.value.autoClicker.endTime = Date.now() + duration;
      
      // Set timeout to update UI
      setTimeout(() => {
        powerUps.value.autoClicker.active = false;
        powerUps.value.autoClicker.endTime = null;
      }, duration);
    });
  }

  // Start auto-clicker interval
  function startAutoClicker() {
    // Clear any existing interval
    if (autoClickerInterval) {
      clearInterval(autoClickerInterval);
    }
    
    // Set up interval for auto-clicker
    autoClickerInterval = setInterval(() => {
      if (powerUps.value.autoClicker.active && !isCooldown.value) {
        // Auto-clicker gives rewards without triggering cooldown
        const baseReward = 10; // Smaller reward for auto-clicker
        
        if (userWallet.value) {
          // Use service for online mode, but without UI updates per click
          // to reduce network traffic
          gameService.addCoins(userWallet.value, baseReward, {
            trackClick: false,
            applyMultipliers: true
          }).then(({ success, finalAmount }) => {
            if (success) {
              coins.value += finalAmount;
            }
          });
        } else {
          // Offline mode - handle locally
          const multipliedReward = Math.floor(baseReward * totalMultiplier.value);
          coins.value += multipliedReward;
          saveToLocalStorage();
        }
      }
    }, 1000 / powerUps.value.autoClicker.clicksPerSecond);
  }

  // Update power-up status (check if they should be deactivated)
  function updatePowerUpStatus() {
    const now = Date.now();
    let updated = false;
    
    // Check Coin Rush
    if (powerUps.value.coinRush.active && powerUps.value.coinRush.endTime && now > powerUps.value.coinRush.endTime) {
      powerUps.value.coinRush.active = false;
      powerUps.value.coinRush.endTime = null;
      updated = true;
    }
    
    // Check Auto-Clicker
    if (powerUps.value.autoClicker.active && powerUps.value.autoClicker.endTime && now > powerUps.value.autoClicker.endTime) {
      powerUps.value.autoClicker.active = false;
      powerUps.value.autoClicker.endTime = null;
      updated = true;
    }
    
    if (updated) {
      saveGameState();
    }
  }

  function updateStreakMultiplier() {
    if (userWallet.value) {
      // For online users, use the service calculation with current state
      const gameState = {
        streakDays: streakDays.value,
        streakRewards: streakRewards.value
      } as any;
      
      streakMultiplier.value = gameService.calculateStreakMultiplier(gameState);
      return;
    }
    
    // Offline users - calculate locally
    let multiplier = 1.0;
    
    // Check for claimed multiplier rewards
    streakRewards.value.forEach(reward => {
      if (reward.claimed && reward.type === 'multiplier' && streakDays.value >= reward.streakDays) {
        // Apply the highest value
        multiplier = Math.max(multiplier, reward.value);
      }
    });
    
    // If no multiplier rewards claimed yet, use default streak logic
    if (multiplier === 1.0) {
      if (streakDays.value >= 30) {
        multiplier = 2.0;
      } else if (streakDays.value >= 7) {
        multiplier = 1.5;
      } else if (streakDays.value >= 3) {
        multiplier = 1.2;
      }
    }
    
    streakMultiplier.value = multiplier;
  }

  async function claimReward(rewardId: number) {
    if (!userWallet.value) {
      // Offline mode - handle locally
      const reward = streakRewards.value.find(r => r.id === rewardId);
      
      if (!reward || reward.claimed || streakDays.value < reward.streakDays) {
        return { success: false, message: 'Cannot claim this reward' };
      }
      
      // Apply reward effect
      if (reward.type === 'clicks') {
        coins.value += reward.value;
        totalClicks.value += reward.value;
      } else if (reward.type === 'multiplier') {
        // Multiplier rewards are handled in updateStreakMultiplier
        // We don't need to do anything here as they're automatic
      } else if (reward.type === 'power_up') {
        // Apply power-up buffs
        if (reward.id === 4) { // Double duration reward
          powerUps.value.coinRush.multiplier *= 2;
          powerUps.value.autoClicker.clicksPerSecond *= 2;
        }
      }
      
      // Mark as claimed
      reward.claimed = true;
      
      // Save game state
      saveToLocalStorage();
      
      return { 
        success: true, 
        message: `Claimed: ${reward.description}`, 
        reward 
      };
    }
    
    // Online mode - use service
    const result = await gameService.claimReward(userWallet.value, rewardId);
    
    // Update UI state if successful
    if (result.success) {
      // Get updated state that includes the claimed reward
      const gameState = await gameService.getState(userWallet.value);
      if (gameState) {
        updateUIFromGameState(gameState);
      }
    }
    
    return result;
  }

  function updatePrestigeMultiplier(multiplier: number) {
    prestigeMultiplier.value = multiplier;
  }

  function updateAutoClickerSpeed(speed: number) {
    autoClickerSpeed.value = speed;
    
    // Restart auto-clicker with new speed
    startAutoClicker();
  }

  // Functions for multiplayer betting
  async function handleBet(amount: number) {
    if (!userWallet.value) {
      // Offline mode
      if (coins.value < amount) return false;
      coins.value -= amount;
      saveToLocalStorage();
      return true;
    }
    
    // Online mode - use service
    const success = await gameService.placeBet(userWallet.value, amount);
    
    if (success) {
      // Update UI state
      coins.value -= amount;
    }
    
    return success;
  }

  return {
    // State
    coins,
    totalClicks,
    lastClickTime,
    cooldownEndTime,
    streakDays,
    lastLoginDate,
    isStreakActive,
    streakMultiplier,
    prestigeMultiplier,
    autoClickerSpeed,
    powerUps,
    offlineEarnings,
    streakRewards,
    isCooldown,
    cooldownTimeLeft,
    availableRewards,
    hasUnclaimedRewards,
    nextReward,
    totalMultiplier,
    
    // Actions
    init,
    saveGameState,
    handleReward,
    startCooldown,
    syncCooldownWithServer,
    activateCoinRush,
    activateAutoClicker,
    updatePowerUpStatus,
    updateStreakMultiplier,
    claimReward,
    updatePrestigeMultiplier,
    updateAutoClickerSpeed,
    handleBet
  };
}); 