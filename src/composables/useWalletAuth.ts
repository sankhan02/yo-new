import { ref, computed, watchEffect } from 'vue';
import { useAppKitAccount, useDisconnect } from '@reown/appkit/vue';
import { supabase } from '../storage/config/supabase';
import { disconnectWalletAndClearSession } from '../lib/auth';
import type { Session } from '@supabase/supabase-js';
import { ERROR_MESSAGES } from '../config/constants';
import { siwxConfig } from '../config/siwx';

/**
 * Simplified wallet authentication composable
 * 
 * This composable provides a clean API for working with wallet authentication
 * using the AppKit SIWX configuration (src/config/siwx.ts).
 * 
 * It leverages the automatic wallet connection and signing flow while providing
 * useful utilities for status and manual control when needed.
 */
export function useWalletAuth() {
  // Get wallet info from AppKit
  const account = useAppKitAccount();
  const { disconnect } = useDisconnect();
  
  // Reference to the Supabase session
  const session = ref<Session | null>(null);
  const isLoading = ref(false);
  const error = ref('');
  
  // Computed properties for easier access
  const isWalletConnected = computed(() => !!account.value.isConnected);
  const walletAddress = computed(() => account.value.address || '');
  const walletStatus = computed(() => account.value.status);
  const isAuthenticated = computed(() => !!session.value);
  
  // Track session changes and check expiry
  watchEffect(async () => {
    try {
      isLoading.value = true;
      
      // Check SIWX session first
      const siwxSession = await siwxConfig.getSession();
      if (!siwxSession) {
        session.value = null;
        return;
      }
      
      // Then check Supabase session
      const { data } = await supabase.auth.getSession();
      session.value = data.session;
      
      // If we have no valid session but wallet is connected,
      // we need to re-authenticate
      if (!session.value && isWalletConnected.value) {
        error.value = 'Session expired. Please reconnect your wallet.';
        await disconnect();
      }
    } catch (e) {
      console.error('Error checking auth session:', e);
      error.value = e instanceof Error ? e.message : 'Failed to check auth status';
    } finally {
      isLoading.value = false;
    }
  });
  
  // Listen for auth state changes from Supabase
  supabase.auth.onAuthStateChange((event, newSession) => {
    session.value = newSession;
    if (event === 'SIGNED_OUT') {
      // Update local state when signed out
      error.value = '';
    }
  });
  
  /**
   * Sign out and disconnect the wallet
   */
  async function signOut() {
    try {
      isLoading.value = true;
      error.value = '';
      
      // Use the centralized disconnect helper
      await disconnectWalletAndClearSession();
      
      return true;
    } catch (e) {
      console.error('Sign out error:', e);
      error.value = e instanceof Error ? e.message : ERROR_MESSAGES.SIGN_OUT_FAILED;
      return false;
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * Manually disconnect the wallet
   * (normally this is handled by AppKit UI components)
   */
  async function disconnectWallet() {
    try {
      await disconnect();
      return true;
    } catch (e) {
      console.error('Disconnect error:', e);
      error.value = e instanceof Error ? e.message : ERROR_MESSAGES.WALLET_DISCONNECT_FAILED;
      return false;
    }
  }
  
  /**
   * Get user info from Supabase session
   */
  const getUserInfo = computed(() => {
    if (!session.value) return null;
    
    const { user } = session.value;
    return {
      id: user.id,
      email: user.email,
      walletAddress: user.user_metadata?.wallet_address || walletAddress.value,
      // Add more properties as needed
    };
  });
  
  return {
    // State
    isWalletConnected,
    walletAddress,
    walletStatus,
    isAuthenticated,
    isLoading,
    error,
    session,
    getUserInfo,
    
    // Actions
    signOut,
    disconnectWallet,
  };
}
