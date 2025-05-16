<template>
  <div class="statistics-panel">
    <h3 class="statistics-title">Statistics</h3>
    
    <div class="statistics-grid">
      <div class="stat-item">
        <div class="stat-label">Total Clicks</div>
        <div class="stat-value">{{ formatNumber(totalClicks) }}</div>
      </div>
      
      <div class="stat-item">
        <div class="stat-label">Current Streak</div>
        <div class="stat-value">{{ streakDays }} days</div>
      </div>
      
      <div class="stat-item">
        <div class="stat-label">Click Multiplier</div>
        <div class="stat-value">{{ totalMultiplier.toFixed(1) }}x</div>
      </div>
      
      <div class="stat-item">
        <div class="stat-label">Session Clicks</div>
        <div class="stat-value">{{ formatNumber(sessionClicks) }}</div>
      </div>
      
      <div class="stat-item">
        <div class="stat-label">Clicks Per Hour</div>
        <div class="stat-value">{{ formatNumber(clicksPerHour) }}</div>
      </div>
      
      <div class="stat-item">
        <div class="stat-label">Play Time</div>
        <div class="stat-value">{{ formatTime(playTime) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useGameStore } from '@/store/gameStore';

const gameStore = useGameStore();

// Time tracking state
const sessionStartTime = ref(Date.now());
const sessionClicks = ref(0);
const lastTotalClicks = ref(gameStore.totalClicks);
const playTime = ref(0);
let playTimeInterval: ReturnType<typeof setInterval> | null = null;

// Computed properties from the game store
const totalClicks = computed(() => gameStore.totalClicks);
const streakDays = computed(() => gameStore.streakDays);
const totalMultiplier = computed(() => gameStore.totalMultiplier);

// Calculate clicks per hour based on session data
const clicksPerHour = computed(() => {
  const sessionTimeHours = (Date.now() - sessionStartTime.value) / (1000 * 60 * 60);
  if (sessionTimeHours < 0.01) return 0; // Avoid division by very small numbers
  return Math.round(sessionClicks.value / sessionTimeHours);
});

// Format numbers with commas
const formatNumber = (num: number) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Format time in a human-readable way (HH:MM:SS)
const formatTime = (milliseconds: number) => {
  const seconds = Math.floor((milliseconds / 1000) % 60);
  const minutes = Math.floor((milliseconds / (1000 * 60)) % 60);
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ].join(':');
};

// Update session clicks whenever total clicks changes
const updateSessionClicks = () => {
  if (totalClicks.value > lastTotalClicks.value) {
    sessionClicks.value += (totalClicks.value - lastTotalClicks.value);
    lastTotalClicks.value = totalClicks.value;
  }
};

// Start tracking play time and session stats
onMounted(() => {
  // Reset session stats
  sessionStartTime.value = Date.now();
  sessionClicks.value = 0;
  lastTotalClicks.value = gameStore.totalClicks;
  
  // Update play time every second
  playTimeInterval = setInterval(() => {
    playTime.value = Date.now() - sessionStartTime.value;
    updateSessionClicks();
  }, 1000);
});

// Clean up timer when component is destroyed
onUnmounted(() => {
  if (playTimeInterval) {
    clearInterval(playTimeInterval);
    playTimeInterval = null;
  }
});
</script>

<style scoped>
.statistics-panel {
  width: 100%;
  margin-top: 1.5rem;
  background-color: #ffffff;
  border-radius: 0.5rem;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.statistics-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  text-align: center;
}

.statistics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.stat-item {
  text-align: center;
}

.stat-label {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
}

@media screen and (min-width: 640px) {
  .statistics-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style> 