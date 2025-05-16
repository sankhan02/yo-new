import { createClient } from '@supabase/supabase-js';
import { API_URLS, API_KEYS, ERROR_MESSAGES } from '@/config/constants';

// More robust test environment check
// NODE_ENV might not be set correctly in all contexts
const isTestEnvironment = process.env.NODE_ENV === 'test' || 
  (typeof process !== 'undefined' && Array.isArray(process.argv) && process.argv.length > 1 && process.argv.some(arg => 
    arg.includes('gameActionTest.ts') || arg.includes('runTests.js')));

console.log('Test environment:', isTestEnvironment);

// Use environment variables or mock values for tests
const supabaseUrl = isTestEnvironment 
  ? 'https://mock-supabase-url.supabase.co' 
  : API_URLS.SUPABASE_URL;

const supabaseAnonKey = isTestEnvironment
  ? 'mock-anon-key'
  : API_KEYS.SUPABASE_ANON_KEY;

// Export the key so it can be imported by other modules
export { supabaseAnonKey };

// Only check in non-test environments
if (!isTestEnvironment && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error('Missing Supabase environment variables');
}

// Create Supabase client with complete configuration
export const supabase = createClient(supabaseUrl as string, supabaseAnonKey as string, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: { 'x-application-name': 'yo-mama-game' }
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  db: {
    schema: 'public'
  }
});

// Error handling utility
export const handleSupabaseError = (error: any) => {
  console.error('Supabase Error:', error.message);
  // You can add more error handling logic here
  throw error;
};

// Connection check utility
export async function checkSupabaseConnection(): Promise<boolean> {
  // Skip real check in test environment
  if (isTestEnvironment) {
    return true;
  }
  
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    return !error;
  } catch (e) {
    console.error('Supabase connection check failed:', e);
    return false;
  }
}

// Export types for better TypeScript support
export type { SupabaseClient } from '@supabase/supabase-js'; 