<template>
  <div class="streak-rewards-container">
    <h3 class="rewards-title">Streak Rewards</h3>
    
    <div v-if="availableRewards.length > 0" class="rewards-section">
      <h4 class="section-title">Available Rewards</h4>
      <div class="rewards-grid">
        <div 
          v-for="reward in availableRewards" 
          :key="reward.id" 
          class="reward-card"
        >
          <div class="reward-icon">
            <span v-if="reward.type === 'multiplier'">✖️</span>
            <span v-else-if="reward.type === 'clicks'">🪙</span>
            <span v-else-if="reward.type === 'power_up'">⚡</span>
          </div>
          <div class="reward-details">
            <div class="reward-name">{{ getDayLabel(reward.streakDays) }}</div>
            <div class="reward-description">{{ reward.description }}</div>
          </div>
          <button 
            @click="claimReward(reward.id)" 
            class="claim-button"
          >
            Claim
          </button>
        </div>
      </div>
    </div>
    
    <div v-else-if="nextReward" class="next-reward-section">
      <h4 class="section-title">Next Reward</h4>
      <div class="next-reward-card">
        <div class="reward-icon">
          <span v-if="nextReward.type === 'multiplier'">✖️</span>
          <span v-else-if="nextReward.type === 'clicks'">🪙</span>
          <span v-else-if="nextReward.type === 'power_up'">⚡</span>
        </div>
        <div class="reward-details">
          <div class="reward-name">{{ getDayLabel(nextReward.streakDays) }}</div>
          <div class="reward-description">{{ nextReward.description }}</div>
          <div class="reward-progress">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ width: `${progressToNextReward}%` }"
              ></div>
            </div>
            <div class="progress-text">
              {{ streakDays }} / {{ nextReward.streakDays }} days
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="all-claimed">
      <p>You've claimed all available streak rewards! 🎉</p>
      <p>Keep your streak going for future rewards.</p>
    </div>
    
    <div class="rewards-list">
      <h4 class="section-title">All Rewards</h4>
      <div class="rewards-table">
        <div 
          v-for="reward in streakRewards" 
          :key="reward.id" 
          class="reward-row"
          :class="{ 'reward-claimed': reward.claimed, 'reward-available': isRewardAvailable(reward), 'reward-locked': !isRewardAvailable(reward) && !reward.claimed }"
        >
          <div class="reward-day">Day {{ reward.streakDays }}</div>
          <div class="reward-type">
            <span v-if="reward.type === 'multiplier'">Multiplier</span>
            <span v-else-if="reward.type === 'clicks'">Coins</span>
            <span v-else-if="reward.type === 'power_up'">Power-Up</span>
          </div>
          <div class="reward-description">{{ reward.description }}</div>
          <div class="reward-status">
            <span v-if="reward.claimed">Claimed ✅</span>
            <span v-else-if="isRewardAvailable(reward)">Available 🎁</span>
            <span v-else>Locked 🔒</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '@/store/gameStore';
import type { StreakReward } from '@/store/gameStore';

const gameStore = useGameStore();

// Get streak data from the store
const streakDays = computed(() => gameStore.streakDays);
const streakRewards = computed(() => gameStore.streakRewards);
const availableRewards = computed(() => gameStore.availableRewards);
const nextReward = computed(() => gameStore.nextReward);

// Progress percentage to next reward
const progressToNextReward = computed(() => {
  if (!nextReward.value) return 100;
  
  const progress = (streakDays.value / nextReward.value.streakDays) * 100;
  return Math.min(progress, 100);
});

// Helper function to determine if a reward is available
const isRewardAvailable = (reward: StreakReward) => {
  return !reward.claimed && streakDays.value >= reward.streakDays;
};

// Helper function to get a nice day label
const getDayLabel = (days: number) => {
  return `${days}-Day Streak`;
};

// Function to claim reward
const claimReward = async (rewardId: number) => {
  const result = await gameStore.claimReward(rewardId);
  
  if (result.success) {
    // You could add a toast notification here
    console.log(result.message);
  } else {
    console.error(result.message);
  }
};
</script>

<style scoped>
.streak-rewards-container {
  width: 100%;
  margin-top: 1.5rem;
}

.rewards-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
  text-align: center;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #4b5563;
}

.rewards-section, .next-reward-section {
  margin-bottom: 1.5rem;
}

.rewards-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.reward-card, .next-reward-card {
  background-color: #fff;
  border-radius: 0.5rem;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
}

.reward-icon {
  font-size: 1.5rem;
  margin-right: 0.75rem;
  background-color: #fef3c7;
  color: #d97706;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.reward-details {
  flex: 1;
}

.reward-name {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.reward-description {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.claim-button {
  background-color: #10b981;
  color: white;
  border: none;
  border-radius: 0.375rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.claim-button:hover {
  background-color: #059669;
}

.progress-bar {
  height: 0.5rem;
  background-color: #e5e7eb;
  border-radius: 1rem;
  overflow: hidden;
  margin-bottom: 0.25rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #fcd34d, #f59e0b);
  border-radius: 1rem;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.75rem;
  color: #6b7280;
  text-align: right;
}

.all-claimed {
  background-color: #f9fafb;
  border-radius: 0.5rem;
  padding: 1rem;
  text-align: center;
  margin-bottom: 1.5rem;
}

.all-claimed p {
  margin: 0.5rem 0;
  font-size: 0.875rem;
  color: #4b5563;
}

.rewards-table {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
}

.reward-row {
  display: grid;
  grid-template-columns: 0.8fr 1fr 2fr 1fr;
  padding: 0.75rem;
  font-size: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
  transition: background-color 0.2s;
}

.reward-row:last-child {
  border-bottom: none;
}

.reward-claimed {
  background-color: #f9fafb;
  color: #9ca3af;
}

.reward-available {
  background-color: #f0fdf4;
}

.reward-locked {
  color: #9ca3af;
}

.reward-status {
  text-align: right;
  font-weight: 500;
}
</style> 