<template>
  <div class="app-container">
    <!-- Status Banner -->
    <div class="status-banner">
      <span :class="['status-dot', supabaseStatus ? 'ok' : 'fail']"></span>
      Supabase: <b>{{ supabaseStatus ? 'Online' : 'Offline' }}</b>
      &nbsp;|&nbsp;
      <span :class="['status-dot', redisStatus ? 'ok' : 'fail']"></span>
      Redis: <b>{{ redisStatus ? 'Online' : 'Offline' }}</b>
    </div>
    <header class="app-header">
      <div class="logo-container">
        <img src="/reown.svg" alt="Reown" width="80" height="80" />
        <h1 class="app-title">YO MAMA</h1>
      </div>
      
      <nav class="app-nav">
        <button 
          class="nav-btn" 
          :class="{ active: currentPage === 'game' }" 
          @click="currentPage = 'game'"
        >
          <span class="icon">🎮</span> Game
        </button>
        <button 
          class="nav-btn" 
          :class="{ active: currentPage === 'staking' }" 
          @click="currentPage = 'staking'"
        >
          <span class="icon">💰</span> Staking
        </button>
        <button 
          class="nav-btn" 
          :class="{ active: currentPage === 'referral' }" 
          @click="currentPage = 'referral'"
        >
          <span class="icon">🔗</span> Referral
        </button>
        <button 
          v-if="isAdmin"
          class="nav-btn" 
          :class="{ active: currentPage === 'admin' }" 
          @click="currentPage = 'admin'"
        >
          <span class="icon">⚙️</span> Admin
        </button>
      </nav>
      
      <WalletConnection class="wallet-connection" />
      
    </header>
    <main class="app-main">
      <!-- Game Page -->
      <section v-if="currentPage === 'game'" class="game-section">
        <!-- Game Hub Layout -->
        <div class="game-hub">
          <!-- Core Stats -->
          <div class="core-stats">
            <div class="stats-card">
              <div class="stats-icon">🪙</div>
              <div class="stats-value">{{ formatNumber(coins) }}</div>
              <div class="stats-label">Coins</div>
            </div>
            
            <div class="stats-card">
              <div class="stats-icon">👆</div>
              <div class="stats-value">{{ formatNumber(totalClicks) }}</div>
              <div class="stats-label">Clicks</div>
            </div>
            
            <div class="stats-card">
              <div class="stats-icon">🔥</div>
              <div class="stats-value">{{ streakDays }}</div>
              <div class="stats-label">Streak Days</div>
            </div>
            
            <div class="stats-card">
              <div class="stats-icon">✨</div>
              <div class="stats-value">{{ streakMultiplier }}x</div>
              <div class="stats-label">Multiplier</div>
            </div>
          </div>
          
          <!-- Center Clicker Area -->
          <div class="clicker-center">
            <div class="clicker-container" :class="{ 'locked': !isAuthenticated }">
              <ClickerButton 
                v-if="isAuthenticated"
                :cooldownDuration="60000" 
                :rewardAmount="1000" 
                @reward="handleReward"
                class="main-clicker"
              />
              <div v-else class="auth-required-overlay">
                <div class="auth-lock-icon">🔒</div>
                <p class="auth-message">Connect wallet to play</p>
                <WalletConnection class="auth-connect-btn" />
              </div>
              <div class="clicker-aura" :class="{ 'disabled': !isAuthenticated }"></div>
            </div>
            <div class="clicker-instructions">
              <p>Click for <span class="highlight">1,000 coins!</span> (15min cooldown)</p>
            </div>
          </div>
          
          <!-- Feature Cards - Orbital Layout -->
          <div class="orbital-cards">
            <!-- Rewards Card -->
            <div 
              class="feature-card" 
              :class="{ 
                'expanded': expandedCard === 'rewards', 
                'notification': hasUnclaimedRewards,
                'locked': !isAuthenticated 
              }"
              @click="isAuthenticated ? toggleCard('rewards') : null"
            >
              <div class="card-preview">
                <div class="card-icon">🎁</div>
                <div class="card-title">Rewards</div>
                <div v-if="hasUnclaimedRewards && isAuthenticated" class="notification-badge">!</div>
                <div v-if="!isAuthenticated" class="lock-badge">🔒</div>
              </div>
              
              <div class="card-expanded" v-if="isAuthenticated">
                <div class="card-header">
                  <h3>Streak Rewards</h3>
                  <button class="close-btn" @click.stop="closeCard">×</button>
                </div>
                <StreakRewards />
              </div>
            </div>
            
            <!-- Power-ups Card -->
            <div 
              class="feature-card"
              :class="{ 
                'expanded': expandedCard === 'powerups',
                'locked': !isAuthenticated 
              }"
              @click="isAuthenticated ? toggleCard('powerups') : null"
            >
              <div class="card-preview">
                <div class="card-icon">⚡</div>
                <div class="card-title">Power-ups</div>
                <div v-if="!isAuthenticated" class="lock-badge">🔒</div>
              </div>
              
              <div class="card-expanded" v-if="isAuthenticated">
                <div class="card-header">
                  <h3>Power-ups</h3>
                  <button class="close-btn" @click.stop="closeCard">×</button>
                </div>
                <PowerupsDisplay />
              </div>
            </div>
            
            <!-- Stats Card -->
            <div 
              class="feature-card"
              :class="{ 
                'expanded': expandedCard === 'stats',
                'locked': !isAuthenticated 
              }"
              @click="isAuthenticated ? toggleCard('stats') : null"
            >
              <div class="card-preview">
                <div class="card-icon">📊</div>
                <div class="card-title">Stats</div>
                <div v-if="!isAuthenticated" class="lock-badge">🔒</div>
              </div>
              
              <div class="card-expanded" v-if="isAuthenticated">
                <div class="card-header">
                  <h3>Statistics</h3>
                  <button class="close-btn" @click.stop="closeCard">×</button>
                </div>
                <StatisticsPanel />
              </div>
            </div>
          </div>
          
          <!-- Streak Display -->
          <StreakDisplay v-if="isAuthenticated" class="streak-display" />
          
          <!-- Authentication Overlay if not authenticated -->
          <div v-if="!isAuthenticated" class="game-auth-overlay">
            <div class="auth-message-container">
              <h2 class="auth-title">Connect to Play & Earn</h2>
              <p class="auth-description">Connect your wallet to start earning $MAMA tokens!</p>
              <WalletConnection class="auth-wallet-btn" />
            </div>
          </div>
        </div>
      </section>
      
      <!-- Staking Page -->
      <section v-else-if="currentPage === 'staking'" class="staking-section">
        <div class="staking-container">
          <div class="staking-header">
            <h2>MAMA Token Staking</h2>
            <p>Stake your MAMA tokens to earn passive rewards</p>
          </div>
          
          <div class="staking-info">
            <div class="info-card">
              <h3>How Staking Works</h3>
              <p>Lock your MAMA tokens for a specified period to earn rewards based on the APR. The longer you stake, the higher your potential rewards.</p>
            </div>
            
            <div class="info-card">
              <h3>Benefits</h3>
              <ul>
                <li>Earn passive income from your MAMA tokens</li>
                <li>Higher APR for longer staking periods</li>
                <li>Rewards are automatically calculated</li>
              </ul>
            </div>
            
            <div class="info-card">
              <h3>Tips</h3>
              <p>You can claim rewards at any time, but tokens must remain staked for the full duration to avoid penalties.</p>
            </div>
            
            <div class="info-card audit-card">
              <h3>Audit Status</h3>
              <p>The staking contract is currently undergoing a security audit. Once completed, staking functionality will be enabled for all users.</p>
              <div class="audit-progress">
                <div class="progress-label">Audit Progress:</div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: 35%"></div>
                </div>
                <div class="progress-text">35% Complete</div>
              </div>
              <p class="estimated-completion">Estimated completion: Q2 2025</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Referral Page -->
      <section v-else-if="currentPage === 'referral'" class="referral-section">
        <ReferralView />
      </section>
      
      <!-- Admin Dashboard -->
      <section v-else-if="currentPage === 'admin'" class="admin-section">
        <AdminDashboard />
      </section>
    </main>
    
    <footer class="app-footer">
      <p>© 2025 YO MAMA | Powered by MAMA Token</p>
    </footer>
    
    <!-- Add Offline Earnings Modal -->
    <OfflineEarningsModal 
      v-if="showOfflineEarnings" 
      :earnedAmount="offlineEarnings" 
      :timeAway="timeAway" 
      @close="hideOfflineEarnings" 
    />
  </div>
