import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { supabase } from '@/storage/config/supabase';
import { useGameStore } from './gameStore';
import { userWallet, isAuthenticated } from '@/lib/auth';
import {
  fetchMatch,
  createMatch,
  updateMatchStatus,
  updatePlayerScore,
  getPlayerMatches,
  joinQueue,
  leaveQueue,
  findMatchForUser,
  getLeaderboardTopCoins,
  getActiveMatch,
  logMatchResult
} from '@/services/pvpService';
import type { PvPMatch, LeaderboardEntry } from '@/storage/interfaces/StorageInterface';
import { ref as vueRef } from 'vue';

export interface Player {
  id: string;
  walletAddress: string;
  displayName: string;
  clicks: number;
  lastActive: string;
  tier?: string;
  inGame?: boolean;
  clanId?: string;
}

export interface Match {
  id: string;
  type: '1v1';
  status: 'pending' | 'waiting' | 'in_progress' | 'completed' | 'declined' | 'cancelled';
  bet: number;
  playerIds: string[];
  startTime?: string;
  endTime?: string;
  winnerId?: string | string[];
}

export interface MatchInvitation {
  id: string;
  inviterId: string;
  targetPlayerId: string;
  type: '1v1' | '2v2';
  proposedBet: number;
  status: 'pending' | 'accepted' | 'declined' | 'countered' | 'expired';
  counterBet?: number;
  createdAt: string;
  expiresAt: string;
}

export interface Clan {
  id: string;
  name: string;
  tag: string;
  description: string;
  ownerWallet: string;
  members: string[];
  created: string;
  totalWins: number;
  activeMembers: number;
}

