import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { SupabaseStorage } from '../storage/supabase/SupabaseStorage';
import type { User } from '@supabase/supabase-js';
import type { 
  UserProfile, 
  GameSettings, 
  GameStatistics, 
  PowerUp,
  Clan,
  Referral,
  PvPMatch,
  LeaderboardEntry 
} from '../storage/interfaces/StorageInterface';
import { supabase } from '../storage/config/supabase';
import { offlineManager } from '../services/offlineManager';
import { errorHandler, AuthError, StorageError, SyncError } from '../services/errorHandler';

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  userRank: number | null;
}

export const useSupabaseStore = defineStore('supabase', () => {
  const storage = new SupabaseStorage();
  
  // State
  const currentUser = ref<User | null>(null);
  const userProfile = ref<UserProfile | null>(null);
  const gameSettings = ref<GameSettings | null>(null);
  const gameStats = ref<GameStatistics | null>(null);
  const powerUps = ref<PowerUp[]>([]);
  const userClan = ref<Clan | null>(null);
  const referrals = ref<Referral[]>([]);
  const pvpMatches = ref<PvPMatch[]>([]);
  const leaderboard = ref<LeaderboardEntry[]>([]);
  const isLoading = ref(false);
  const error = ref<Error | null>(null);
  const isOnline = computed(() => offlineManager.getOnlineStatus());
  const subscriptions = ref<{ [key: string]: any }>({});

  // Getters
  const totalClicks = computed(() => gameStats.value?.totalClicks || 0);
  const streakCount = computed(() => gameStats.value?.streakCount || 0);
  const lastClickTime = computed(() => gameStats.value?.lastClickTime);
  const userPreferences = computed(() => gameSettings.value?.preferences);
  const userTheme = computed(() => gameSettings.value?.theme);
  const activePowerUps = computed(() => powerUps.value.filter(p => p.quantity > 0));
  const activeMatches = computed(() => pvpMatches.value.filter(m => m.status === 'active'));

  // Real-time update handlers
  function handleGameStateUpdate(payload: any) {
    if (!currentUser.value || payload.new.user_id !== currentUser.value.id) return;
    
    gameStats.value = {
      ...gameStats.value,
      ...payload.new
    };
  }

  function handlePvPMatchUpdate(payload: any) {
    if (!currentUser.value) return;
    const userId = currentUser.value.id;
    
    // Only handle updates for matches where the user is a participant
    if (payload.new.player1_id !== userId && payload.new.player2_id !== userId) return;
    
    const matchIndex = pvpMatches.value.findIndex(m => m.id === payload.new.id);
    if (matchIndex !== -1) {
      pvpMatches.value[matchIndex] = payload.new;
    } else {
      pvpMatches.value.push(payload.new);
    }
  }

  function handleClanUpdate(payload: any) {
    if (!userClan.value || userClan.value.id !== payload.new.id) return;
    userClan.value = payload.new;
  }

  function handleReferralUpdate(payload: any) {
    if (!currentUser.value) return;
    const userId = currentUser.value.id;
    
    // Handle updates for referrals where user is either referrer or referred
    if (payload.new.referrer_id !== userId && payload.new.referred_id !== userId) return;
    
    const referralIndex = referrals.value.findIndex(r => r.id === payload.new.id);
    if (referralIndex !== -1) {
      referrals.value[referralIndex] = payload.new;
    } else {
      referrals.value.push(payload.new);
    }
  }

  // Subscription setup
  async function setupRealtimeSubscriptions() {
    if (!currentUser.value) return;
    const userId = currentUser.value.id;

    try {
      // Game state subscription
      subscriptions.value.gameState = supabase
        .channel('game_states')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'game_states',
            filter: `user_id=eq.${userId}`
          },
          handleGameStateUpdate
        )
        .subscribe();

      // PvP matches subscription
      subscriptions.value.pvpMatches = supabase
        .channel('pvp_matches')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pvp_matches',
            filter: `or(player1_id.eq.${userId},player2_id.eq.${userId})`
          },
          handlePvPMatchUpdate
        )
        .subscribe();

      // Clan subscription (if user is in a clan)
      if (userClan.value) {
        subscriptions.value.clan = supabase
          .channel('clans')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'clans',
              filter: `id=eq.${userClan.value.id}`
            },
            handleClanUpdate
          )
          .subscribe();
      }

      // Referrals subscription
      subscriptions.value.referrals = supabase
        .channel('referrals')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'referrals',
            filter: `or(referrer_id.eq.${userId},referred_id.eq.${userId})`
          },
          handleReferralUpdate
        )
        .subscribe();

    } catch (e) {
      console.error('Error setting up real-time subscriptions:', e);
      error.value = e instanceof Error ? e : new Error(String(e));
    }
  }

  // Cleanup subscriptions
  async function cleanupSubscriptions() {
    try {
      for (const channel of Object.values(subscriptions.value)) {
        if (channel) {
          await supabase.removeChannel(channel);
        }
      }
      subscriptions.value = {};
    } catch (e) {
      console.error('Error cleaning up subscriptions:', e);
    }
  }

  // Initialize store
  async function initialize() {
    try {
      isLoading.value = true;
      error.value = null;

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw new AuthError(`Failed to get user: ${authError.message}`);
      
      if (!user) throw new AuthError('No user found');
      currentUser.value = user;

      // Load all user data in parallel
      await errorHandler.retryOperation(async () => {
        const [
          profileData,
          settingsData,
          statsData,
          powerUpsData,
          clanData,
          referralsData,
          matchesData
        ] = await Promise.all([
          storage.getUserProfile(user.id),
          storage.getGameSettings(user.id),
          storage.getGameStatistics(user.id),
          storage.getPowerUps(user.id),
          storage.getUserClan(user.id),
          storage.getReferrals(user.id),
          storage.getPvPMatches(user.id)
        ]);

        userProfile.value = profileData;
        gameSettings.value = settingsData;
        gameStats.value = statsData;
        powerUps.value = powerUpsData;
        userClan.value = clanData;
        referrals.value = referralsData;
        pvpMatches.value = matchesData;
      }, 'Loading user data');

      // Setup real-time subscriptions after data is loaded
      await setupRealtimeSubscriptions();
    } catch (e) {
      const gameError = e instanceof Error ? e : new Error(String(e));
      error.value = gameError;
      await errorHandler.handleError(gameError, 'Initializing Supabase store');
      throw gameError;
    } finally {
      isLoading.value = false;
    }
  }

  // Update game statistics
  async function updateGameStats(newStats: Partial<GameStatistics>) {
    try {
      if (!currentUser.value?.id) throw new AuthError('No user logged in');
      if (!gameStats.value) throw new StorageError('Game stats not initialized');

      // Update local state immediately
      gameStats.value = { ...gameStats.value, ...newStats };

      // If offline, queue the operation
      if (!offlineManager.getOnlineStatus()) {
        await offlineManager.queueOperation({
          type: 'click',
          data: { userId: currentUser.value.id, ...newStats },
          timestamp: Date.now()
        });
        return;
      }

      // If online, update directly
      await errorHandler.retryOperation(
        async () => {
          await storage.updateGameStatistics(currentUser.value!.id, newStats);
        },
        'Updating game statistics'
      );
    } catch (e) {
      const gameError = e instanceof Error ? e : new Error(String(e));
      error.value = gameError;
      await errorHandler.handleError(gameError, 'Updating game statistics');
      throw gameError;
    }
  }

  // Update power-up
  async function updatePowerUp(powerUpId: string, quantity: number) {
    try {
      if (!currentUser.value?.id) throw new AuthError('No user logged in');

      // Update local state immediately
      const powerUp = powerUps.value.find(p => p.id === powerUpId);
      if (powerUp) {
        powerUp.quantity = quantity;
      }

      // If offline, queue the operation
      if (!offlineManager.getOnlineStatus()) {
        await offlineManager.queueOperation({
          type: 'powerUp',
          data: { userId: currentUser.value.id, powerUpId, quantity },
          timestamp: Date.now()
        });
        return;
      }

      // If online, update directly
      await errorHandler.retryOperation(
        async () => {
          await storage.updatePowerUp(currentUser.value!.id, powerUpId, quantity);
        },
        'Updating power-up'
      );
    } catch (e) {
      const gameError = e instanceof Error ? e : new Error(String(e));
      error.value = gameError;
      await errorHandler.handleError(gameError, 'Updating power-up');
      throw gameError;
    }
  }

  // Update game settings
  async function updateSettings(newSettings: Partial<GameSettings>) {
    try {
      if (!currentUser.value?.id) throw new AuthError('No user logged in');
      if (!gameSettings.value) throw new StorageError('Game settings not initialized');

      // Update local state immediately
      gameSettings.value = { ...gameSettings.value, ...newSettings };

      // If offline, queue the operation
      if (!offlineManager.getOnlineStatus()) {
        await offlineManager.queueOperation({
          type: 'settings',
          data: { userId: currentUser.value.id, settings: newSettings },
          timestamp: Date.now()
        });
        return;
      }

      // If online, update directly
      await errorHandler.retryOperation(
        async () => {
          await storage.updateGameSettings(currentUser.value!.id, newSettings);
        },
        'Updating game settings'
      );
    } catch (e) {
      const gameError = e instanceof Error ? e : new Error(String(e));
      error.value = gameError;
      await errorHandler.handleError(gameError, 'Updating game settings');
      throw gameError;
    }
  }

  // Add referral
  async function addReferral(referredId: string) {
    try {
      if (!currentUser.value?.id) throw new AuthError('No user logged in');

      // If offline, queue the operation
      if (!offlineManager.getOnlineStatus()) {
        await offlineManager.queueOperation({
          type: 'referral',
          data: { referrerId: currentUser.value.id, referredId },
          timestamp: Date.now()
        });
        return;
      }

      // If online, add directly
      await errorHandler.retryOperation(
        async () => {
          const newReferral = await storage.addReferral(currentUser.value!.id, referredId);
          referrals.value.push(newReferral);
        },
        'Adding referral'
      );
    } catch (e) {
      const gameError = e instanceof Error ? e : new Error(String(e));
      error.value = gameError;
      await errorHandler.handleError(gameError, 'Adding referral');
      throw gameError;
    }
  }

  // Fetch leaderboard
  async function fetchLeaderboard(
    category: 'clicks' | 'prestige' | 'streak' | 'pvp',
    timeframe: 'all' | 'daily' | 'weekly' | 'monthly'
  ): Promise<LeaderboardResult> {
    try {
      if (!currentUser.value?.id) throw new AuthError('No user logged in');

      let query = supabase
        .from('leaderboard')
        .select(`
          id,
          user_id,
          username,
          clan_tag,
          clicks,
          prestige_level,
          streak_days,
          pvp_wins,
          updated_at
        `)
        .order(getOrderByField(category), { ascending: false })
        .limit(100);

      // Apply timeframe filter
      if (timeframe !== 'all') {
        const fromDate = getFromDate(timeframe);
        query = query.gte('updated_at', fromDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw new StorageError(`Failed to fetch leaderboard: ${error.message}`);
      if (!data) return { entries: [], userRank: null };

      // Transform data to LeaderboardEntry format
      const entries = data.map(entry => ({
        userId: entry.user_id,
        username: entry.username,
        clan: entry.clan_tag,
        value: getValue(entry, category),
        updatedAt: entry.updated_at
      }));

      // Get user's rank
      const userRank = entries.findIndex(entry => entry.userId === currentUser.value?.id) + 1;

      return {
        entries,
        userRank: userRank > 0 ? userRank : null
      };
    } catch (e) {
      await errorHandler.handleError(e as Error, 'Fetching leaderboard');
      throw e;
    }
  }

  // Helper functions for leaderboard
  function getOrderByField(category: 'clicks' | 'prestige' | 'streak' | 'pvp'): string {
    switch (category) {
      case 'clicks': return 'clicks';
      case 'prestige': return 'prestige_level';
      case 'streak': return 'streak_days';
      case 'pvp': return 'pvp_wins';
    }
  }

  function getValue(entry: any, category: 'clicks' | 'prestige' | 'streak' | 'pvp'): number {
    switch (category) {
      case 'clicks': return entry.clicks;
      case 'prestige': return entry.prestige_level;
      case 'streak': return entry.streak_days;
      case 'pvp': return entry.pvp_wins;
    }
  }

  function getFromDate(timeframe: 'daily' | 'weekly' | 'monthly'): Date {
    const now = new Date();
    switch (timeframe) {
      case 'daily':
        return new Date(now.setDate(now.getDate() - 1));
      case 'weekly':
        return new Date(now.setDate(now.getDate() - 7));
      case 'monthly':
        return new Date(now.setMonth(now.getMonth() - 1));
    }
  }

  // Cleanup
  async function cleanup() {
    await cleanupSubscriptions();
    currentUser.value = null;
    userProfile.value = null;
    gameSettings.value = null;
    gameStats.value = null;
    powerUps.value = [];
    userClan.value = null;
    referrals.value = [];
    pvpMatches.value = [];
    leaderboard.value = [];
    error.value = null;
  }

  // Watch for user changes
  watch(currentUser, async (newUser) => {
    if (newUser) {
      await initialize().catch(console.error);
    } else {
      await cleanup();
    }
  });

  // Watch for clan changes to update subscription
  watch(userClan, async (newClan, oldClan) => {
    if (oldClan?.id !== newClan?.id) {
      // Remove old clan subscription if it exists
      if (subscriptions.value.clan) {
        await supabase.removeChannel(subscriptions.value.clan);
      }
      
      // Setup new clan subscription if user joined a clan
      if (newClan && currentUser.value) {
        subscriptions.value.clan = supabase
          .channel('clans')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'clans',
              filter: `id=eq.${newClan.id}`
            },
            handleClanUpdate
          )
          .subscribe();
      }
    }
  });

  return {
    // State
    currentUser,
    userProfile,
    gameSettings,
    gameStats,
    powerUps,
    userClan,
    referrals,
    pvpMatches,
    leaderboard,
    isLoading,
    error,
    isOnline,

    // Getters
    totalClicks,
    streakCount,
    lastClickTime,
    userPreferences,
    userTheme,
    activePowerUps,
    activeMatches,

    // Actions
    initialize,
    updateGameStats,
    updatePowerUp,
    updateSettings,
    addReferral,
    fetchLeaderboard,
    cleanup,
    setupRealtimeSubscriptions,
    cleanupSubscriptions
  };
}); 