<template>
  <div class="pvp-game">
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      <p>Connecting to opponent...</p>
    </div>
    
    <div v-else-if="gameError" class="error-container">
      <h2>Game Error</h2>
      <p>{{ gameError }}</p>
      <button @click="returnToLobby" class="btn btn-primary">Return to Lobby</button>
    </div>
    
    <div v-else class="game-container">
      <div class="game-header">
        <div class="player-info">
          <img :src="playerAvatar" class="player-avatar" alt="Your avatar" />
          <div class="player-details">
            <h3>{{ playerName }}</h3>
            <p class="score">Score: {{ playerScore }}</p>
          </div>
        </div>
        
        <div class="timer">{{ formatTime(timeRemaining) }}</div>
        
        <div class="opponent-info">
          <div class="player-details text-right">
            <h3>{{ opponentName }}</h3>
            <p class="score">Score: {{ opponentScore }}</p>
          </div>
          <img :src="opponentAvatar" class="player-avatar" alt="Opponent avatar" />
        </div>
      </div>
      
      <div class="game-arena" @click="handleClick">
        <div v-if="cheatingDetected" class="warning-banner">
          ⚠️ Suspicious activity detected: {{ cheatReason }}
        </div>
        
        <div class="target-area" :style="targetAreaStyle">
          <div 
            v-for="target in activeTargets" 
            :key="target.id" 
            :style="getTargetStyle(target)" 
            class="target"
            @click.stop="hitTarget(target)"
          ></div>
        </div>
      </div>
      
      <div class="game-controls">
        <button 
          @click="sendEmote('laugh')" 
          :disabled="emoteTimeout > 0" 
          class="emote-btn"
        >
          😂
        </button>
        <button 
          @click="sendEmote('sad')" 
          :disabled="emoteTimeout > 0" 
          class="emote-btn"
        >
          😢
        </button>
        <button 
          @click="sendEmote('angry')" 
          :disabled="emoteTimeout > 0" 
          class="emote-btn"
        >
          😠
        </button>
        <button 
          @click="forfeitGame" 
          class="forfeit-btn"
        >
          Forfeit
        </button>
      </div>
    </div>
    
    <!-- Game End Modal -->
    <div v-if="gameEnded" class="modal">
      <div class="modal-content">
        <h2>Game Over</h2>
        <div class="result">
          <h3 :class="{ 'win': isWinner, 'lose': !isWinner && !isDraw, 'draw': isDraw }">
            {{ resultMessage }}
          </h3>
        </div>
        
        <div class="stats">
          <div class="stat-item">
            <span>Your Score</span>
            <span>{{ playerScore }}</span>
          </div>
          <div class="stat-item">
            <span>Opponent Score</span>
            <span>{{ opponentScore }}</span>
          </div>
          <div class="stat-item">
            <span>XP Earned</span>
            <span>{{ xpEarned }}</span>
          </div>
          <div class="stat-item">
            <span>Coins Earned</span>
            <span>{{ coinsEarned }}</span>
          </div>
        </div>
        
        <div class="actions">
          <button @click="playAgain" class="btn btn-primary">Play Again</button>
          <button @click="returnToLobby" class="btn btn-secondary">Back to Lobby</button>
        </div>
      </div>
    </div>
    
    <!-- Opponent Emote Display -->
    <div v-if="showOpponentEmote" class="opponent-emote">
      {{ opponentEmote }}
    </div>
    
    <!-- Forfeit Confirmation Modal -->
    <div v-if="showForfeitConfirm" class="modal">
      <div class="modal-content">
        <h3>Forfeit Match?</h3>
        <p>You will lose this match and your opponent will be declared the winner.</p>
        <div class="actions">
          <button @click="confirmForfeit" class="btn btn-danger">Yes, Forfeit</button>
          <button @click="cancelForfeit" class="btn btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { recordClick, resetAntiCheatState, validateMatchResult, generateValidationToken } from '../utils/antiCheat';
import type { CheatDetectionResult } from '../utils/antiCheat';

// Router
const router = useRouter();