</template>

<script lang="ts">
import { ref, onMounted, computed, onUnmounted, onBeforeUnmount, defineComponent, watchEffect } from 'vue';
import { useAppKitAccount, useWalletInfo } from '@reown/appkit/vue';
import type { SIWXSession } from '@reown/appkit/vue';

import WalletConnection from "./components/WalletConnection.vue"
import InfoList from "./components/InfoList.vue"
import ClickerButton from "./components/ClickerButton.vue"
import StreakDisplay from "./components/StreakDisplay.vue"
import PowerupsDisplay from "./components/PowerupsDisplay.vue"
import OfflineEarningsModal from "./components/OfflineEarningsModal.vue"
import StatisticsPanel from "./components/StatisticsPanel.vue"
import StreakRewards from "./components/StreakRewards.vue"
import LeaderboardPanel from './components/LeaderboardPanel.vue';
import ReferralView from './views/ReferralView.vue';
import AdminDashboard from './pages/admin/AdminDashboard.vue';

import { isAuthenticated, checkAuth, userWallet } from './lib/auth'
import { useGameStore } from './store/gameStore'
import { useUserStore } from './store/userStore'
import { REDIS_CONFIG } from '@/config/redis';
import { supabase } from '@/storage/config/supabase';
import { redis, redisHelpers } from '@/lib/redis';
import { useSupabaseStore } from './store/supabaseStore';
import { useMultiplayerStore } from './store/multiplayerStore';
import { checkSupabaseConnection } from './storage/config/supabase';
import { checkRedisConnection } from './lib/redis';
import { siwxConfig } from './config/siwx';
import { projectId } from './config';

