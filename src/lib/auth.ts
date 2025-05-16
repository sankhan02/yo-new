import { ref, watch, onMounted } from 'vue';
import { supabase } from '../storage/config/supabase';
import { useAppKitAccount } from '@reown/appkit/vue';
import { appKit } from '../config/appkit';
import { API_URLS, STORAGE_KEYS, ERROR_MESSAGES } from '../config/constants';

// Initialize app state
export const isAuthenticated = ref(false);
export const userWallet = ref<string | null>(null);
export const isLoading = ref(false);
export const authError = ref<string | null>(null);

// Use AppKit account for wallet info
const account = useAppKitAccount();

// Watch for wallet address changes and update userWallet
watch(() => account.value, (newAccount) => {
  if (newAccount.isConnected && newAccount.address) {
    userWallet.value = newAccount.address;
  } else {
    userWallet.value = null;
  }
}, { deep: true });

// Initialize auth state from Supabase session
onMounted(async () => {
  await checkAuth();
});

/**
 * Utility to resolve user_id from wallet_address
 */
export async function getUserIdFromWallet(walletAddress: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('wallet_address', walletAddress)
    .single();
  
  if (error || !data) return null;
  return data.id;
}

/**
 * Sign in with Solana wallet
 * This is a compatibility function that relies on Reown AppKit to handle the flow
 */
export async function signIn(walletAddress?: string) {
  isLoading.value = true;
  authError.value = null;
  
  try {
    // Check if already authenticated
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      isAuthenticated.value = true;
      
      if (walletAddress) {
        userWallet.value = walletAddress;
        localStorage.setItem(STORAGE_KEYS.WALLET_ADDRESS, walletAddress);
      }
      
      return true;
    }
    
    // Not authenticated, but the actual sign-in is now handled by AppKit
    // This function exists only for backward compatibility
    
    // If we have a wallet address but aren't authenticated, store it for reference
    if (walletAddress) {
      userWallet.value = walletAddress;
    }
    
    return false;
  } catch (error) {
    console.error('Sign in error:', error);
    authError.value = error instanceof Error ? error.message : 'An unknown error occurred';
    return false;
  } finally {
    isLoading.value = false;
  }
}

/**
 * Sign out the user
 */
export async function signOut() {
  isLoading.value = true;
  authError.value = null;
  
  try {
    // Clear local storage
    localStorage.removeItem(STORAGE_KEYS.WALLET_ADDRESS);
    sessionStorage.removeItem(STORAGE_KEYS.SIWX_SESSION);
    
    // Sign out from Supabase
    await supabase.auth.signOut();
    
    // Reset state
    isAuthenticated.value = false;
    userWallet.value = null;
    
    return true;
  } catch (error) {
    console.error('Sign out error:', error);
    authError.value = error instanceof Error ? error.message : 'An unknown error occurred';
    return false;
  } finally {
    isLoading.value = false;
  }
}

/**
 * Check if the user is already authenticated
 */
export async function checkAuth() {
  try {
    // Get current Supabase session
    const { data, error } = await supabase.auth.getSession();
    
    if (!error && data?.session) {
      isAuthenticated.value = true;
      
      // Get wallet address from session metadata if available
      const metadata = data.session.user?.user_metadata;
      if (metadata?.wallet_address) {
        userWallet.value = metadata.wallet_address;
      } else {
        // Otherwise, try to get from local storage
        const storedWallet = localStorage.getItem(STORAGE_KEYS.WALLET_ADDRESS);
        if (storedWallet) {
          userWallet.value = storedWallet;
        }
      }
      
      return true;
    } else {
      // No valid session
      isAuthenticated.value = false;
      
      // Clear stale local storage data if session is invalid
      localStorage.removeItem(STORAGE_KEYS.WALLET_ADDRESS);
      sessionStorage.removeItem(STORAGE_KEYS.SIWX_SESSION);
      
      return false;
    }
  } catch (error) {
    console.error('Auth check error:', error);
    isAuthenticated.value = false;
    return false;
  }
}

/**
 * Get current wallet fingerprint for anti-Sybil measures
 */
export async function getWalletFingerprint() {
  if (!userWallet.value) return null;
  
  try {
    // In a real implementation, this would include on-chain data analysis
    // like transaction history, token holdings, etc.
    const wallet = userWallet.value;
    const { data, error } = await supabase
      .from('wallet_fingerprints')
      .select('*')
      .eq('wallet_address', wallet)
      .single();
      
    if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows returned" error
      throw error;
    }
    
    if (!data) {
      // Create a new fingerprint record
      const fingerprint = {
        wallet_address: wallet,
        first_seen: new Date().toISOString(),
        risk_score: 0, // Initially zero risk
        transaction_count: 0, // Would be populated from blockchain data
      };
      
      await supabase.from('wallet_fingerprints').insert([fingerprint]);
      return fingerprint;
    }
    
    return data;
  } catch (error) {
    console.error('Fingerprint error:', error);
    return null;
  }
}

/**
 * @deprecated Use AppKit's built-in SIWX authentication flow instead.
 * This function is maintained for backward compatibility only.
 * 
 * Authenticate with backend using SIWS result (address, signature, message)
 */
export async function siwsAuth({ message, signature, address }: { message: string; signature: string; address: string }) {
  console.warn('siwsAuth is deprecated. Use AppKit wallet connection with SIWX for authentication.');
  
  try {
    // Call Supabase Edge Function to authenticate
    const response = await fetch(API_URLS.WALLET_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        signature,
        message,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.token) {
      throw new Error(data.error || ERROR_MESSAGES.AUTH_FAILED);
    }
    
    // Set Supabase session with JWT
    await supabase.auth.setSession({
      access_token: data.token,
      refresh_token: null as any
    });
    
    // Set state
    isAuthenticated.value = true;
    userWallet.value = address;
    localStorage.setItem(STORAGE_KEYS.WALLET_ADDRESS, address);
    
    // Get the session data from Supabase
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData;
  } catch (error) {
    console.error('SIWS auth error:', error);
    throw error;
  }
}

// Helper to disconnect wallet and clear session
export async function disconnectWalletAndClearSession() {
  await appKit.disconnect();
  localStorage.removeItem(STORAGE_KEYS.WALLET_ADDRESS);
  sessionStorage.removeItem(STORAGE_KEYS.SIWX_SESSION);
}  