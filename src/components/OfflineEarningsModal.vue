<template>
  <div v-if="showModal" class="offline-earnings-overlay">
    <div class="offline-earnings-modal">
      <div class="offline-earnings-header">
        <h2>Welcome Back!</h2>
        <div class="offline-time">
          You were away for {{ formatTime(timeAway) }}
        </div>
      </div>
      
      <div class="offline-earnings-content">
        <div class="earnings-icon">💰</div>
        <div class="earnings-amount">
          <div class="earnings-value">+{{ formatNumber(offlineEarnings) }}</div>
          <div class="earnings-label">coins earned while away</div>
        </div>
      </div>
      
      <div class="offline-earnings-details">
        <p>You earn 10% of your normal rate while away (max 8 hours)</p>
      </div>
      
      <button class="collect-button" @click="closeModal">
        Collect Earnings
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useGameStore } from '@/store/gameStore';

const props = defineProps({
  earnedAmount: {
    type: Number,
    default: 0
  },
  timeAway: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['close']);

const showModal = ref(false);
const offlineEarnings = ref(0);
const gameStore = useGameStore();

// Format numbers with commas
const formatNumber = (num: number) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Format time in a human-readable way
const formatTime = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ${hours % 24} hour${hours % 24 !== 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes % 60} minute${minutes % 60 !== 1 ? 's' : ''}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ${seconds % 60} second${seconds % 60 !== 1 ? 's' : ''}`;
  } else {
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  }
};

// Calculate offline earnings
const calculateOfflineEarnings = () => {
  // The actual calculation is already handled in the gameStore
  // This is just to get the amount to display
  const baseRate = 100; // coins per hour
  const cappedTime = Math.min(props.timeAway, 8 * 60 * 60 * 1000); // Cap at 8 hours
  const hoursAway = cappedTime / (1000 * 60 * 60);
  const earnings = Math.floor(baseRate * hoursAway * 0.1); // 10% rate
  
  return earnings;
};

// Show the modal if there are offline earnings to collect
onMounted(() => {
  offlineEarnings.value = props.earnedAmount || calculateOfflineEarnings();
  
  // Only show the modal if there are actual earnings
  if (offlineEarnings.value > 0) {
    showModal.value = true;
  }
});

// Close the modal and emit the close event
const closeModal = () => {
  showModal.value = false;
  emit('close');
};
</script>

<style scoped>
.offline-earnings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.offline-earnings-modal {
  background-color: #ffffff;
  border-radius: 1rem;
  padding: 1.5rem;
  max-width: 26rem;
  width: 90%;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  animation: modal-appear 0.3s ease-out;
}

@keyframes modal-appear {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.offline-earnings-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.offline-earnings-header h2 {
  font-size: 1.5rem;
  margin: 0 0 0.5rem 0;
  color: #111827;
}

.offline-time {
  font-size: 0.875rem;
  color: #6b7280;
}

.offline-earnings-content {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  gap: 1rem;
}

.earnings-icon {
  font-size: 2.5rem;
}

.earnings-amount {
  text-align: left;
}

.earnings-value {
  font-size: 2rem;
  font-weight: 700;
  color: #f59e0b;
}

.earnings-label {
  font-size: 0.875rem;
  color: #6b7280;
}

.offline-earnings-details {
  text-align: center;
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 1.5rem;
}

.collect-button {
  display: block;
  width: 100%;
  padding: 0.75rem;
  background-color: #f59e0b;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.collect-button:hover {
  background-color: #d97706;
}
</style> 