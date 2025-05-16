// SIWX (Sign In With X) Configuration for Reown AppKit with automatic Supabase authentication
import { supabase } from '../storage/config/supabase';
import type { SIWXConfig, SIWXSession } from '@reown/appkit-siwx';
import { disconnectWalletAndClearSession } from '../lib/auth';
import { API_URLS, STORAGE_KEYS, AUTH_MESSAGES, ERROR_MESSAGES } from './constants';

// Session configuration
const SESSION_EXPIRY_HOURS = 24;
const SESSION_EXPIRY_MS = SESSION_EXPIRY_HOURS * 60 * 60 * 1000;

// Get Supabase anon key from environment
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Extend the SIWXConfig type to include our custom methods
interface CustomSIWXConfig extends SIWXConfig {
  getSession(): Promise<SIWXSession | null>;
}

// Create custom SIWX configuration with Edge Function hook
export const siwxConfig: CustomSIWXConfig = {
  async createMessage({ accountAddress, chainId }) {
    // Create message with domain, uri, statement, and nonce
    const domain = window.location.hostname;
    const nonce = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    return {
      accountAddress,
      chainId,
      domain,
      uri: window.location.origin,
      version: '1',
      nonce,
      issuedAt: timestamp,
      statement: AUTH_MESSAGES.SIGN_MESSAGE_PREFIX,
      resources: [`${window.location.origin}/auth`],
      
      // String representation of the message that will be signed
      toString() {
        // Format must exactly match what the Edge Function expects:
        // "Sign in to domain\nNonce: nonce\nIssued At: timestamp"
        return `Sign in to ${domain}\nNonce: ${nonce}\nIssued At: ${timestamp}`;
      }
    };
  },
  
  async addSession(session: SIWXSession): Promise<void> {
    try {
      const { data, signature, message } = session;
      const { accountAddress } = data;
      
      // Call Supabase Edge Function to authenticate
      const response = await fetch(API_URLS.WALLET_AUTH_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY
        },
        mode: 'cors',
        credentials: 'omit', // Don't send credentials unless needed
        body: JSON.stringify({
          address: accountAddress,
          signature,
          message: message.toString(),
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Auth response error:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          error: errorData
        });
        throw new Error(errorData.error || ERROR_MESSAGES.AUTH_FAILED);
      }
      
      const responseData = await response.json();
      
      // Set session expiry
      const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS);
      
      // Set Supabase session
      await supabase.auth.setSession({
        access_token: responseData.token,
        refresh_token: null as any // We don't use refresh tokens
      });
      
      // Store session data
      const sessionData = {
        ...session,
        expiresAt: expiresAt.toISOString()
      };
      
      localStorage.setItem(STORAGE_KEYS.WALLET_ADDRESS, accountAddress);
      sessionStorage.setItem(STORAGE_KEYS.SIWX_SESSION, JSON.stringify(sessionData));
      
    } catch (error) {
      await disconnectWalletAndClearSession();
      console.error('Authentication error:', error);
      throw error;
    }
  },
  
  async revokeSession(chainId, address): Promise<void> {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Clear local storage
      localStorage.removeItem(STORAGE_KEYS.WALLET_ADDRESS);
      sessionStorage.removeItem(STORAGE_KEYS.SIWX_SESSION);
    } catch (error) {
      console.error('Revoke session error:', error);
    }
  },
  
  async getSession(): Promise<SIWXSession | null> {
    try {
      const sessionStr = sessionStorage.getItem(STORAGE_KEYS.SIWX_SESSION);
      if (!sessionStr) return null;
      
      const session = JSON.parse(sessionStr);
      
      // Check if session is expired
      if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
        await this.revokeSession(session.data.chainId, session.data.accountAddress);
        return null;
      }
      
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  },
  
  async getSessions() {
    // Get active session from sessionStorage
    const storedSession = sessionStorage.getItem(STORAGE_KEYS.SIWX_SESSION);
    if (storedSession) {
      try {
        return [JSON.parse(storedSession)];
      } catch (e) {
        return [];
      }
    }
    
    return [];
  },
  
  async setSessions(sessions) {
    if (sessions.length > 0) {
      sessionStorage.setItem(STORAGE_KEYS.SIWX_SESSION, JSON.stringify(sessions[0]));
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.SIWX_SESSION);
    }
  }
};

// Export types for better TypeScript support
export type { SIWXSession, SIWXConfig };