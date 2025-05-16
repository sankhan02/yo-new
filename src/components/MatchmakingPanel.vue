<template>
  <div class="matchmaking-panel">
    <h2 class="panel-title">PvP Battles</h2>
    
    <!-- Match Invitations Section -->
    <!-- <MatchInvitationPanel /> -->
    
    <div class="modes-container">
      <div class="mode-card">
        <div class="mode-header">
          <h3 class="mode-title">1v1 Click Wars</h3>
          <span class="mode-badge">PvP</span>
        </div>
        
        <p class="mode-description">
          Battle head-to-head against another player! The faster clicker wins.
          Winner takes 70% of the total bet.
        </p>
        
        <div class="mode-details">
          <div class="detail-item">
            <span class="detail-label">Bet Range:</span>
            <span class="detail-value">10 - 10,000 coins</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Winner Gets:</span>
            <span class="detail-value">70% of pot</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Duration:</span>
            <span class="detail-value">30 seconds</span>
          </div>
        </div>
        
        <div class="bet-controls">
          <label for="bet-amount">Bet Amount:</label>
          <div class="bet-input-group">
            <button 
              class="bet-adjust-btn" 
              @click="decreaseBet" 
              :disabled="selectedBet <= 10"
            >-</button>
            <input 
              id="bet-amount" 
              v-model="selectedBet" 
              type="number" 
              min="10" 
              max="10000" 
              step="10"
            />
            <button 
              class="bet-adjust-btn" 
              @click="increaseBet" 
              :disabled="selectedBet >= 10000"
            >+</button>
          </div>
        </div>
        
        <button 
          class="start-button"
          :disabled="!canStartMatch || isMatchmaking"
          @click="startMatch(selectedBet)"
        >
          <span v-if="isMatchmaking">Finding Opponent...</span>
          <span v-else>Start 1v1 Match</span>
        </button>
      </div>
    </div>
    
    <div v-if="isMatchmaking" class="matchmaking-overlay">
      <div class="matchmaking-modal">
        <h3>Finding Opponent...</h3>
        <div class="spinner"></div>
        <p>Searching for a worthy opponent with similar skill level</p>
        <p class="info-text">Once found, they'll have 30 seconds to accept your challenge</p>
        <button @click="cancelMatchmaking" class="cancel-button">Cancel</button>
      </div>
    </div>
    
    <div v-if="activeMatch" class="match-overlay">
      <div class="match-modal">
        <h3>1v1 Click Wars</h3>
        <div class="match-header">
          <div class="player-info">
            <span class="player-name">You</span>
            <span class="player-score">{{ playerScore }}</span>
          </div>
          <div class="vs">VS</div>
          <div class="player-info">
            <span class="player-name">Opponent</span>
            <span class="player-score">{{ opponentScore }}</span>
          </div>
        </div>
        
        <div class="timer">{{ matchTimeLeft }}</div>
        
        <button @click="handleClick" class="click-button">
          CLICK!
        </button>
        
        <div class="match-footer">
          <p>Bet Amount: {{ activeMatch && activeMatch.matchData?.bet ? activeMatch.matchData.bet : 0 }} coins</p>
          <p>Potential Winnings: {{ activeMatch ? multiplayerStore.calculateWinnings(activeMatch) : 0 }} coins</p>
        </div>
      </div>
    </div>
    
    <div v-if="matchResult" class="result-overlay">
      <div class="result-modal">
        <h3 v-if="matchResult.isWinner" class="win-title">Victory!</h3>
        <h3 v-else class="loss-title">Defeat</h3>
        
        <div class="result-icon">
          <span v-if="matchResult.isWinner">🏆</span>
          <span v-else>😢</span>
        </div>
        
        <div class="result-message">
          <p v-if="matchResult.isWinner">
            Congratulations! You've won {{ formatNumber(matchResult.winnings) }} coins!
          </p>
          <p v-else>
            Better luck next time. Your opponent was faster this time.
          </p>
        </div>
        
        <button @click="closeResults" class="close-button">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useMultiplayerStore } from '@/store/multiplayerStore';
import { useGameStore } from '@/store/gameStore';
// import type { Match } from '@/store/multiplayerStore';
// import MatchInvitationPanel from './MatchInvitationPanel.vue';

const multiplayerStore = useMultiplayerStore();
const gameStore = useGameStore();

// State
const selectedBet = ref(10);
const playerScore = ref(0);
const opponentScore = ref(0);
const matchTimeLeft = ref(30); // 30 second match
const matchInterval = ref<number | null>(null);
const matchResult = ref<{ isWinner: boolean; winnings: number } | null>(null);

// Computed
const isMatchmaking = computed(() => multiplayerStore.isMatchmaking);
const activeMatch = computed(() => multiplayerStore.currentMatch);
const canStartMatch = computed(() => {
  return multiplayerStore.canStartMatchmaking && 
         selectedBet.value >= 10 && 
         selectedBet.value <= 10000 &&
         gameStore.coins >= selectedBet.value;
});

