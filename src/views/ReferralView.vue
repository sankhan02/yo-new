<template>
  <div class="referral-page">
    <Header />
    
    <main class="content-container">
      <h1 class="page-title">Invite Friends & Earn Rewards</h1>
      
      <div class="referral-layout">
        <div class="referral-section">
          <ReferralCard />
          
          <div class="rewards-section" v-if="isAuthenticated">
            <h2 class="section-title">Your Referral Rewards</h2>
            
            <div v-if="isLoadingRewards" class="loading-container">
              <div class="spinner"></div>
              <span>Loading rewards...</span>
            </div>
            
            <div v-else-if="rewardsError" class="error-container">
              <p>{{ rewardsError }}</p>
              <button @click="loadRewards" class="retry-btn">Retry</button>
            </div>
            
            <div v-else-if="!availableRewards.length" class="empty-rewards">
              <p>You haven't earned any rewards yet. Invite friends to start earning!</p>
            </div>
            
            <div v-else class="rewards-grid">
              <div 
                v-for="reward in availableRewards" 
                :key="reward.id" 
                class="reward-card"
                :class="{ 'claiming': claimingRewardId === reward.id }"
              >
                <div class="reward-icon" :class="reward.type">
                  <span v-if="reward.type === 'coin'">🪙</span>
                  <span v-else-if="reward.type === 'badge'">🏆</span>
                  <span v-else-if="reward.type === 'boost'">⚡</span>
                  <span v-else>🎁</span>
                </div>
                
                <div class="reward-details">
                  <h3 class="reward-name">{{ reward.name }}</h3>
                  <p class="reward-description">{{ reward.description }}</p>
                </div>
                
                <button 
                  @click="claimReward(reward.id)" 
                  class="claim-btn"
                  :disabled="isClaimingReward"
                >
                  <span v-if="claimingRewardId === reward.id">Claiming...</span>
                  <span v-else>Claim Reward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <ReferralLeaderboard class="leaderboard-section" />
      </div>
      
      <div class="how-it-works">
        <h2 class="section-title">How It Works</h2>
        
        <div class="steps-container">
          <div class="step">
            <div class="step-number">1</div>
            <h3>Generate Your Link</h3>
            <p>Create your unique referral link to share with friends</p>
          </div>
          
          <div class="step">
            <div class="step-number">2</div>
            <h3>Share With Friends</h3>
            <p>Send your link via social media, messaging apps, or email</p>
          </div>
          
          <div class="step">
            <div class="step-number">3</div>
            <h3>Friends Join & Play</h3>
            <p>When friends sign up using your link, you both get rewards</p>
          </div>
          
          <div class="step">
            <div class="step-number">4</div>
            <h3>Earn Rewards</h3>
            <p>Get coins, badges, and special boosts as rewards</p>
          </div>
        </div>
      </div>
      
      <div class="faq-section">
        <h2 class="section-title">Frequently Asked Questions</h2>
        
        <div class="faq-list">
          <div class="faq-item">
            <h3>How many friends can I refer?</h3>
            <p>There's no limit to how many friends you can refer. The more friends join, the more rewards you can earn!</p>
          </div>
          
          <div class="faq-item">
            <h3>When do I get my rewards?</h3>
            <p>You'll receive rewards when your friends sign up using your link and when they reach certain milestones in the game.</p>
          </div>
          
          <div class="faq-item">
            <h3>What rewards can I earn?</h3>
            <p>You can earn in-game coins, exclusive badges, XP boosts, and special NFTs depending on how many friends you refer.</p>
          </div>
          
          <div class="faq-item">
            <h3>How long is my referral link valid?</h3>
            <p>Your referral link doesn't expire and can be used multiple times by different friends.</p>
          </div>
        </div>
      </div>
    </main>
    
    <Footer />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Header from '../components/Header.vue';
import Footer from '../components/Footer.vue';
import ReferralCard from '../components/ReferralCard.vue';
import ReferralLeaderboard from '../components/ReferralLeaderboard.vue';
import { useReferralStore } from '../store/referralStore';
import { userWallet } from '../lib/auth';

// Define reward interface
interface Reward {
  id: string;
  name: string;
  description: string;
  type: 'coin' | 'badge' | 'boost' | 'other';
}

const referralStore = useReferralStore();

// State
const rewardsError = ref<string | null>(null);
const claimingRewardId = ref<string | null>(null);
const availableRewards = ref<Reward[]>([]);
const isLoadingRewards = ref(false);

// Computed
const isAuthenticated = computed(() => !!userWallet.value);
const isClaimingReward = computed(() => claimingRewardId.value !== null);

