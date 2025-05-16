export interface Referral {
  id: number;
  referrer_id: string;
  referrer_wallet: string;
  referee_id: string | null;
  referee_wallet: string | null;
  referral_code: string;
  referral_link: string;
  status: 'pending' | 'completed' | 'expired';
  created_at: string;
  completed_at: string | null;
  coins_earned: number;
}

export interface ReferralStats {
  total_referrals: number;
  active_referrals: number;
  total_coins_earned: number;
  is_eligible_for_rewards: boolean;
}

export interface LeaderboardEntry {
  user_id: string;
  wallet_address: string;
  username: string | null;
  avatar_url: string | null;
  referral_count: number;
  total_coins_earned: number;
  rank: number;
}

export interface ReferralReward {
  id: number;
  name: string;
  description: string;
  type: 'badge' | 'coins' | 'nft' | 'special';
  image_url: string | null;
  min_referrals: number;
  is_claimed: boolean;
} 