// Watch for match acceptance
watch(activeMatch, (newMatch, oldMatch) => {
  if (newMatch && !oldMatch) {
    // A new match has been created
    startMatchTimer();
  }
});

// Methods
function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toString();
}

function decreaseBet() {
  if (selectedBet.value <= 10) return;
  selectedBet.value -= 10;
}

function increaseBet() {
  if (selectedBet.value >= 10000) return;
  selectedBet.value += 10;
}

async function startMatch(bet: number) {
  await multiplayerStore.startMatchmaking(bet);
}

function cancelMatchmaking() {
  multiplayerStore.cancelMatchmaking();
}

function handleClick() {
  if (!activeMatch.value) return;
  
  playerScore.value += 1;
  
  // Simulate opponent clicking (random chance)
  if (Math.random() > 0.7) {
    opponentScore.value += 1;
  }
}

function startMatchTimer() {
  playerScore.value = 0;
  opponentScore.value = 0;
  matchTimeLeft.value = 30;
  
  matchInterval.value = window.setInterval(() => {
    matchTimeLeft.value -= 1;
    
    if (matchTimeLeft.value <= 0) {
      endMatch();
    }
  }, 1000);
}

async function endMatch() {
  if (matchInterval.value) {
    clearInterval(matchInterval.value);
    matchInterval.value = null;
  }
  // Determine winner
  const winner = playerScore.value > opponentScore.value 
    ? 'You' 
    : 'Opponent';
  // Set match result locally
  matchResult.value = {
    isWinner: winner === 'You',
    winnings: winner === 'You' ? selectedBet.value * 2 * 0.7 : 0
  };
}

function closeResults() {
  matchResult.value = null;
}

// Lifecycle
onMounted(async () => {
  await multiplayerStore.init();
  await multiplayerStore.fetchOnlinePlayers();
});

onUnmounted(() => {
  if (matchInterval.value) {
    clearInterval(matchInterval.value);
  }
});
</script>

<style scoped>
.matchmaking-panel {
  background-color: #fff;
  border-radius: 0.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  position: relative;
  overflow: hidden;
}

.panel-title {
  margin-top: 0;
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
  text-align: center;
  color: #333;
}

.modes-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.mode-card {
  background-color: #f9fafb;
  border-radius: 0.5rem;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.mode-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.mode-title {
  margin: 0;
  font-size: 1.25rem;
  color: #111827;
}

.mode-badge {
  background-color: #3b82f6;
  color: white;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
}

.mode-description {
  font-size: 0.875rem;
  color: #4b5563;
  margin-bottom: 1rem;
}

.mode-details {
  margin-bottom: 1.25rem;
  background-color: #f3f4f6;
  border-radius: 0.375rem;
  padding: 0.75rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  padding: 0.25rem 0;
}

.detail-label {
  color: #6b7280;
}

.detail-value {
  font-weight: 500;
  color: #111827;
}

.bet-controls {
  margin-bottom: 1rem;
}

.bet-controls label {
  display: block;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.bet-input-group {
  display: flex;
  align-items: center;
}

.bet-adjust-btn {
  background-color: #e5e7eb;
  border: none;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  cursor: pointer;
}

.bet-adjust-btn:hover:not(:disabled) {
  background-color: #d1d5db;
}

.bet-adjust-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bet-input-group input {
  flex: 1;
  height: 2rem;
  text-align: center;
  border: 1px solid #e5e7eb;
  margin: 0 0.25rem;
}

.start-button {
  background-color: #10b981;
  color: white;
  border: none;
  padding: 0.75rem;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.start-button:hover:not(:disabled) {
  background-color: #059669;
}

.start-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.start-button.disabled {
  background-color: #9ca3af;
}

.team-info {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background-color: #fef3c7;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  text-align: center;
}

/* Matchmaking overlay and modal */
.matchmaking-overlay, .match-overlay, .result-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
}

.matchmaking-modal, .match-modal, .result-modal {
  background-color: white;
  border-radius: 0.5rem;
  padding: 2rem;
  max-width: 400px;
  width: 90%;
  text-align: center;
}

.info-text {
  color: #6b7280;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  margin: 1rem auto;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.cancel-button, .close-button {
  background-color: #ef4444;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  margin-top: 1rem;
  cursor: pointer;
}

.cancel-button:hover, .close-button:hover {
  background-color: #dc2626;
}

/* Match UI */
.match-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.player-info {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.player-name {
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.player-score {
  font-size: 2rem;
  font-weight: 700;
}

.vs {
  font-size: 1.25rem;
  font-weight: 700;
  color: #6b7280;
}

.timer {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  color: #ef4444;
}

.click-button {
  background-color: #3b82f6;
  color: white;
  border: none;
  padding: 1.5rem;
  border-radius: 9999px;
  font-size: 1.25rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.1s;
  margin-bottom: 1rem;
}

.click-button:active {
  transform: scale(0.95);
}

.match-footer {
  font-size: 0.875rem;
  color: #6b7280;
}

/* Result UI */
.win-title {
  color: #10b981;
}

.loss-title {
  color: #ef4444;
}

.result-icon {
  font-size: 4rem;
  margin: 1rem 0;
}
</style> 