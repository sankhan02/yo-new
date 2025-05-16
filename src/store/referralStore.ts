import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { userWallet } from '../lib/auth';
import { supabase } from '../storage/config/supabase';

export interface Referee {
  userId: string;
  username?: string;
  avatar?: string;
  joinedAt: string;
  isActive: boolean;
}

interface UserReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  totalCoinsEarned: number;
  currentRank?: number;
}

export interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  totalRewards: number;
}

export const useReferralStore = defineStore('referral', () => {
  // State
  const referralCode = ref<string | null>(null);
  const referralLink = ref<string | null>(null);
  const referees = ref<Referee[]>([]);
  const leaderboard = ref<any[]>([]);
  const userStats = ref<UserReferralStats | null>(null);
  const isLoadingReferees = ref(false);
  const referralError = ref<string | null>(null);
  const totalRewards = ref(0);
  const isGeneratingCode = ref(false);
  const isLoadingLeaderboard = ref(false);

  // Computed
  const hasReferralCode = computed(() => !!referralCode.value);
  const referralCount = computed(() => referees.value.length);
  const activeReferralCount = computed(() => referees.value.filter(referee => referee.isActive).length);
  const referralStats = computed<ReferralStats>(() => {
    return {
      totalReferrals: referees.value.length,
      activeReferrals: referees.value.filter(r => r.isActive).length,
      totalRewards: totalRewards.value
    };
  });

  // Methods

  /**
   * Check URL for referral code and save it if found
   */
  function checkUrlForReferralCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('ref');
    if (code) {
      localStorage.setItem('referralCode', code);
      // Remove the ref parameter from URL without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete('ref');
      window.history.replaceState({}, document.title, url.toString());
    }
  }

  /**
   * Generate a new referral code for the user
   */
  async function generateReferralCode(userId: string) {
    try {
      if (referralCode.value) {
        return referralCode.value;
      }
      // Check if user already has a referral code
      const { data: existingCode } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('user_id', userId)
        .single();
      if (existingCode) {
        referralCode.value = existingCode.code;
        referralLink.value = generateReferralLink(existingCode.code);
        return existingCode.code;
      }
      // Generate a random code
      const code = generateRandomCode(8);
      const { error } = await supabase
        .from('referral_codes')
        .insert({
          user_id: userId,
          code,
          created_at: new Date().toISOString(),
        });
      if (error) throw error;
      referralCode.value = code;
      referralLink.value = generateReferralLink(code);
      return code;
    } catch (error) {
      referralError.value = 'Failed to generate referral code';
      console.error('Error generating referral code:', error);
      return null;
    }
  }

  /**
   * Get the user's referral code
   */
  async function getReferralCode(userId: string) {
    isGeneratingCode.value = true;
    referralError.value = null;
    try {
      if (referralCode.value) {
        return referralCode.value;
      }
      const { data } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('user_id', userId)
        .single();
      if (data) {
        referralCode.value = data.code;
        referralLink.value = generateReferralLink(data.code);
        return data.code;
      }
      return await generateReferralCode(userId);
    } catch (err) {
      const error = err as Error;
      console.error('Error getting referral code:', error);
      referralError.value = error.message || 'Failed to get referral code';
      throw error;
    } finally {
      isGeneratingCode.value = false;
    }
  }

  /**
   * Load the user's referees
   */
  async function loadReferees(userId: string) {
    try {
      isLoadingReferees.value = true;
      referralError.value = null;
      // Fetch referees from database
      const { data, error } = await supabase
        .from('referrals')
        .select('referee_id, joined_at, is_active')
        .eq('referrer_id', userId);
      if (error) throw error;
      // Transform data for the frontend
      const transformedData = data.map((item: any) => ({
        userId: item.referee_id,
        joinedAt: item.joined_at,
        isActive: item.is_active,
      }));
      referees.value = transformedData;
      return transformedData;
    } catch (error) {
      referralError.value = 'Failed to load referrals';
      console.error('Error loading referrals:', error);
      return [];
    } finally {
      isLoadingReferees.value = false;
    }
  }

  /**
   * Load the referral leaderboard (top users by referral count)
   */
  async function loadLeaderboard() {
    try {
      isLoadingLeaderboard.value = true;
      const { data, error } = await supabase
        .from('public_leaderboard_most_referrals')
        .select('*');
      if (error) throw error;
      leaderboard.value = data;
      return data;
    } catch (error) {
      referralError.value = 'Failed to load leaderboard';
      console.error('Error loading leaderboard:', error);
      return [];
    } finally {
      isLoadingLeaderboard.value = false;
    }
  }

  function resetReferralState() {
    referralCode.value = null;
    referralLink.value = null;
    referees.value = [];
    referralError.value = null;
    totalRewards.value = 0;
  }

  // Helper functions
  function generateRandomCode(length: number) {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  function generateReferralLink(code: string) {
    const baseUrl = window.location.origin;
    return `${baseUrl}/register?ref=${code}`;
  }

  return {
    // State
    referralCode,
    referralLink,
    referees,
    leaderboard,
    userStats,
    isLoadingReferees,
    referralError,
    totalRewards,
    isGeneratingCode,
    isLoadingLeaderboard,
    // Computed
    hasReferralCode,
    referralCount,
    activeReferralCount,
    referralStats,
    // Methods
    checkUrlForReferralCode,
    generateReferralCode,
    getReferralCode,
    loadReferees,
    loadLeaderboard,
    resetReferralState
  };
}); 