// Methods
async function loadRewards() {
  if (!userWallet.value) return;
  
  rewardsError.value = null;
  isLoadingRewards.value = true;
  
  try {
    // Simulate loading rewards from backend
    // In a real application, this would be fetched from your backend
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Dummy data - in a real app this would come from an API
    availableRewards.value = [
      {
        id: '1',
        name: '1,000 MAMA Coins',
        description: 'Earned from your first referral',
        type: 'coin'
      },
      {
        id: '2',
        name: 'Early Adopter Badge',
        description: 'Special badge for early game supporters',
        type: 'badge'
      },
      {
        id: '3',
        name: '2x Click Multiplier',
        description: '24 hour boost for your clicking power',
        type: 'boost'
      }
    ];
    
    if (referralStore.referralError) {
      rewardsError.value = referralStore.referralError;
    }
  } catch (err) {
    console.error('Error loading rewards:', err);
    rewardsError.value = err instanceof Error ? err.message : 'Failed to load rewards';
  } finally {
    isLoadingRewards.value = false;
  }
}

async function claimReward(rewardId: string) {
  if (claimingRewardId.value !== null) return;
  
  claimingRewardId.value = rewardId;
  
  try {
    // Simulate claiming a reward
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Remove the claimed reward
    availableRewards.value = availableRewards.value.filter(r => r.id !== rewardId);
    
    // Show success notification (you might want to add a notification system)
    console.log('Reward claimed successfully!');
  } catch (err) {
    console.error('Error claiming reward:', err);
  } finally {
    claimingRewardId.value = null;
  }
}

// Lifecycle
onMounted(async () => {
  // Check URL for referral code
  referralStore.checkUrlForReferralCode();
  
  if (isAuthenticated.value) {
    await loadRewards();
  }
});
</script>

<style scoped>
.referral-page {
  min-height: 100vh;
  background: #f3f4f6;
}

.content-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 24px;
}

.page-title {
  font-size: 36px;
  font-weight: 800;
  text-align: center;
  color: #111827;
  margin-bottom: 40px;
}

.referral-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 48px;
}

.referral-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 24px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-container {
  text-align: center;
  padding: 24px;
  background: #fee2e2;
  border-radius: 8px;
  color: #b91c1c;
  margin: 24px 0;
}

.retry-btn {
  margin-top: 12px;
  padding: 8px 16px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.empty-rewards {
  text-align: center;
  padding: 40px 20px;
  background: #f9fafb;
  border-radius: 12px;
  color: #6b7280;
  font-style: italic;
}

.rewards-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.reward-card {
  display: flex;
  align-items: center;
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s, box-shadow 0.2s;
}

.reward-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.reward-card.claiming {
  background: #f3f4f6;
  opacity: 0.8;
}

.reward-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-right: 16px;
  flex-shrink: 0;
}

.reward-icon.coin {
  background: #fef3c7;
  color: #d97706;
}

.reward-icon.badge {
  background: #e0e7ff;
  color: #4f46e5;
}

.reward-icon.boost {
  background: #dcfce7;
  color: #047857;
}

.reward-details {
  flex-grow: 1;
}

.reward-name {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
}

.reward-description {
  font-size: 14px;
  color: #6b7280;
}

.claim-btn {
  padding: 8px 16px;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
  white-space: nowrap;
}

.claim-btn:hover {
  background: #4338ca;
}

.claim-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

/* How it works section */
.how-it-works {
  background: #ffffff;
  border-radius: 16px;
  padding: 40px 32px;
  margin-bottom: 48px;
  box-shadow: 0px 8px 16px rgba(0, 0, 0, 0.08);
}

.steps-container {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

.step {
  text-align: center;
  padding: 24px 16px;
  position: relative;
}

.step:not(:last-child)::after {
  content: "";
  position: absolute;
  top: 40px;
  right: -12px;
  width: 24px;
  height: 4px;
  background: #e5e7eb;
}

.step-number {
  width: 48px;
  height: 48px;
  background: #4f46e5;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  margin: 0 auto 16px;
}

.step h3 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 8px;
}

.step p {
  font-size: 14px;
  color: #6b7280;
}

/* FAQ section */
.faq-section {
  background: #ffffff;
  border-radius: 16px;
  padding: 40px 32px;
  box-shadow: 0px 8px 16px rgba(0, 0, 0, 0.08);
}

.faq-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.faq-item {
  padding: 24px;
  background: #f9fafb;
  border-radius: 12px;
}

.faq-item h3 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 12px;
}

.faq-item p {
  font-size: 16px;
  color: #6b7280;
  line-height: 1.5;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .referral-layout {
    grid-template-columns: 1fr;
  }
  
  .steps-container,
  .faq-list {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .step:nth-child(2)::after {
    display: none;
  }
}

@media (max-width: 768px) {
  .page-title {
    font-size: 28px;
  }
  
  .faq-list {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .steps-container {
    grid-template-columns: 1fr;
  }
  
  .step::after {
    display: none;
  }
}
</style> 