<template>
  <div class="wallet-connection-container p-4 border rounded-lg shadow">
    <!-- AppKit Button and Authentication Status -->
    <div class="flex flex-col items-center">
      <!-- Wallet Status Information -->
      <div v-if="isAuthenticated" class="status-badge connected mb-4 py-2 px-4 rounded-full text-white flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        <span>Authenticated: <span class="font-mono">{{ displayWalletAddress }}</span></span>
      </div>
      
      <div v-else class="status-badge disconnected mb-4 py-2 px-4 rounded-full flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 000-12v12z" clip-rule="evenodd" />
        </svg>
        <span>Not connected</span>
      </div>
      
      <!-- Single Connect Button (Reown AppKit automatically handles signing and auth) -->
      <div class="w-full flex justify-center">
        <appkit-button label="Connect Wallet" />
      </div>
      
      <!-- Manual Sign Out Button (only show when authenticated) -->
      <button v-if="isAuthenticated" 
              @click="signOut" 
              class="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
        Sign Out
      </button>
      
      <!-- Loading State -->
      <div v-if="isLoading" class="mt-4 flex items-center text-blue-600 animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>Processing...</span>
      </div>
      
      <!-- Error Messages -->
      <div v-if="error" class="mt-4 flex items-center text-red-500">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <span>{{ error }}</span>
      </div>
    </div>
    
    <!-- How It Works Explanation -->
    <div class="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <h3 class="font-medium text-lg mb-2">How Wallet Authentication Works:</h3>
      <ol class="list-decimal pl-5 space-y-2 text-sm">
        <li>Click <strong>"Connect Wallet"</strong> to connect your Solana wallet</li>
        <li>Approve the connection in your wallet extension</li>
        <li>Sign the authentication message that appears automatically</li>
        <li>You're authenticated! Your wallet address is now linked to your account</li>
      </ol>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAppKitAccount } from '@reown/appkit/vue';
import { supabase } from '../storage/config/supabase';

// Get AppKit account info
const account = useAppKitAccount();
const isLoading = ref(false);
const error = ref('');
const isAuthenticated = ref(false);

// Format wallet address for display (first 6 + last 4 chars)
const displayWalletAddress = computed(() => {
  if (!account.value.address) return '';
  const addr = account.value.address;
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
});

// Initialize auth status on mount
onMounted(async () => {
  const { data } = await supabase.auth.getSession();
  isAuthenticated.value = !!data?.session?.access_token;
});

// Watch for wallet connection changes
watch(() => account.value, async (newAccount) => {
  if (newAccount.isConnected && newAccount.address) {
    // Check authentication status whenever wallet connects
    const { data } = await supabase.auth.getSession();
    isAuthenticated.value = !!data?.session?.access_token;
  } else {
    // Reset state when wallet disconnects
    isAuthenticated.value = false;
  }
}, { deep: true });

// Sign out function
async function signOut() {
  try {
    isLoading.value = true;
    
    // Simple logout - just clear Supabase session
    await supabase.auth.signOut();
    
    // Clear local storage
    localStorage.removeItem('walletAddress');
    sessionStorage.removeItem('siwx_active_session');
    
    isAuthenticated.value = false;
    error.value = '';
  } catch (e) {
    console.error('Sign out error:', e);
    error.value = e instanceof Error ? e.message : 'Failed to sign out';
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
.wallet-connection-container {
  max-width: 500px;
  margin: 0 auto;
  background-color: #f9fafb;
  border-color: #e5e7eb;
}

.status-badge {
  font-weight: 500;
}

.status-badge.connected {
  background-color: #10b981;
}

.status-badge.disconnected {
  color: #6b7280;
  background-color: #e5e7eb;
}

@media (prefers-color-scheme: dark) {
  .wallet-connection-container {
    background-color: #1f2937;
    border-color: #374151;
    color: #e5e7eb;
  }
  
  .status-badge.disconnected {
    color: #9ca3af;
    background-color: #374151;
  }
}
</style>