// Props
// In a real app, these would come from route params or a game service
const matchId = ref('match_' + Math.random().toString(36).substr(2, 9));
const gameMode = ref('normal');
const difficulty = ref('medium');

// Game state
const loading = ref(true);
const gameError = ref('');
const timeRemaining = ref(60); // 60 seconds game
const playerScore = ref(0);
const opponentScore = ref(0);
const gameEnded = ref(false);
const isWinner = ref(false);
const isDraw = ref(false);
const xpEarned = ref(0);
const coinsEarned = ref(0);
const activeTargets = ref<Array<{id: number, x: number, y: number, size: number, value: number}>>([]);
const nextTargetId = ref(1);
const showForfeitConfirm = ref(false);

// Player info (in a real app, this would come from a user service)
const playerName = ref('Player');
const playerAvatar = ref('/avatars/default.png');
const opponentName = ref('Opponent');
const opponentAvatar = ref('/avatars/opponent.png');

// Emotes
const emoteTimeout = ref(0);
const showOpponentEmote = ref(false);
const opponentEmote = ref('');

// Anti-cheat related
const cheatingDetected = ref(false);
const cheatReason = ref('');
const cheatWarningTimeout = ref<number | null>(null);

// Game dimensions
const targetAreaWidth = ref(800);
const targetAreaHeight = ref(500);

// Target area style
const targetAreaStyle = computed(() => ({
  width: `${targetAreaWidth.value}px`,
  height: `${targetAreaHeight.value}px`
}));

// Game timers
let gameTimer: number | null = null;
let targetSpawnTimer: number | null = null;

// Result message
const resultMessage = computed(() => {
  if (isDraw.value) return "It's a draw!";
  return isWinner.value ? "You win!" : "You lose!";
});

// Functions
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function startGame(): void {
  loading.value = false;
  resetAntiCheatState();
  
  // Start game timer
  gameTimer = window.setInterval(() => {
    timeRemaining.value--;
    
    if (timeRemaining.value <= 0) {
      endGame();
    }
    
    // Simulate opponent scoring randomly
    if (Math.random() < 0.1) {
      opponentScore.value += Math.floor(Math.random() * 5) + 1;
    }
  }, 1000);
  
  // Start spawning targets
  targetSpawnTimer = window.setInterval(spawnTarget, 1000);
  
  // Spawn initial targets
  for (let i = 0; i < 3; i++) {
    spawnTarget();
  }
}

function spawnTarget(): void {
  const size = Math.floor(Math.random() * 30) + 30; // 30-60px
  const x = Math.floor(Math.random() * (targetAreaWidth.value - size));
  const y = Math.floor(Math.random() * (targetAreaHeight.value - size));
  const value = Math.floor(11 - size / 10); // Smaller targets worth more points
  
  activeTargets.value.push({
    id: nextTargetId.value++,
    x,
    y,
    size,
    value
  });
  
  // Remove target after a random time if not clicked
  setTimeout(() => {
    activeTargets.value = activeTargets.value.filter(t => t.id !== nextTargetId.value - 1);
  }, Math.random() * 2000 + 1000);
}

function getTargetStyle(target: {x: number, y: number, size: number}): Record<string, string> {
  return {
    left: `${target.x}px`,
    top: `${target.y}px`,
    width: `${target.size}px`,
    height: `${target.size}px`,
    backgroundColor: `hsl(${360 - target.size * 6}, 80%, 50%)`
  };
}

function handleClick(event: MouseEvent): void {
  // Record the click for anti-cheat system
  const position = { x: event.offsetX, y: event.offsetY };
  const result = recordClick(position);
  
  // Show warning if cheating detected
  if (!result.isValid) {
    showCheatWarning(result);
  }
}

function showCheatWarning(result: CheatDetectionResult): void {
  cheatingDetected.value = true;
  cheatReason.value = result.reason || 'Unknown issue';
  
  // Clear existing timeout if any
  if (cheatWarningTimeout.value) {
    clearTimeout(cheatWarningTimeout.value);
  }
  
  // Hide warning after 3 seconds
  cheatWarningTimeout.value = window.setTimeout(() => {
    cheatingDetected.value = false;
    cheatWarningTimeout.value = null;
  }, 3000);
}