// Format numbers with commas
const formatNumber = (num: number) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Note: AppKit is now imported from config/appkit.ts
// No need to initialize it here

// Utility to fetch user_id by wallet_address
async function getUserIdByWallet(walletAddress: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('users')
    .select('user_id')
    .eq('wallet_address', walletAddress)
    .single();
  if (error) {
    console.error('Error fetching user_id by wallet_address:', error);
    return null;
  }
  return data?.user_id ?? null;
}

function getSIWXSession() {
  // Adjust the key if your AppKit config uses a different one
  const sessionStr = localStorage.getItem('siwx:solana');
  if (!sessionStr) return null;
  try {
    return JSON.parse(sessionStr);
  } catch {
    return null;
  }
}

export default defineComponent({
  name: "App",
  components: {
    WalletConnection,
    InfoList,
    StatisticsPanel,
    ClickerButton,
    StreakDisplay,
    PowerupsDisplay,
    OfflineEarningsModal,
    StreakRewards,
    ReferralView,
    AdminDashboard
  },
  setup() {
    // Get the game store
    const gameStore = useGameStore();
    const userStore = useUserStore();
    
    // Computed properties to access game store state
    const coins = computed(() => gameStore.coins).value;
    const totalClicks = computed(() => gameStore.totalClicks).value;
    const streakDays = computed(() => gameStore.streakDays).value;
    const streakMultiplier = computed(() => gameStore.streakMultiplier).value;
    const hasUnclaimedRewards = computed(() => gameStore.hasUnclaimedRewards).value;
    
    // Page navigation state
    const currentPage = ref('game');
    
    // Card management
    const expandedCard = ref<string | null>(null);
    
    // Toggle a card's expanded state
    const toggleCard = (cardId: string) => {
      if (expandedCard.value === cardId) {
        expandedCard.value = null;
      } else {
        expandedCard.value = cardId;
      }
    };
    
    // Close the expanded card
    const closeCard = (e: Event) => {
      e.stopPropagation();
      expandedCard.value = null;
    };
    
    // Handle reward from clicker button (now just a pass-through)
    const handleReward = (amount: number) => {
      // The actual reward handling is done in the ClickerButton component
      // This is just here to satisfy the event handler
      console.log(`Reward received: ${amount} coins`);
    };
    
    // Offline earnings modal state
    const showOfflineEarnings = ref(false);
    const offlineEarnings = ref(0);
    const timeAway = ref(0);
    
    // Hide the offline earnings modal
    const hideOfflineEarnings = () => {
      showOfflineEarnings.value = false;
    };
    
    // Status banner state
    const supabaseStatus = ref<boolean>(true);
    const redisStatus = ref<boolean>(true);

    // Track the current user's integer user_id
    const currentUserId = ref<number | null>(null);

    const accountInfo = useAppKitAccount();
    const { walletInfo } = useWalletInfo();
    const chainId = 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z';
    const siwxSessions = ref<SIWXSession[]>([]);
    const latestSignature = computed(() =>
      siwxSessions.value.length ? siwxSessions.value.at(-1)?.signature : undefined
    );
    watchEffect(async () => {
      if (accountInfo.value.address) {
        siwxSessions.value = await siwxConfig.getSessions(chainId, accountInfo.value.address);
      } else {
        siwxSessions.value = [];
      }
    });

    async function updateStatus() {
      const [supabase, redis] = await Promise.all([
        checkSupabaseConnection(),
        checkRedisConnection(),
      ]);
      supabaseStatus.value = supabase;
      redisStatus.value = redis;
    }

    // Check if user is admin
    const isAdmin = computed(() => userStore.isAdmin);

    onMounted(async () => {
      // Check authentication state first
      await checkAuth();
      
      // Fetch and cache user_id by wallet_address
      if (userWallet.value) {
        currentUserId.value = await getUserIdByWallet(userWallet.value);
        
        // Fetch user profile to check admin status
        await userStore.fetchUserProfile();
        
        // Verify admin status if user is authenticated
        if (isAuthenticated.value) {
          await userStore.verifyAdminStatus();
        }
      }
      
      // Initialize stores after auth check
      await gameStore.init();
      
      // Check for offline earnings
      if (gameStore.offlineEarnings.lastTime) {
        const lastTime = gameStore.offlineEarnings.lastTime;
        const now = Date.now();
        const timeDiff = now - lastTime;
        
        // Only show if user was away for more than 5 minutes
        if (timeDiff > 5 * 60 * 1000) {
          timeAway.value = timeDiff;
          
          // Calculate earnings (should match gameStore.calculateOfflineEarnings logic)
          const baseRate = 100; // coins per hour
          const cappedTimeDiff = Math.min(timeDiff, gameStore.offlineEarnings.maxDuration);
          const hoursOffline = cappedTimeDiff / (1000 * 60 * 60);
          offlineEarnings.value = Math.floor(baseRate * hoursOffline * gameStore.offlineEarnings.rate);
          
          if (offlineEarnings.value > 0) {
            showOfflineEarnings.value = true;
          }
        }
      }
      
      // Set initial expandedCard based on state
      if (hasUnclaimedRewards) {
        expandedCard.value = 'rewards';
      }
      
      await updateStatus();
    });
    
    // Clean up on component unmount
    onUnmounted(() => {
    });
    
    return {
      isAuthenticated,
      isAdmin,
      coins,
      totalClicks,
      streakDays,
      streakMultiplier,
      hasUnclaimedRewards,
      formatNumber,
      handleReward,
      showOfflineEarnings,
      offlineEarnings,
      timeAway,
      hideOfflineEarnings,
      currentPage,
      expandedCard,
      toggleCard,
      closeCard,
      supabaseStatus,
      redisStatus,
      currentUserId,
      accountInfo,
      walletInfo,
      siwxSessions,
      latestSignature
    }
  }
});
</script>

