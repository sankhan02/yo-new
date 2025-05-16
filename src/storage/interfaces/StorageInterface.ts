import type { User } from '@supabase/supabase-js';

// Basic data models
export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  created_at: string;
  updated_at: string;
}

export interface GameSettings {
  userId: string;
  preferences: {
    sound: boolean;
    music: boolean;
    notifications: boolean;
  };
  theme: string;
  lastUpdated: string;
}

export interface GameStatistics {
  userId: string;
  totalClicks: number;
  powerUpsUsed: number;
  streakCount: number;
  lastClickTime: string;
  created_at: string;
  updated_at: string;
}

export interface PowerUp {
  id: string;
  userId: string;
  type: string;
  quantity: number;
  lastPurchased: string;
}

export interface Clan {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  created_at: string;
  updated_at: string;
}

export interface Referral {
  id: string;
  referrerId: string;
  referredId: string;
  status: 'pending' | 'completed';
  created_at: string;
}

/**
 * Consolidated PvP Match interface
 * Used across all PvP-related functionality
 */
export interface PvPMatch {
  id: string;
  matchId?: string; // For backward compatibility
  player1Id: string;
  player2Id: string;
  player1Score: number;
  player2Score: number;
  player1PowerUps?: any[];
  player2PowerUps?: any[];
  startTime: number;
  endTime?: number | null;
  status: 'waiting' | 'pending' | 'active' | 'completed' | 'cancelled';
  winnerId?: string | null;
  winnerReward?: number | null;
  loserReward?: number | null;
  matchData?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  clan?: string;
  value: number;
  updatedAt: string;
  rating?: number; // For matchmaking
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
  userRank: number | null;
}

// Storage Interface
export interface StorageInterface {
  // User Management
  createUserProfile(user: User): Promise<UserProfile>;
  getUserProfile(userId: string): Promise<UserProfile | null>;
  updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile>;
  
  // Game Settings
  getGameSettings(userId: string): Promise<GameSettings | null>;
  updateGameSettings(userId: string, settings: Partial<GameSettings>): Promise<GameSettings>;
  
  // Statistics
  getStatistics(userId: string): Promise<GameStatistics | null>;
  updateStatistics(userId: string, stats: Partial<GameStatistics>): Promise<GameStatistics>;
  
  // Click Tracking
  recordClick(userId: string): Promise<void>;
  getClickCount(userId: string): Promise<number>;
  
  // Power-ups
  getPowerUps(userId: string): Promise<PowerUp[]>;
  addPowerUp(userId: string, type: string, quantity: number): Promise<PowerUp>;
  usePowerUp(userId: string, type: string): Promise<PowerUp>;
  
  // Streak System
  getStreak(userId: string): Promise<number>;
  updateStreak(userId: string): Promise<number>;
  resetStreak(userId: string): Promise<void>;
  
  // Clan System
  createClan(name: string, ownerId: string): Promise<Clan>;
  getClan(clanId: string): Promise<Clan | null>;
  addClanMember(clanId: string, userId: string): Promise<void>;
  removeClanMember(clanId: string, userId: string): Promise<void>;
  
  // Referral System
  createReferral(referrerId: string, referredId: string): Promise<Referral>;
  completeReferral(referralId: string): Promise<Referral>;
  getReferrals(userId: string): Promise<Referral[]>;

  // PvP System
  createPvPMatch(player1Id: string, player2Id: string): Promise<PvPMatch>;
  getPvPMatch(matchId: string): Promise<PvPMatch | null>;
  updatePvPScore(matchId: string, playerId: string, score: number): Promise<PvPMatch>;
  completePvPMatch(matchId: string, winnerId: string): Promise<PvPMatch>;
  getPlayerMatches(playerId: string, limit?: number): Promise<PvPMatch[]>;
  getLeaderboard(
    category: 'clicks' | 'prestige' | 'streak' | 'pvp',
    timeframe: 'all' | 'daily' | 'weekly' | 'monthly',
    limit?: number
  ): Promise<LeaderboardData>;
  getPlayerRank(playerId: string): Promise<LeaderboardEntry | null>;
} 