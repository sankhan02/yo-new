<template>
  <div class="leaderboard">
    <h2 class="leaderboard-title">Top Referrers</h2>
    
    <div v-if="isLoadingLeaderboard" class="loading-container">
      <div class="spinner"></div>
      <span>Loading leaderboard...</span>
    </div>
    
    <div v-else-if="leaderboardError" class="error-container">
      <p>{{ leaderboardError }}</p>
      <button @click="loadLeaderboard" class="retry-btn">Retry</button>
    </div>
    
    <div v-else-if="!leaderboardData.length" class="empty-leaderboard">
      <p>No leaderboard data available yet. Be the first to refer friends!</p>
    </div>
    
    <div v-else class="leaderboard-table">
      <div class="leaderboard-header">
        <div class="rank-column">Rank</div>
        <div class="user-column">User</div>
        <div class="count-column">Referrals</div>
      </div>
      
      <div 
        v-for="(entry, index) in leaderboardData" 
        :key="index"
        class="leaderboard-row"
        :class="{ 'current-user': entry.isCurrentUser }"
      >
        <div class="rank-column">
          <div class="rank-badge" :class="getRankClass(index + 1)">{{ index + 1 }}</div>
        </div>
        
        <div class="user-column">
          <div class="user-avatar" :style="getAvatarStyle(entry.avatar)"></div>
          <span class="username">{{ entry.username || entry.wallet_address }}</span>
        </div>
        
        <div class="count-column">{{ entry.referral_count }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useReferralStore } from '../store/referralStore';
import { userWallet } from '../lib/auth';

const referralStore = useReferralStore();
const leaderboardError = ref<string | null>(null);
const leaderboardData = ref<any[]>([]);

// Computed properties
const isLoadingLeaderboard = computed(() => referralStore.isLoadingLeaderboard);

// Methods
async function loadLeaderboard() {
  leaderboardError.value = null;
  
  try {
    const data = await referralStore.loadLeaderboard();
    
    // Mark current user in leaderboard data
    leaderboardData.value = data.map((entry: any) => ({
      ...entry,
      isCurrentUser: entry.wallet_address === userWallet.value
    }));
    
    if (referralStore.referralError) {
      leaderboardError.value = referralStore.referralError;
    }
  } catch (err) {
    console.error('Error loading leaderboard:', err);
    leaderboardError.value = err instanceof Error ? err.message : 'Failed to load leaderboard';
  }
}

function getRankClass(rank: number): string {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return '';
}

function getAvatarStyle(avatar?: string) {
  if (avatar) {
    return { backgroundImage: `url(${avatar})` };
  }
  return { 
    backgroundColor: '#6c5ce7',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };
}

// Lifecycle
onMounted(async () => {
  await loadLeaderboard();
});
</script>

<style scoped>
.leaderboard {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  padding: 24px;
  height: 100%;
}

.leaderboard-title {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 24px;
  text-align: center;
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

.empty-leaderboard {
  text-align: center;
  padding: 40px 20px;
  background: #f9fafb;
  border-radius: 12px;
  color: #6b7280;
  font-style: italic;
}

.leaderboard-table {
  width: 100%;
}

.leaderboard-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #f3f4f6;
  border-radius: 8px 8px 0 0;
  font-weight: 600;
  color: #4b5563;
  font-size: 14px;
}

.rank-column {
  width: 60px;
  text-align: center;
}

.user-column {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.count-column {
  width: 80px;
  text-align: right;
}

.leaderboard-row {
  display: flex;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  transition: background 0.2s;
}

.leaderboard-row:last-child {
  border-bottom: none;
  border-radius: 0 0 8px 8px;
}

.leaderboard-row:hover {
  background: #f9fafb;
}

.leaderboard-row.current-user {
  background: #eff6ff;
}

.rank-badge {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e5e7eb;
  color: #4b5563;
  font-weight: 600;
  font-size: 14px;
  margin: 0 auto;
}

.rank-badge.gold {
  background: linear-gradient(135deg, #f59e0b, #fbbf24);
  color: white;
}

.rank-badge.silver {
  background: linear-gradient(135deg, #9ca3af, #d1d5db);
  color: white;
}

.rank-badge.bronze {
  background: linear-gradient(135deg, #b45309, #d97706);
  color: white;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  background-color: #e5e7eb;
}

.username {
  font-weight: 500;
  color: #111827;
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 768px) {
  .leaderboard {
    padding: 16px;
  }
  
  .rank-column {
    width: 40px;
  }
  
  .count-column {
    width: 60px;
  }
  
  .username {
    max-width: 100px;
    font-size: 14px;
  }
}
</style> 