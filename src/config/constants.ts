/**
 * Application-wide constants
 * 
 * This file centralizes all constants and environment-specific values
 * to avoid duplication and ensure consistency across the application.
 */

// API URLs and Endpoints
export const API_URLS = {
  // Supabase Edge Function endpoints
  WALLET_AUTH_URL: import.meta.env.VITE_SUPABASE_FUNCTION_URL || 
    'https://noaexgonrujeqgexwknd.supabase.co/functions/v1/wallet-auth',
  
  // Supabase Main URL
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 
    'https://noaexgonrujeqgexwknd.supabase.co',
};

// API Keys
export const API_KEYS = {
  // Note: These should come from environment variables in production
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

// Local Storage Keys
export const STORAGE_KEYS = {
  WALLET_ADDRESS: 'walletAddress',
  SIWX_SESSION: 'siwx_active_session',
};

// Chain IDs
export const CHAIN_IDS = {
  SOLANA_MAINNET: 'solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ',
  SOLANA_DEVNET: 'solana:8E9rvCKLFQia2Y35HXjjpWzj8weVo44K',
  SOLANA_TESTNET: 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z',
};

// Authentication Messages
export const AUTH_MESSAGES = {
  SIGN_MESSAGE_PREFIX: 'Sign in to',
};

// Error Messages
export const ERROR_MESSAGES = {
  AUTH_FAILED: 'Authentication failed. Please try again.',
  SIGN_OUT_FAILED: 'Failed to sign out.',
  WALLET_DISCONNECT_FAILED: 'Failed to disconnect wallet.',
  SUPABASE_CONNECTION_FAILED: 'Failed to connect to Supabase',
};

// Feature Flags
export const FEATURES = {
  ENABLE_WALLET_GUIDE: true,
  ANALYTICS_ENABLED: false,
}; 