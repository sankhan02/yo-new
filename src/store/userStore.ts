import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { supabase } from '@/storage/config/supabase';
import { userWallet } from '@/lib/auth';

export interface User {
  id: string;
  wallet_address: string;
  roles: string[];
  displayName?: string;
  avatarUrl?: string;
  created_at: string;
}

export const useUserStore = defineStore('user', () => {
  // State
  const user = ref<User | null>(null);
  const isLoadingUser = ref(false);
  const userError = ref<string | null>(null);
  const hasCheckedAdmin = ref(false);

  // Computed
  const isAdmin = computed(() => {
    return !!user.value?.roles?.includes('admin');
  });

  // Actions
  async function fetchUserProfile() {
    if (!userWallet.value) {
      user.value = null;
      return null;
    }

    isLoadingUser.value = true;
    userError.value = null;

    try {
      // Get user profile with roles from Supabase
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, wallet_address, roles, display_name, avatar_url, created_at')
        .eq('wallet_address', userWallet.value)
        .single();
      
      if (error) {
        throw error;
      }

      if (data) {
        user.value = {
          id: data.id,
          wallet_address: data.wallet_address,
          roles: data.roles || [],
          displayName: data.display_name,
          avatarUrl: data.avatar_url,
          created_at: data.created_at
        };
        return user.value;
      } else {
        // No profile found, might be a new user
        user.value = null;
        return null;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      userError.value = error instanceof Error ? error.message : 'Failed to load user profile';
      user.value = null;
      return null;
    } finally {
      isLoadingUser.value = false;
    }
  }

  async function verifyAdminStatus(): Promise<boolean> {
    if (!userWallet.value) {
      return false;
    }

    // If we already checked and user is admin, return cached result
    if (hasCheckedAdmin.value && isAdmin.value) {
      return true;
    }

    try {
      // Call a secure server-side function to verify admin status
      const { data, error } = await supabase.functions.invoke('verify-admin-role', {
        body: { wallet_address: userWallet.value }
      });

      if (error) {
        throw error;
      }

      // Update the user's roles based on server response
      if (data && data.isAdmin && user.value) {
        user.value.roles = [...(user.value.roles || []), 'admin'];
      }

      hasCheckedAdmin.value = true;
      return isAdmin.value;
    } catch (error) {
      console.error('Error verifying admin status:', error);
      return false;
    }
  }

  function clearUser() {
    user.value = null;
    hasCheckedAdmin.value = false;
  }

  return {
    user,
    isLoadingUser,
    userError,
    isAdmin,
    fetchUserProfile,
    verifyAdminStatus,
    clearUser
  };
}); 