<style>
:root {
  --primary-color: #6c5ce7;
  --secondary-color: #00b894;
  --accent-color: #fdcb6e;
  --danger-color: #e84393;
  --text-color: #2d3436;
  --text-light: #636e72;
  --background-color: #f5f6fa;
  --card-color: #ffffff;
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --border-radius: 0.5rem;
  --border-radius-lg: 1rem;
  --transition-fast: 0.2s ease;
  --transition-normal: 0.3s ease;
}

/* Base Styles */
body {
  margin: 0;
  font-family: 'Inter', sans-serif;
  background-color: var(--background-color);
  color: var(--text-color);
  line-height: 1.6;
}

.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.highlight {
  color: var(--primary-color);
  font-weight: 600;
}

/* Header Styles */
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  margin-bottom: 2rem;
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.app-title {
  font-size: 1.75rem;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(45deg, var(--primary-color), var(--accent-color));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.app-nav {
  display: flex;
  gap: 1rem;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  background-color: transparent;
  border-radius: var(--border-radius);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--text-light);
}

.nav-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: var(--primary-color);
}

.nav-btn.active {
  background-color: var(--primary-color);
  color: white;
}

.nav-btn .icon {
  font-size: 1.2rem;
}

.app-main {
  margin-bottom: 2rem;
  min-height: calc(100vh - 200px);
}

