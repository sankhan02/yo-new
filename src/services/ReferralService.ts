import { supabase } from '../storage/config/supabase';
import { v4 as uuidv4 } from 'uuid';
import type { Referral, ReferralStats, LeaderboardEntry, ReferralReward } from '../models/ReferralModels';

/**
 * Service for handling all referral-related functionality
 */
export class ReferralService {
  /**
   * Generate a unique referral code for a user
   */
  static async generateReferralCode(userId: string): Promise<string | null> {
    // Check if user already has a referral code
    const { data: existingCode } = await supabase
      .from('referral_codes')
      .select('code')
      .eq('user_id', userId)
      .single();
    if (existingCode) {
      return existingCode.code;
    }
    // Generate a unique code
    const code = uuidv4().substring(0, 8);
    const { error } = await supabase.from('referral_codes').insert({
      user_id: userId,
      code,
      created_at: new Date().toISOString(),
    });
    if (error) {
      console.error('Error generating referral code:', error);
      return null;
    }
    return code;
  }

  /**
   * Get a user's referral code
   */
  static async getReferralCode(userId: string): Promise<string | null> {
    const { data } = await supabase
      .from('referral_codes')
      .select('code')
      .eq('user_id', userId)
      .single();
    return data?.code || null;
  }

  /**
   * Create a referral relationship when a new user signs up with a code
   */
  static async createReferral(referralCode: string, refereeId: string): Promise<boolean> {
    // Look up the code in referral_codes
    const { data: codeRow } = await supabase
      .from('referral_codes')
      .select('user_id')
      .eq('code', referralCode)
      .single();
    if (!codeRow) {
      console.error('Invalid referral code');
      return false;
    }
    const referrerId = codeRow.user_id;
    if (referrerId === refereeId) {
      console.error('Cannot refer yourself');
      return false;
    }
    // Insert into referrals
    const { error } = await supabase.from('referrals').insert({
      referrer_id: referrerId,
      referee_id: refereeId,
      joined_at: new Date().toISOString(),
      is_active: false,
      reward_claimed: false,
      reward_amount: 0,
    });
    if (error) {
      console.error('Error creating referral:', error);
      return false;
    }
    return true;
  }

  /**
   * Activate a referral (when referee meets criteria)
   */
  static async activateReferral(refereeId: string): Promise<boolean> {
    const { data: referral } = await supabase
      .from('referrals')
      .select('id, is_active')
      .eq('referee_id', refereeId)
      .single();
    if (!referral || referral.is_active) return false;
    const { error } = await supabase
      .from('referrals')
      .update({ is_active: true })
      .eq('id', referral.id);
    if (error) {
      console.error('Error activating referral:', error);
      return false;
    }
    return true;
  }

  /**
   * Claim a referral reward
   */
  static async claimReferralReward(referralId: string): Promise<boolean> {
    const { error } = await supabase
      .from('referrals')
      .update({ reward_claimed: true })
      .eq('id', referralId);
    if (error) {
      console.error('Error claiming referral reward:', error);
      return false;
    }
    return true;
  }

  /**
   * Get referral statistics for a user
   */
  static async getReferralStats(userId: string): Promise<ReferralStats> {
    const { data: referrals } = await supabase
      .from('referrals')
      .select('is_active, reward_amount, reward_claimed')
      .eq('referrer_id', userId);
    if (!referrals || referrals.length === 0) {
      return {
        total_referrals: 0,
        active_referrals: 0,
        total_coins_earned: 0,
        is_eligible_for_rewards: false,
      };
    }
    const totalReferrals = referrals.length;
    const activeReferrals = referrals.filter((r: any) => r.is_active).length;
    const totalCoinsEarned = referrals.reduce((sum: number, r: any) => sum + (r.reward_claimed ? r.reward_amount : 0), 0);
    const isEligibleForRewards = activeReferrals > 0;
    return {
      total_referrals: totalReferrals,
      active_referrals: activeReferrals,
      total_coins_earned: totalCoinsEarned,
      is_eligible_for_rewards: isEligibleForRewards,
    };
  }

  /**
   * Calculate and award the referrer bonus (1K coins + 5% of referee's first 10K coins)
   */
  static async calculateAndAwardReferrerBonus(referralId: number, refereeCoinsMined: number): Promise<number> {
    // Get the referral to find the referrer
    const { data: referral } = await supabase
      .from('referrals')
      .select('referrer_id, coins_earned')
      .eq('id', referralId)
      .single();

    if (!referral) {
      console.error('Referral not found');
      return 0;
    }

    // Calculate bonus: 1000 coins + 5% of referee's coins (up to 10K)
    const baseBonus = 1000;
    const percentBonus = Math.min(refereeCoinsMined, 10000) * 0.05;
    const totalBonus = baseBonus + percentBonus;

    // Update the total coins earned through this referral
    const newTotalEarned = (referral.coins_earned || 0) + totalBonus;
    await supabase
      .from('referrals')
      .update({
        coins_earned: newTotalEarned
      })
      .eq('id', referralId);

    // Award the coins to the referrer
    await supabase.rpc('add_coins_to_user', {
      user_id: referral.referrer_id,
      amount: totalBonus,
      source: 'referral_commission'
    });

    return totalBonus;
  }

  /**
   * Get the referral leaderboard
   */
  static async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
    // Get users with the most referrals
    const { data } = await supabase
      .rpc('get_referral_leaderboard', { limit_count: limit });

    return data || [];
  }

  /**
   * Get available rewards for a user based on their referral count
   */
  static async getAvailableRewards(userId: string): Promise<ReferralReward[]> {
    // Get user's referral stats
    const stats = await this.getReferralStats(userId);

    // Get all possible rewards
    const { data: allRewards } = await supabase
      .from('referral_rewards')
      .select('*')
      .order('min_referrals', { ascending: true });

    if (!allRewards) return [];

    // Get user's claimed rewards
    const { data: claimedRewards } = await supabase
      .from('user_referral_rewards')
      .select('reward_id')
      .eq('user_id', userId);

    const claimedIds = claimedRewards ? claimedRewards.map(r => r.reward_id) : [];

    // Mark rewards as claimed or eligible
    return allRewards.map(reward => ({
      ...reward,
      is_claimed: claimedIds.includes(reward.id),
    }));
  }

  /**
   * Process different types of rewards
   */
  private static async processReward(userId: string, reward: ReferralReward): Promise<void> {
    switch (reward.type) {
      case 'coins':
        // Award coins
        await supabase.rpc('add_coins_to_user', {
          user_id: userId,
          amount: Number(reward.description) || 1000, // Assuming description contains the amount for coin rewards
          source: 'referral_reward'
        });
        break;
      case 'badge':
        // Award badge
        await supabase
          .from('user_badges')
          .insert({
            user_id: userId,
            badge_id: reward.name.toLowerCase().replace(/\s+/g, '_'),
            awarded_at: new Date().toISOString()
          });
        break;
      // Other reward types would be handled here
      default:
        console.log(`Processing ${reward.type} reward`);
    }
  }
} 