function hitTarget(target: {id: number, value: number}): void {
  // Record click for anti-cheat
  const result = recordClick();
  
  if (!result.isValid) {
    showCheatWarning(result);
    return; // Don't allow point if cheating detected
  }
  
  // Award points
  playerScore.value += target.value;
  
  // Remove hit target
  activeTargets.value = activeTargets.value.filter(t => t.id !== target.id);
  
  // Spawn new target to replace the hit one
  setTimeout(spawnTarget, Math.random() * 500);
}

function endGame(): void {
  // Clear timers
  if (gameTimer) clearInterval(gameTimer);
  if (targetSpawnTimer) clearInterval(targetSpawnTimer);
  
  // Validate final score
  const validationResult = validateMatchResult(playerScore.value, 60 - timeRemaining.value);
  
  if (!validationResult.isValid) {
    // Handle invalid score (cheating detected)
    gameError.value = `Game ended: ${validationResult.reason}`;
    playerScore.value = 0; // Reset player score
    return;
  }
  
  // Generate validation token for the server
  const token = generateValidationToken(matchId.value, playerScore.value);
  
  // Determine winner
  isWinner.value = playerScore.value > opponentScore.value;
  isDraw.value = playerScore.value === opponentScore.value;
  
  // Calculate rewards
  calculateRewards();
  
  // Show game over screen
  gameEnded.value = true;
  
  // In a real app, you would send the result to the server
  const gameResult = {
    matchId: matchId.value,
    playerScore: playerScore.value,
    opponentScore: opponentScore.value,
    isWinner: isWinner.value,
    isDraw: isDraw.value,
    gameMode: gameMode.value,
    gameDuration: 60 - timeRemaining.value,
    validationToken: token
  };
  
  console.log('Game result:', gameResult);
  // In production: submitGameResult(gameResult);
}

function calculateRewards(): void {
  // Base rewards
  let xp = 50;
  let coins = 10;
  
  // Bonus for winning
  if (isWinner.value) {
    xp += 100;
    coins += 25;
  } else if (isDraw.value) {
    xp += 25;
    coins += 5;
  }
  
  // Bonus based on score
  xp += playerScore.value;
  coins += Math.floor(playerScore.value / 10);
  
  xpEarned.value = xp;
  coinsEarned.value = coins;
}

function sendEmote(type: string): void {
  if (emoteTimeout.value > 0) return;
  
  let emote = '';
  switch (type) {
    case 'laugh': emote = '😂'; break;
    case 'sad': emote = '😢'; break;
    case 'angry': emote = '😠'; break;
  }
  
  // In a real app, this would send to the opponent via websocket/etc
  console.log(`Emote sent: ${emote}`);
  
  // Rate limit emotes
  emoteTimeout.value = 5;
  const interval = setInterval(() => {
    emoteTimeout.value--;
    if (emoteTimeout.value <= 0) {
      clearInterval(interval);
    }
  }, 1000);
}

function receiveEmote(emote: string): void {
  opponentEmote.value = emote;
  showOpponentEmote.value = true;
  
  setTimeout(() => {
    showOpponentEmote.value = false;
  }, 3000);
}

function forfeitGame(): void {
  showForfeitConfirm.value = true;
}

function confirmForfeit(): void {
  showForfeitConfirm.value = false;
  
  // Set score to ensure loss
  opponentScore.value = playerScore.value + 10;
  endGame();
}

function cancelForfeit(): void {
  showForfeitConfirm.value = false;
}

function playAgain(): void {
  // Reset game state
  playerScore.value = 0;
  opponentScore.value = 0;
  timeRemaining.value = 60;
  gameEnded.value = false;
  activeTargets.value = [];
  resetAntiCheatState();
  
  // Generate a new match ID
  matchId.value = 'match_' + Math.random().toString(36).substr(2, 9);
  
  // Start new game
  startGame();
}