/* Footer Styles */
.app-footer {
  text-align: center;
  padding: 1.5rem 0;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  color: var(--text-light);
  font-size: 0.875rem;
  background: linear-gradient(to right, rgba(108, 92, 231, 0.05), rgba(253, 203, 110, 0.05));
}

.wallet-connection {
  margin: 0;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .split-screen-container {
    flex-direction: column;
    height: auto;
  }
  
  .main-game-area {
    border-right: none;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .side-panel {
    max-height: 500px;
  }
}

@media (max-width: 640px) {
  .split-screen-container {
    padding: 1rem;
  }
  
  .quick-stats-bar,
  .mini-indicators {
    flex-wrap: wrap;
  }
  
  .panel-nav {
    justify-content: flex-start;
  }
  
  .panel-nav button {
    padding: 0.75rem 1rem;
  }
}

/* Welcome/Onboarding Section */
.welcome-section {
  display: flex;
  align-items: center;
  gap: 3rem;
  min-height: 400px;
  background: linear-gradient(135deg, rgba(108, 92, 231, 0.1), rgba(253, 203, 110, 0.1));
  border-radius: var(--border-radius-lg);
  padding: 3rem;
  box-shadow: var(--shadow-md);
  overflow: hidden;
  position: relative;
}

.welcome-content {
  flex: 1;
  z-index: 2;
}

.welcome-title {
  font-size: 3rem;
  font-weight: 800;
  margin-bottom: 1rem;
  background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  line-height: 1.2;
}

.welcome-description {
  font-size: 1.25rem;
  color: var(--text-light);
  max-width: 36rem;
  margin-bottom: 2rem;
}

.cta-container {
  margin-top: 2rem;
}

.cta-note {
  margin-top: 1rem;
  font-size: 0.9rem;
  color: var(--text-light);
}

.splash-image {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.splash-image .floating {
  width: 200px;
  height: 200px;
  animation: float 6s ease-in-out infinite;
  filter: drop-shadow(0 10px 15px rgba(0, 0, 0, 0.1));
}

/* Floating animation */
@keyframes float {
  0% {
    transform: translateY(0px) rotate(0deg);
  }
  50% {
    transform: translateY(-20px) rotate(10deg);
  }
  100% {
    transform: translateY(0px) rotate(0deg);
  }
}

/* Game Section */
.game-section {
  width: 100%;
  height: calc(100vh - 200px);
  min-height: 700px;
  position: relative;
  overflow: hidden;
}

.game-hub {
  position: relative;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.7) 0%, rgba(108, 92, 231, 0.05) 70%);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* Core Stats */
.core-stats {
  position: absolute;
  top: 20px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 20px;
  z-index: 2;
}

.stats-card {
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: var(--border-radius);
  padding: 0.75rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: var(--shadow-sm);
  min-width: 100px;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  transition: all var(--transition-normal);
}

.stats-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow-md);
}

.stats-icon {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.stats-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--primary-color);
  line-height: 1.2;
}

.stats-label {
  font-size: 0.75rem;
  color: var(--text-light);
  margin-top: 0.25rem;
}

/* Center Clicker */
.clicker-center {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 40px;
}

.clicker-container {
  position: relative;
  margin-bottom: 2rem;
}