export const useMultiplayerStore = defineStore('multiplayer', () => {
  // Dependencies
  const gameStore = useGameStore();

  // State
  const currentPlayer = ref<Player | null>(null);
  const onlinePlayers = ref<Player[]>([]);
  const isMatchmaking = ref(false);
  const currentMatch = ref<PvPMatch | null>(null);
  const matchHistory = ref<PvPMatch[]>([]);
  const betAmount = ref(10); // Default minimum bet
  const clan = ref<Clan | null>(null);
  const leaderboard = ref<LeaderboardEntry[]>([]);
  const clanLeaderboard = ref<Clan[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const sentInvitations = ref<MatchInvitation[]>([]);
  const receivedInvitations = ref<MatchInvitation[]>([]);
  const invitationPollingInterval = ref<number | null>(null);
  // Track subscription cleanup functions
  const subscriptions = ref<{[key: string]: () => void}>({});
  // Track match update subscription cleanup
  const matchUnsubscribe = vueRef<null | (() => void)>(null);

  // Computed properties
  const canStartMatchmaking = computed(() => {
    return isAuthenticated.value && 
           !isMatchmaking.value && 
           !currentMatch.value && 
           gameStore.coins >= betAmount.value;
  });

  const matchmakingPool = computed(() => {
    return onlinePlayers.value.filter(p => 
      p.inGame === false && p.walletAddress !== currentPlayer.value?.walletAddress
    );
  });

  const clanBonus = computed(() => {
    if (!clan.value) return 0;
    // 1% bonus per active member
    return clan.value.activeMembers * 0.01;
  });

  const playerStats = computed(() => {
    const playerId = currentPlayer.value?.id;
    if (!playerId) {
      return {
        wins: 0,
        losses: 0,
        winRate: '0',
        totalEarnings: 0
      };
    }

    const wins = matchHistory.value.filter(m => 
      m.status === 'completed' && m.winnerId === playerId
    ).length;
    
    const losses = matchHistory.value.filter(m => 
      m.status === 'completed' && m.winnerId !== playerId
    ).length;
    
    const totalEarnings = matchHistory.value.reduce((sum, match) => {
      if (match.status === 'completed' && match.winnerId === playerId) {
        return sum + (match.winnerReward || 0);
      }
      return sum;
    }, 0);
    
    return {
      wins,
      losses,
      winRate: wins + losses > 0 ? (wins / (wins + losses) * 100).toFixed(1) : '0',
      totalEarnings
    };
  });

  // Calculate potential winnings for a match
  function calculateWinnings(match: PvPMatch): number {
    // Calculate winnings based on match data
    return match.winnerReward || 0;
  }

  // Utility: Subscribe to real-time updates for a match
  function subscribeToMatchUpdates(matchId: string, onUpdate: (match: any) => void) {
    const channel = supabase
      .channel(`pvp_match_${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pvp_matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          if (payload.new) {
            onUpdate(payload.new);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }

  // Actions
  async function initializePlayer() {
    if (!isAuthenticated.value || !userWallet.value) return;
    
    isLoading.value = true;
    error.value = null;
    
    try {
      const { data, error: dbError } = await supabase
        .from('players')
        .select('*')
        .eq('wallet_address', userWallet.value)
        .single();
      
      if (dbError && dbError.code !== 'PGRST116') {
        throw dbError;
      }
      
      if (!data) {
        // Create new player
        const newPlayer: Player = {
          walletAddress: userWallet.value,
          displayName: `Player_${userWallet.value.slice(0, 6)}`,
          clicks: gameStore.totalClicks,
          lastActive: new Date().toISOString(),
          inGame: false,
          id: `player_${Date.now()}`
        };
        
        const { data: insertData, error: insertError } = await supabase
          .from('players')
          .insert([newPlayer])
          .select()
          .single();
          
        if (insertError) throw insertError;
        currentPlayer.value = insertData;
      } else {
        currentPlayer.value = data;
        // Update player stats
        await updatePlayerStatus({
          lastActive: new Date().toISOString(),
          clicks: gameStore.totalClicks,
        });
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to initialize player';
      console.error('Error initializing player:', e);
    } finally {
      isLoading.value = false;
    }
  }
  
  async function updatePlayerStatus(updates: Partial<Player>) {
    if (!currentPlayer.value) return;
    
    try {
      const { error: updateError } = await supabase
        .from('players')
        .update(updates)
        .eq('id', currentPlayer.value.id);
        
      if (updateError) throw updateError;
      
      // Update local state
      currentPlayer.value = {
        ...currentPlayer.value,
        ...updates
      };
    } catch (e) {
      console.error('Error updating player status:', e);
    }
  }

  async function startMatchmaking(bet: number = betAmount.value) {
    if (!currentPlayer.value || isMatchmaking.value || currentMatch.value) return;
    try {
      isLoading.value = true;
      isMatchmaking.value = true;
      error.value = null;
      if (gameStore.coins < bet) {
        error.value = 'Not enough coins to place bet';
        isMatchmaking.value = false;
        return;
      }
      gameStore.handleReward(bet);
      // Add player to matchmaking queue and try to find a match
      const match = await joinQueue(currentPlayer.value.id);
      if (match) {
        currentMatch.value = match;
        isMatchmaking.value = false;
        // Subscribe to match updates
        if (matchUnsubscribe.value) matchUnsubscribe.value();
        matchUnsubscribe.value = subscribeToMatchUpdates(match.id, async (updatedMatch) => {
          currentMatch.value = updatedMatch;
          if (updatedMatch.status === 'completed') {
            // Log match result
            const winnerId = updatedMatch.winner_id;
            const loserId = updatedMatch.players?.find((p: any) => p.user_id !== winnerId)?.user_id;
            if (winnerId && loserId) {
              await logMatchResult({
                matchId: updatedMatch.id,
                winnerId,
                loserId,
                bet: updatedMatch.bet || 0
              });
            }
            if (matchUnsubscribe.value) matchUnsubscribe.value();
            matchUnsubscribe.value = null;
          }
        });
      } else {
        // Poll for a match every 3 seconds
        if (subscriptions.value.queue) {
          subscriptions.value.queue();
        }
        const poll = setInterval(async () => {
          try {
            const foundMatch = await findMatchForUser(currentPlayer.value!.id);
            if (foundMatch) {
              currentMatch.value = foundMatch;
              isMatchmaking.value = false;
              clearInterval(poll);
              if (subscriptions.value.queue) {
                subscriptions.value.queue();
                delete subscriptions.value.queue;
              }
              // Subscribe to match updates
              if (matchUnsubscribe.value) matchUnsubscribe.value();
              matchUnsubscribe.value = subscribeToMatchUpdates(foundMatch.id, async (updatedMatch) => {
                currentMatch.value = updatedMatch;
                if (updatedMatch.status === 'completed') {
                  // Log match result
                  const winnerId = updatedMatch.winner_id;
                  const loserId = updatedMatch.players?.find((p: any) => p.user_id !== winnerId)?.user_id;
                  if (winnerId && loserId) {
                    await logMatchResult({
                      matchId: updatedMatch.id,
                      winnerId,
                      loserId,
                      bet: updatedMatch.bet || 0
                    });
                  }
                  if (matchUnsubscribe.value) matchUnsubscribe.value();
                  matchUnsubscribe.value = null;
                }
              });
            }
          } catch (e) {
            console.error('Error polling for match:', e);
          }
        }, 3000);
        subscriptions.value.queue = () => clearInterval(poll);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to start matchmaking';
      console.error('Error starting matchmaking:', e);
      isMatchmaking.value = false;
      gameStore.handleReward(bet);
    } finally {
      isLoading.value = false;
    }
  }

  async function cancelMatchmaking() {
    if (!currentPlayer.value || !isMatchmaking.value) return;
    try {
      isLoading.value = true;
      // Remove player from matchmaking queue
      await leaveQueue(currentPlayer.value.id);
      if (subscriptions.value.queue) {
        subscriptions.value.queue();
        delete subscriptions.value.queue;
      }
      // Clean up match update subscription
      if (matchUnsubscribe.value) matchUnsubscribe.value();
      matchUnsubscribe.value = null;
      gameStore.handleReward(betAmount.value);
      isMatchmaking.value = false;
    } catch (e) {
      console.error('Error canceling matchmaking:', e);
    } finally {
      isLoading.value = false;
    }
  }

  async function updateMatchScore(score: number) {
    if (!currentPlayer.value || !currentMatch.value) return;
    try {
      await updatePlayerScore(currentMatch.value.id, currentPlayer.value.id, score);
    } catch (e) {
      console.error('Error updating match score:', e);
    }
  }

  async function fetchOnlinePlayers() {
    try {
      const { data, error: fetchError } = await supabase
        .from('players')
        .select('*')
        .eq('inGame', false)
        .gt('lastActive', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Active in last 5 minutes
        
      if (fetchError) throw fetchError;
      
      onlinePlayers.value = data || [];
    } catch (e) {
      console.error('Error fetching online players:', e);
    }
  }

  async function fetchMatchHistory() {
    if (!currentPlayer.value) return;
    try {
      const matches = await getPlayerMatches(currentPlayer.value.id, 10);
      matchHistory.value = matches;
    } catch (e) {
      console.error('Error fetching match history:', e);
    }
  }

  async function fetchLeaderboard() {
    try {
      leaderboard.value = await getLeaderboardTopCoins(20);
    } catch (e) {
      console.error('Error fetching leaderboard:', e);
      leaderboard.value = [];
    }
  }

  async function init() {
    await initializePlayer();
    await fetchMatchHistory();
    await fetchLeaderboard();
    await fetchOnlinePlayers();
    // Check for active match and subscribe to updates if needed
    if (currentPlayer.value) {
      const activeMatch = await getActiveMatch(currentPlayer.value.id);
      if (activeMatch) {
        currentMatch.value = activeMatch;
        // Subscribe to match updates
        if (matchUnsubscribe.value) matchUnsubscribe.value();
        matchUnsubscribe.value = subscribeToMatchUpdates(activeMatch.id, (updatedMatch) => {
          currentMatch.value = updatedMatch;
          if (updatedMatch.status === 'completed') {
            if (matchUnsubscribe.value) matchUnsubscribe.value();
            matchUnsubscribe.value = null;
          }
        });
      }
    }
  }

  // Handle component unmount
  const onUnmounted = (fn: () => void) => {
    // This would typically be provided by Vue, but we're simulating it here
    // In a real component, use the Vue onUnmounted lifecycle hook
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  };

  return {
    currentPlayer,
    onlinePlayers,
    isMatchmaking,
    currentMatch,
    matchHistory,
    betAmount,
    clan,
    leaderboard,
    clanLeaderboard,
    isLoading,
    error,
    sentInvitations,
    receivedInvitations,
    canStartMatchmaking,
    matchmakingPool,
    clanBonus,
    playerStats,
    calculateWinnings,
    initializePlayer,
    updatePlayerStatus,
    startMatchmaking,
    cancelMatchmaking,
    updateMatchScore,
    fetchOnlinePlayers,
    fetchMatchHistory,
    fetchLeaderboard,
    init
  };
}); 