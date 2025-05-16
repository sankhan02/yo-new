<template>
  <div class="clicker-container">
    <button 
      :class="['clicker-button', { 'on-cooldown': isCooldown, 'disabled': isRateLimited }]" 
      @click="handleClick" 
      :disabled="isCooldown || isRateLimited"
    >
      <span class="clicker-icon" v-if="!isCooldown">🪙</span>
      <span v-else class="cooldown-text">{{ formattedCooldown }}</span>
      <span v-if="isRateLimited" class="rate-limit-text">Slow down!</span>
    </button>
    
    <div class="click-effect" ref="clickEffectRef"></div>
    
    <div v-if="isCooldown" class="cooldown-progress-container">
      <div class="cooldown-progress" :style="{ width: cooldownProgress + '%' }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useGameStore } from '../store/gameStore';
import { redis, redisHelpers } from '../lib/redis';
import { REDIS_CONFIG } from '../config/redis';
import { userWallet } from '../lib/auth';
import { gameActionController } from '../controllers/gameActionController';

const props = defineProps({
  cooldownDuration: {
    type: Number,
    default: 15 * 60 * 1000 // 15 minutes in milliseconds
  },
  rewardAmount: {
    type: Number,
    default: 1000
  }
});

const emit = defineEmits(['reward']);

const gameStore = useGameStore();
const clickEffectRef = ref<HTMLElement | null>(null);
const isCooldown = computed(() => gameStore.isCooldown);
const cooldownTimeLeft = computed(() => gameStore.cooldownTimeLeft);
const isRateLimited = ref(false);
const rateLimitTimer = ref<number | null>(null);
let clickTimer: number | null = null;
const isProcessing = ref(false);

