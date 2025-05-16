<template>
  <div class="referral-card">
    <div class="referral-header">
      <h2 class="title">Refer Friends & Earn Rewards</h2>
      <p class="subtitle">Invite friends to play and earn coins when they play!</p>
    </div>
    
    <div class="rewards-info">
      <div class="reward-item">
        <div class="reward-icon">🎁</div>
        <div class="reward-details">
          <h3>For You</h3>
          <p>1,000 coins + 5% of your friend's first 10K coins</p>
        </div>
      </div>
      
      <div class="reward-item">
        <div class="reward-icon">🎮</div>
        <div class="reward-details">
          <h3>For Your Friend</h3>
          <p>500 coins + special badge</p>
        </div>
      </div>
    </div>
    
    <div v-if="isAuthenticated" class="referral-actions">
      <template v-if="!isLoading && !referralLink">
        <button 
          @click="generateLink" 
          class="generate-btn"
        >
          Generate My Referral Link
        </button>
      </template>
      
      <template v-else-if="isLoading">
        <div class="loading">
          <div class="spinner"></div>
          <span>Generating your unique link...</span>
        </div>
      </template>
      
      <template v-else-if="referralLink">
        <div class="link-container">
          <input 
            type="text" 
            :value="referralLink" 
            readonly 
            class="link-input"
          />
          <button 
            @click="copyLink" 
            class="copy-btn"
            :class="{ 'copied': copied }"
          >
            {{ copied ? 'Copied!' : 'Copy Link' }}
          </button>
        </div>
        
        <div class="share-options">
          <button class="share-btn twitter" @click="shareOnTwitter">
            <img src="@/assets/icons/twitter.svg" alt="Twitter" class="icon" />
            Share on Twitter
          </button>
          
          <button class="share-btn facebook" @click="shareOnFacebook">
            <img src="@/assets/icons/facebook.svg" alt="Facebook" class="icon" />
            Share on Facebook
          </button>
          
          <button class="share-btn whatsapp" @click="shareOnWhatsApp">
            <img src="@/assets/icons/whatsapp.svg" alt="WhatsApp" class="icon" />
            Share on WhatsApp
          </button>
        </div>
      </template>
    </div>
    
    <div v-else class="auth-required">
      <p>Connect your wallet to generate your unique referral link</p>
      <button @click="openWalletConnect" class="connect-wallet-btn">
        Connect Wallet
      </button>
    </div>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useReferralStore } from '../store/referralStore';
import { userWallet, isAuthenticated } from '../lib/auth';

const referralStore = useReferralStore();

// State
const isLoading = ref(false);
const copied = ref(false);
const error = ref<string | null>(null);

// Computed
const referralLink = computed(() => referralStore.referralLink);

// Methods
async function generateLink() {
  if (!userWallet.value) {
    error.value = 'Please connect your wallet first';
    return;
  }
  
  isLoading.value = true;
  error.value = null;
  
  try {
    await referralStore.getReferralCode(userWallet.value);
    
    if (referralStore.referralError) {
      error.value = referralStore.referralError;
    }
  } catch (err) {
    console.error('Error generating referral link:', err);
    error.value = err instanceof Error ? err.message : 'Failed to generate referral link';
  } finally {
    isLoading.value = false;
  }
}

function copyLink() {
  if (!referralLink.value) return;
  
  try {
    navigator.clipboard.writeText(referralLink.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
    return true;
  } catch (err) {
    error.value = 'Failed to copy link to clipboard';
    return false;
  }
}

function shareOnTwitter() {
  if (!referralLink.value) return;
  
  const text = `🎮 Join me on Clickyo Mama! Use my referral link to get 500 coins and a special badge when you sign up: ${referralLink.value}`;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function shareOnFacebook() {
  if (!referralLink.value) return;
  
  const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink.value)}`;
  window.open(url, '_blank');
}

function shareOnWhatsApp() {
  if (!referralLink.value) return;
  
  const text = `🎮 Join me on Clickyo Mama! Use my referral link to get 500 coins and a special badge: ${referralLink.value}`;
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function openWalletConnect() {
  // This would trigger your existing wallet connection flow
  // Emit an event to parent component
  emit('connect-wallet');
}

// Emit
const emit = defineEmits(['connect-wallet']);

// Lifecycle
onMounted(async () => {
  if (isAuthenticated.value && userWallet.value) {
    await referralStore.initializeReferralData(userWallet.value);
  }
});
</script>

<style scoped>
.referral-card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0px 8px 16px rgba(0, 0, 0, 0.1);
  padding: 24px;
  margin-bottom: 24px;
}

.referral-header {
  text-align: center;
  margin-bottom: 24px;
}

.title {
  font-size: 24px;
  font-weight: 700;
  color: #333;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 16px;
  color: #666;
}

.rewards-info {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.reward-item {
  flex: 1;
  display: flex;
  align-items: flex-start;
  background: #f8f9fa;
  border-radius: 12px;
  padding: 16px;
}

.reward-icon {
  font-size: 28px;
  margin-right: 12px;
}

.reward-details h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px;
  color: #333;
}

.reward-details p {
  font-size: 14px;
  color: #666;
  margin: 0;
}

.referral-actions {
  margin-top: 24px;
}

.generate-btn {
  width: 100%;
  padding: 14px;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.generate-btn:hover {
  background: #4338ca;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.link-container {
  display: flex;
  margin-bottom: 16px;
}

.link-input {
  flex-grow: 1;
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 8px 0 0 8px;
  font-size: 14px;
}

.copy-btn {
  padding: 12px 16px;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 0 8px 8px 0;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.copy-btn:hover {
  background: #4338ca;
}

.copy-btn.copied {
  background: #10b981;
}

.share-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.share-btn {
  flex: 1;
  min-width: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.share-btn:hover {
  opacity: 0.9;
}

.share-btn .icon {
  width: 20px;
  height: 20px;
  margin-right: 8px;
}

.twitter {
  background: #1DA1F2;
  color: white;
}

.facebook {
  background: #1877F2;
  color: white;
}

.whatsapp {
  background: #25D366;
  color: white;
}

.auth-required {
  text-align: center;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.connect-wallet-btn {
  margin-top: 16px;
  padding: 12px 24px;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.connect-wallet-btn:hover {
  background: #4338ca;
}

.error-message {
  margin-top: 16px;
  padding: 12px;
  background: #fee2e2;
  color: #b91c1c;
  border-radius: 8px;
  font-size: 14px;
}

@media (max-width: 768px) {
  .rewards-info {
    flex-direction: column;
  }
  
  .share-options {
    flex-direction: column;
  }
  
  .share-btn {
    width: 100%;
  }
}
</style> 