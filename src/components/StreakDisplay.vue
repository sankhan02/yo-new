<template>
  <div class="streak-display">
    <div class="streak-header">
      <div class="streak-icon" :class="{ 'streak-active': isStreakActive }">
        🔥
      </div>
      <div class="streak-title">Daily Streak</div>
    </div>
    
    <div class="streak-info">
      <div class="streak-days">{{ streakDays }} days</div>
      <div class="streak-multiplier">{{ multiplierLabel }}</div>
    </div>
    
    <div class="streak-progress">
      <div class="streak-milestones">
        <div class="milestone" :class="{ 'milestone-reached': streakDays >= 3 }">3d</div>
        <div class="milestone" :class="{ 'milestone-reached': streakDays >= 7 }">7d</div>
        <div class="milestone" :class="{ 'milestone-reached': streakDays >= 30 }">30d</div>
      </div>
      
      <div class="progress-bar">
        <div class="progress-fill" :style="progressStyle"></div>
      </div>
      
      <div class="streak-rewards">
        <div class="reward" :class="{ 'reward-unlocked': streakDays >= 3 }">1.2x</div>
        <div class="reward" :class="{ 'reward-unlocked': streakDays >= 7 }">1.5x</div>
        <div class="reward" :class="{ 'reward-unlocked': streakDays >= 30 }">2.0x</div>
      </div>
    </div>
    
    <div v-if="!isStreakActive" class="streak-warning">
      ⚠️ Come back tomorrow to keep your streak!
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '@/store/gameStore';

const gameStore = useGameStore();

// Get streak data from the store
const streakDays = computed(() => gameStore.streakDays);
const isStreakActive = computed(() => gameStore.isStreakActive);
const streakMultiplier = computed(() => gameStore.streakMultiplier);

// Compute the progress percentage (capped at 30 days)
const progressPercentage = computed(() => {
  const maxDays = 30; // Max streak days for UI
  return Math.min((streakDays.value / maxDays) * 100, 100);
});

// Progress bar style with dynamic width
const progressStyle = computed(() => {
  return {
    width: `${progressPercentage.value}%`,
  };
});

// Multiplier display label
const multiplierLabel = computed(() => {
  return `${streakMultiplier.value.toFixed(1)}x multiplier`;
});
</script>

<style scoped>
.streak-display {
  background-color: #ffffff;
  border-radius: 0.5rem;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin: 1rem 0;
  width: 100%;
}

.streak-header {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
}

.streak-icon {
  font-size: 1.25rem;
  margin-right: 0.5rem;
  opacity: 0.3;
  transition: all 0.3s ease;
}

.streak-icon.streak-active {
  opacity: 1;
  animation: flame 1.5s infinite alternate;
}

@keyframes flame {
  0% { transform: scale(1); }
  100% { transform: scale(1.2); }
}

.streak-title {
  font-weight: 600;
  font-size: 1rem;
}

.streak-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.streak-days {
  font-size: 1.25rem;
  font-weight: 700;
}

.streak-multiplier {
  font-size: 0.875rem;
  color: #059669;
  background-color: #d1fae5;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 500;
}

.streak-progress {
  margin-bottom: 0.75rem;
}

.streak-milestones, .streak-rewards {
  display: flex;
  justify-content: space-between;
  padding: 0 0.25rem;
  margin-bottom: 0.25rem;
  font-size: 0.75rem;
}

.milestone, .reward {
  opacity: 0.5;
  transition: all 0.3s ease;
}

.milestone-reached, .reward-unlocked {
  opacity: 1;
  font-weight: 600;
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

.streak-warning {
  font-size: 0.75rem;
  color: #b91c1c;
  margin-top: 0.5rem;
  text-align: center;
}
</style> 