// Formatted cooldown time (MM:SS)
const formattedCooldown = computed(() => {
  const totalSeconds = Math.ceil(cooldownTimeLeft.value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Cooldown progress percentage
const cooldownProgress = computed(() => {
  if (!isCooldown.value) return 100;
  return 100 - (cooldownTimeLeft.value / props.cooldownDuration) * 100;
});

// Handle the click event
async function handleClick() {
  // Prevent rapid clicks even if button is not disabled
  if (isCooldown.value || isRateLimited.value || isProcessing.value) return;
  
  isProcessing.value = true;

  try {
    if (userWallet.value) {
      // Use the game action controller for server-side validation and processing
      const result = await gameActionController.processClick(
        userWallet.value, 
        props.cooldownDuration
      );
      
      // Handle the result
      if (!result.success) {
        // Handle error cases
        if (result.cooldownActive && result.timestamp) {
          // Update UI to reflect server-side cooldown state
          gameStore.syncCooldownWithServer(result.timestamp);
          isProcessing.value = false;
          return;
        }
        
        if (result.limited) {
          isRateLimited.value = true;
          
          // Reset rate limit status after timeout
          if (rateLimitTimer.value) clearTimeout(rateLimitTimer.value);
          rateLimitTimer.value = window.setTimeout(() => {
            isRateLimited.value = false;
          }, 3000); // Show rate limit message for 3 seconds
          
          isProcessing.value = false;
          return;
        }
        
        console.error('Click action failed:', result.message);
        isProcessing.value = false;
        return;
      }
      
      // Success - update local state
      gameStore.startCooldown(props.cooldownDuration);
      
      // Animate click effect with the reward amount
      animateClickEffect(result.reward || props.rewardAmount);
      
      // Emit reward event
      emit('reward', result.reward || props.rewardAmount);
    } else {
      // No authentication, use offline mode
      const offlineRewardAmount = await gameStore.handleReward(props.rewardAmount);
      gameStore.startCooldown(props.cooldownDuration);
      animateClickEffect(offlineRewardAmount);
      emit('reward', offlineRewardAmount);
    }
  } catch (error) {
    console.error('Error processing click:', error);
    // Fallback to regular click handling without server validation
    const fallbackRewardAmount = await gameStore.handleReward(props.rewardAmount);
    gameStore.startCooldown(props.cooldownDuration);
    animateClickEffect(fallbackRewardAmount);
    emit('reward', fallbackRewardAmount);
  } finally {
    isProcessing.value = false;
  }
}

// Animate click effect
function animateClickEffect(rewardAmount: number) {
  if (!clickEffectRef.value) return;

  // Create floating coin element
  const floatingCoin = document.createElement('div');
  floatingCoin.className = 'floating-coin';
  floatingCoin.innerText = '+' + rewardAmount;

  // Add to DOM
  clickEffectRef.value.appendChild(floatingCoin);

  // Remove after animation
  setTimeout(() => {
    if (floatingCoin.parentNode) {
      floatingCoin.parentNode.removeChild(floatingCoin);
    }
  }, 1000);
}

// Update cooldown timer
function updateCooldownTimer() {
  if (clickTimer) {
    window.clearTimeout(clickTimer);
    clickTimer = null;
  }

  if (isCooldown.value) {
    clickTimer = window.setTimeout(updateCooldownTimer, 1000);
  }
}

// Watch for cooldown changes
watch(isCooldown, (newVal) => {
  if (newVal) {
    updateCooldownTimer();
  }
});

// Cleanup timers on component unmount
onUnmounted(() => {
  if (clickTimer) window.clearTimeout(clickTimer);
  if (rateLimitTimer.value) clearTimeout(rateLimitTimer.value);
});

// Initialize with current cooldown state
onMounted(() => {
  if (isCooldown.value) {
    updateCooldownTimer();
  }
});
</script>

<style scoped>
.clicker-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.clicker-button {
  position: relative;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: linear-gradient(145deg, #ffd700, #ff9500);
  border: none;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2),
              inset 0 -5px 15px rgba(0, 0, 0, 0.1),
              inset 0 5px 15px rgba(255, 255, 255, 0.3);
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 3.5rem;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  user-select: none;
}

.clicker-button:hover:not(.on-cooldown):not(.disabled) {
  transform: scale(1.05);
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.3),
              inset 0 -5px 15px rgba(0, 0, 0, 0.1),
              inset 0 5px 15px rgba(255, 255, 255, 0.3);
}

.clicker-button:active:not(.on-cooldown):not(.disabled) {
  transform: scale(0.98);
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2),
              inset 0 -3px 10px rgba(0, 0, 0, 0.1),
              inset 0 3px 10px rgba(255, 255, 255, 0.2);
}

.clicker-button.on-cooldown {
  background: linear-gradient(145deg, #aaa, #888);
  cursor: not-allowed;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.1),
              inset 0 -3px 5px rgba(0, 0, 0, 0.05),
              inset 0 3px 5px rgba(255, 255, 255, 0.1);
}

.clicker-button.disabled {
  background: linear-gradient(145deg, #ff5555, #cc3333);
  cursor: not-allowed;
  animation: pulse 1s infinite;
}

.clicker-icon {
  font-size: 4rem;
  animation: shine 3s infinite;
}

.cooldown-text {
  font-size: 1.8rem;
  font-weight: bold;
}

.rate-limit-text {
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 0.9rem;
  font-weight: bold;
  color: white;
}

.cooldown-progress-container {
  width: 180px;
  height: 10px;
  background-color: #e5e7eb;
  border-radius: 5px;
  margin-top: 10px;
  overflow: hidden;
}

.cooldown-progress {
  height: 100%;
  background: linear-gradient(90deg, #fcd34d, #f59e0b);
  border-radius: 5px;
  transition: width 1s linear;
}

.click-effect {
  position: absolute;
  pointer-events: none;
  width: 100%;
  height: 100%;
  z-index: 10;
}

.floating-coin {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #ffd700;
  font-weight: bold;
  font-size: 1.5rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  animation: float-up 1s ease-out forwards;
}

@keyframes float-up {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -200%);
  }
}

@keyframes shine {
  0% {
    text-shadow: 0 0 5px rgba(255, 215, 0, 0.5);
  }
  50% {
    text-shadow: 0 0 20px rgba(255, 215, 0, 0.8), 0 0 30px rgba(255, 215, 0, 0.6);
  }
  100% {
    text-shadow: 0 0 5px rgba(255, 215, 0, 0.5);
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}
</style> 