.main-clicker {
  transform: scale(1.2);
  transition: all var(--transition-normal);
  filter: drop-shadow(0 10px 20px rgba(108, 92, 231, 0.4));
  z-index: 3;
  position: relative;
}

.main-clicker:hover {
  transform: scale(1.3);
  filter: drop-shadow(0 15px 25px rgba(108, 92, 231, 0.5));
}

.clicker-aura {
  position: absolute;
  width: 250px;
  height: 250px;
  background: radial-gradient(circle, rgba(108, 92, 231, 0.2) 0%, rgba(108, 92, 231, 0) 70%);
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  animation: pulse-aura 4s ease-in-out infinite;
  pointer-events: none;
}

@keyframes pulse-aura {
  0% {
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 0.5;
  }
  50% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.7;
  }
  100% {
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 0.5;
  }
}

.clicker-instructions {
  font-size: 0.875rem;
  color: var(--text-light);
  text-align: center;
  margin-top: 0.5rem;
  background-color: rgba(255, 255, 255, 0.8);
  padding: 0.5rem 1.5rem;
  border-radius: 9999px;
  backdrop-filter: blur(3px);
  box-shadow: var(--shadow-sm);
}

/* Orbital Feature Cards */
.orbital-cards {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  pointer-events: none;
}

.feature-card {
  position: absolute;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-md);
  padding: 1rem;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: pointer;
  pointer-events: auto;
  z-index: 3;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  overflow: hidden;
  transform-origin: center center;
}

/* Card positions */
.feature-card:nth-child(1) {
  top: 30%;
  left: 10%;
  width: 90px;
  height: 90px;
}

.feature-card:nth-child(2) {
  top: 20%;
  right: 15%;
  width: 90px;
  height: 90px;
}

.feature-card:nth-child(3) {
  bottom: 25%;
  left: 15%;
  width: 90px;
  height: 90px;
}

.feature-card:nth-child(4) {
  bottom: 20%;
  right: 10%;
  width: 90px;
  height: 90px;
}

.feature-card:hover {
  transform: scale(1.1);
  box-shadow: var(--shadow-lg);
  background-color: rgba(255, 255, 255, 0.95);
}

/* Card Preview */
.card-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.card-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  transition: all var(--transition-normal);
}

.card-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
  color: var(--primary-color);
}

/* Notification Badge */
.notification-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 22px;
  height: 22px;
  background-color: var(--danger-color);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: bold;
  border: 2px solid white;
  z-index: 10;
}

.feature-card.notification {
  animation: pulse-card 2s infinite;
}

@keyframes pulse-card {
  0% {
    box-shadow: 0 0 0 0 rgba(232, 67, 147, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(232, 67, 147, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(232, 67, 147, 0);
  }
}

/* Expanded Card */
.card-expanded {
  display: none;
  height: 100%;
  width: 100%;
  opacity: 0;
  transition: opacity 0.3s;
}

.feature-card.expanded {
  width: 350px;
  height: 500px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  cursor: default;
  box-shadow: var(--shadow-lg);
  background-color: rgba(255, 255, 255, 0.98);
}

.feature-card.expanded .card-preview {
  display: none;
}

.feature-card.expanded .card-expanded {
  display: flex;
  flex-direction: column;
  opacity: 1;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.card-expanded::-webkit-scrollbar {
  width: 5px;
}

.card-expanded::-webkit-scrollbar-thumb {
  background-color: rgba(108, 92, 231, 0.3);
  border-radius: 10px;
}

.card-expanded::-webkit-scrollbar-track {
  background-color: transparent;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.card-header h3 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--primary-color);
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-light);
  cursor: pointer;
  padding: 0;
  margin: 0;
  height: 30px;
  width: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all var(--transition-fast);
}

.close-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: var(--danger-color);
}

/* Streak Display */
.streak-display {
  position: absolute;
  bottom: 1rem;
  width: 100%;
  text-align: center;
  z-index: 1;
}

/* Staking Page Styles */
.staking-section {
  padding: 2rem 0;
}

.staking-container {
  background-color: var(--card-color);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  padding: 2rem;
}

.staking-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.staking-header h2 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.staking-header p {
  color: var(--text-light);
  font-size: 1.1rem;
}

.staking-content {
  margin-bottom: 2rem;
}