function returnToLobby(): void {
  router.push('/lobby');
}

// Lifecycle hooks
onMounted(() => {
  // Simulate connecting to game server and finding opponent
  setTimeout(() => {
    startGame();
  }, 2000);
  
  // Simulate receiving opponent emotes occasionally
  setInterval(() => {
    if (Math.random() < 0.1 && !gameEnded.value) {
      const emotes = ['😂', '😢', '😠', '👍', '👎', '😮'];
      receiveEmote(emotes[Math.floor(Math.random() * emotes.length)]);
    }
  }, 10000);
  
  // Adjust target area dimensions to container
  const resizeTargetArea = () => {
    if (window.innerWidth < 840) {
      targetAreaWidth.value = window.innerWidth - 40;
    } else {
      targetAreaWidth.value = 800;
    }
  };
  
  resizeTargetArea();
  window.addEventListener('resize', resizeTargetArea);
});

onBeforeUnmount(() => {
  // Clean up timers
  if (gameTimer) clearInterval(gameTimer);
  if (targetSpawnTimer) clearInterval(targetSpawnTimer);
  if (cheatWarningTimeout.value) clearTimeout(cheatWarningTimeout.value);
  
  window.removeEventListener('resize', () => {});
});
</script>

<style scoped>
.pvp-game {
  position: relative;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  font-family: 'Arial', sans-serif;
}

.loading-overlay {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 600px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid rgba(0, 0, 0, 0.1);
  border-top-color: #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-container {
  text-align: center;
  padding: 40px;
  background: #ffdddd;
  border-radius: 10px;
  color: #d32f2f;
}

.game-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: #f0f0f0;
  border-radius: 10px;
}

.player-info, .opponent-info {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 40%;
}

.opponent-info {
  flex-direction: row-reverse;
}

.player-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #3498db;
}

.player-details {
  display: flex;
  flex-direction: column;
}

.text-right {
  text-align: right;
}

.timer {
  font-size: 28px;
  font-weight: bold;
  padding: 0 10px;
  background: #3498db;
  color: white;
  border-radius: 5px;
}

.game-arena {
  position: relative;
  margin: 0 auto;
  border: 2px solid #ccc;
  border-radius: 10px;
  overflow: hidden;
  background: #f9f9f9;
}

.target-area {
  position: relative;
  margin: 0 auto;
  height: 500px;
}

.target {
  position: absolute;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  transition: transform 0.1s;
}

.target:hover {
  transform: scale(1.05);
}

.game-controls {
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 10px;
  background: #f0f0f0;
  border-radius: 10px;
}

.emote-btn {
  font-size: 24px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: none;
  background: white;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.emote-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.forfeit-btn {
  padding: 10px 20px;
  background: #ff5252;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  margin-left: 20px;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 10px;
  max-width: 500px;
  width: 90%;
}

.result {
  text-align: center;
  margin: 20px 0;
}

.win {
  color: #27ae60;
  font-size: 28px;
}

.lose {
  color: #e74c3c;
  font-size: 28px;
}

.draw {
  color: #f39c12;
  font-size: 28px;
}

.stats {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.stat-item:last-child {
  border-bottom: none;
}

.actions {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-danger {
  background: #e74c3c;
  color: white;
}

.opponent-emote {
  position: fixed;
  top: 20%;
  right: 5%;
  font-size: 50px;
  animation: fadeInOut 3s forwards;
  z-index: 100;
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: translateY(-20px); }
  20% { opacity: 1; transform: translateY(0); }
  80% { opacity: 1; }
  100% { opacity: 0; }
}

.warning-banner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(231, 76, 60, 0.9);
  color: white;
  padding: 10px;
  text-align: center;
  z-index: 10;
  animation: slideDown 0.3s forwards;
}

@keyframes slideDown {
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
}

@media (max-width: 768px) {
  .game-header {
    flex-direction: column;
    gap: 10px;
  }
  
  .player-info, .opponent-info {
    width: 100%;
  }
  
  .timer {
    margin: 10px 0;
  }
  
  .target-area {
    height: 400px;
  }
}
</style> 