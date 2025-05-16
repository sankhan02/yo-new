<template>
  <div class="powerups-container">
    <h3 class="powerups-title">Power-ups</h3>
    
    <div class="powerups-grid">
      <div class="powerup-card" :class="{ 'powerup-active': coinRushActive }">
        <div class="powerup-icon">⚡</div>
        <div class="powerup-name">Coin Rush</div>
        <div class="powerup-description">2x coins for 30 seconds</div>
        <div v-if="coinRushActive" class="powerup-timer">{{ formatTime(coinRushTimeLeft) }}</div>
        <div v-else class="powerup-unlock">
          {{ 500 - (totalClicks % 500) }} clicks until next
        </div>
      </div>
      
      <div class="powerup-card" :class="{ 'powerup-active': autoClickerActive }">
        <div class="powerup-icon">🖱️</div>
        <div class="powerup-name">Auto-Clicker</div>
        <div class="powerup-description">Auto-click once per second</div>
        <div v-if="autoClickerActive" class="powerup-timer">{{ formatTime(autoClickerTimeLeft) }}</div>
        <div v-else class="powerup-unlock">
          0.1% chance on each click
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '@/store/gameStore';

const gameStore = useGameStore();

// Get powerup data from store
const coinRushActive = computed(() => gameStore.powerUps.coinRush.active);
const autoClickerActive = computed(() => gameStore.powerUps.autoClicker.active);
const totalClicks = computed(() => gameStore.totalClicks);

// Calculate time left for coin rush
const coinRushTimeLeft = computed(() => {
  if (!gameStore.powerUps.coinRush.endTime) return 0;
  const timeLeft = gameStore.powerUps.coinRush.endTime - Date.now();
  return timeLeft > 0 ? timeLeft : 0;
});

// Calculate time left for auto-clicker
const autoClickerTimeLeft = computed(() => {
  if (!gameStore.powerUps.autoClicker.endTime) return 0;
  const timeLeft = gameStore.powerUps.autoClicker.endTime - Date.now();
  return timeLeft > 0 ? timeLeft : 0;
});

// Format time in seconds (MM:SS)
const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
</script>

<style scoped>
.powerups-container {
  width: 100%;
  margin-top: 1.5rem;
}

.powerups-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  text-align: center;
}

.powerups-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.powerup-card {
  background-color: #f3f4f6;
  border-radius: 0.5rem;
  padding: 0.75rem;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.powerup-active {
  background-color: #fef3c7;
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.3);
  transform: translateY(-2px);
}

.powerup-icon {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.powerup-name {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.powerup-description {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.powerup-timer {
  font-size: 0.875rem;
  font-weight: 600;
  color: #059669;
  background-color: rgba(5, 150, 105, 0.1);
  padding: 0.125rem 0.5rem;
  border-radius: 1rem;
}

.powerup-unlock {
  font-size: 0.75rem;
  color: #6b7280;
}
</style> 