.staking-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.info-card {
  background-color: rgba(108, 92, 231, 0.05);
  border-radius: var(--border-radius);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
  border-left: 3px solid var(--primary-color);
}

.info-card h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: var(--primary-color);
  font-size: 1.2rem;
}

.info-card p, .info-card ul {
  margin: 0;
  color: var(--text-light);
}

.info-card ul {
  padding-left: 1.5rem;
}

.info-card li {
  margin-bottom: 0.5rem;
}

.audit-card {
  background-color: rgba(255, 204, 51, 0.05);
  border-left: 3px solid #ffcc33;
}

.audit-progress {
  margin: 15px 0;
}

.progress-label {
  font-size: 14px;
  color: var(--text-light);
  margin-bottom: 5px;
}

.progress-bar {
  height: 8px;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #ffcc33;
  border-radius: 4px;
}

.progress-text {
  font-size: 12px;
  color: #ffcc33;
  text-align: right;
  margin-top: 3px;
}

.estimated-completion {
  font-size: 14px;
  font-style: italic;
  margin-top: 10px;
  color: var(--text-light);
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .game-section {
    height: auto;
    min-height: 600px;
    padding-bottom: 2rem;
  }
  
  .game-hub {
    height: auto;
    min-height: 600px;
  }
  
  .orbital-cards {
    position: relative;
    height: auto;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1.5rem;
    margin-top: 2rem;
    padding: 0 1rem;
    margin-bottom: 4rem;
  }
  
  .feature-card {
    position: relative;
    top: auto !important;
    left: auto !important;
    right: auto !important;
    bottom: auto !important;
    width: 120px !important;
    height: 120px !important;
    margin: 0.5rem;
  }
  
  .feature-card.expanded {
    position: fixed;
    top: 50% !important;
    left: 50% !important;
    width: 350px !important;
    height: 500px !important;
  }
  
  .welcome-section {
    flex-direction: column;
    padding: 2rem;
    gap: 2rem;
  }
  
  .splash-image {
    order: -1;
  }
  
  .app-header {
    flex-direction: column;
    gap: 1rem;
    align-items: center;
  }
  
  .app-nav {
    margin: 1rem 0;
  }
}

@media (max-width: 640px) {
  .core-stats {
    position: relative;
    flex-wrap: wrap;
    padding: 1rem;
    gap: 0.75rem;
  }
  
  .stats-card {
    width: calc(50% - 1rem);
    padding: 0.5rem 1rem;
    min-width: auto;
  }
  
  .clicker-center {
    margin-top: 1rem;
  }
  
  .feature-card {
    width: calc(45% - 1rem) !important;
    height: 100px !important;
  }
  
  .feature-card.expanded {
    width: 90% !important;
    height: 80% !important;
    overflow-y: auto;
  }
  
  .welcome-title {
    font-size: 2.25rem;
  }
  
  .staking-info {
    grid-template-columns: 1fr;
  }
  
  .card-icon {
    font-size: 1.5rem;
  }
}

.status-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: linear-gradient(90deg, #5768a9 0%, #e9d68b 100%);
  color: #2d3436;
  font-size: 1rem;
  font-weight: 500;
  padding: 0.5rem 0;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.status-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 4px;
  background: #b2bec3;
}
.status-dot.ok {
  background: #00b894;
}
.status-dot.fail {
  background: #e84393;
}

/* Authentication related styles */
.locked {
  position: relative;
  cursor: not-allowed;
  filter: grayscale(0.7);
}

.lock-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 14px;
  z-index: 2;
}

.auth-required-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  z-index: 10;
}

.auth-lock-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.auth-message {
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--primary-color);
}

.clicker-aura.disabled {
  opacity: 0.3;
}

.game-auth-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
  backdrop-filter: blur(2px);
  border-radius: var(--border-radius-lg);
}

.auth-message-container {
  background: white;
  padding: 2rem;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-lg);
  text-align: center;
  max-width: 90%;
  width: 400px;
}

.auth-title {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: var(--primary-color);
}

.auth-description {
  margin-bottom: 1.5rem;
  color: var(--text-light);
}

.auth-wallet-btn {
  margin: 0 auto;
}
</style>