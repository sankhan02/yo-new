<template>
  <div class="referees-list">
    <h3 class="section-title">
      Your Referrals
      <div v-if="referralStore.isLoadingReferees" class="loading-indicator">
        <div class="small-spinner"></div>
      </div>
    </h3>

    <div v-if="referralStore.referralError" class="error-message">
      <p>{{ referralStore.referralError }}</p>
      <button @click="retryLoading" class="retry-btn">Try Again</button>
    </div>

    <div v-else-if="!referralStore.isLoadingReferees && (!referralStore.referees || referralStore.referees.length === 0)" class="empty-state">
      <div class="empty-icon">👥</div>
      <p class="empty-text">You don't have any referrals yet</p>
      <p class="empty-subtext">Share your referral link with friends to start earning rewards!</p>
    </div>

    <div v-else class="referees-container">
      <div class="list-header">
        <span class="header-item username-header">Username</span>
        <span class="header-item joined-header">Joined</span>
        <span class="header-item status-header">Status</span>
        <span class="header-item reward-header">Reward</span>
      </div>

      <div v-for="referee in referralStore.referees" :key="referee.walletAddress" class="referee-item">
        <div class="username-cell">
          <div class="avatar" :style="{ backgroundColor: generateAvatarColor(referee.walletAddress) }">
            {{ getInitials(referee.username || referee.walletAddress) }}
          </div>
          <div class="user-details">
            <span class="username">{{ referee.username || 'Anonymous' }}</span>
            <span class="wallet">{{ truncateWallet(referee.walletAddress) }}</span>
          </div>
        </div>

        <div class="joined-cell">
          {{ formatDate(referee.joinedAt) }}
        </div>

        <div class="status-cell">
          <span class="status-badge" :class="referee.isActive ? 'active' : 'inactive'">
            {{ referee.isActive ? 'Active' : 'Inactive' }}
          </span>
        </div>

        <div class="reward-cell">
          <span v-if="referee.rewardClaimed">
            <span class="coin-icon">🪙</span> {{ referee.rewardAmount }}
          </span>
          <span v-else class="pending-reward">Pending</span>
        </div>
      </div>

      <div v-if="referralStore.referees && referralStore.referees.length > 5" class="show-more-container">
        <button class="show-more-btn">Show More</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useReferralStore } from '../store/referralStore';

const referralStore = useReferralStore();

function retryLoading() {
  referralStore.loadReferees();
}

function generateAvatarColor(walletAddress: string): string {
  // Generate a deterministic color from wallet address
  const hash = walletAddress.slice(2, 8);
  const hue = parseInt(hash, 16) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

function getInitials(text: string): string {
  if (!text) return '?';
  if (text.startsWith('0x')) {
    // For wallet addresses, use first 2 chars after 0x
    return text.slice(2, 4).toUpperCase();
  }
  // For usernames, get first 2 chars
  return text.slice(0, 2).toUpperCase();
}

function truncateWallet(wallet: string): string {
  if (!wallet) return '';
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function formatDate(dateString: string): string {
  if (!dateString) return 'Unknown';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 1) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  } else {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }
}
</script>

<style scoped>
.referees-list {
  background: rgba(30, 30, 44, 0.85);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 24px;
  width: 100%;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 0;
  margin-bottom: 20px;
  color: #fff;
  font-size: 1.3rem;
}

.loading-indicator {
  display: inline-flex;
  align-items: center;
}

.small-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #ffce3a;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  background: rgba(255, 70, 70, 0.2);
  border: 1px solid rgba(255, 70, 70, 0.4);
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  color: #ff7070;
}

.retry-btn {
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  margin-top: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px;
  color: #999;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-text {
  font-size: 1.1rem;
  margin-bottom: 8px;
  color: #ccc;
}

.empty-subtext {
  font-size: 0.9rem;
  max-width: 260px;
}

.referees-container {
  width: 100%;
}

.list-header {
  display: flex;
  padding: 0 12px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.85rem;
  color: #999;
  font-weight: 500;
}

.header-item {
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.username-header {
  flex: 2;
}

.joined-header, .status-header, .reward-header {
  flex: 1;
  text-align: center;
}

.referee-item {
  display: flex;
  align-items: center;
  padding: 16px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.2s;
}

.referee-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.username-cell {
  flex: 2;
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.85rem;
  color: #fff;
}

.user-details {
  display: flex;
  flex-direction: column;
}

.username {
  font-weight: 500;
  color: #fff;
}

.wallet {
  font-size: 0.8rem;
  color: #999;
  margin-top: 2px;
}

.joined-cell, .status-cell, .reward-cell {
  flex: 1;
  text-align: center;
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.active {
  background: rgba(76, 175, 80, 0.2);
  color: #81c784;
}

.inactive {
  background: rgba(158, 158, 158, 0.2);
  color: #bdbdbd;
}

.pending-reward {
  color: #999;
  font-style: italic;
  font-size: 0.9rem;
}

.coin-icon {
  font-size: 0.9rem;
  margin-right: 2px;
}

.show-more-container {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.show-more-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #ccc;
  padding: 8px 24px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.show-more-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

@media (max-width: 768px) {
  .list-header {
    display: none;
  }
  
  .referee-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    position: relative;
    padding: 16px;
  }
  
  .username-cell {
    width: 100%;
  }
  
  .joined-cell, .status-cell, .reward-cell {
    text-align: left;
  }
  
  .joined-cell {
    font-size: 0.8rem;
    color: #999;
  }
  
  .status-cell {
    position: absolute;
    top: 16px;
    right: 16px;
  }
  
  .reward-cell {
    margin-top: 4px;
    font-weight: 500;
  }
}
</style> 