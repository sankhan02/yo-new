<template>
  <div v-if="loading" class="loading-container">
    <div class="spinner"></div>
    <p>Verifying permissions...</p>
  </div>
  <div v-else-if="isAdmin" class="admin-dashboard">
    <h1>Admin Dashboard</h1>
    
    <div class="dashboard-tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        :class="['tab-button', { active: currentTab === tab.id }]"
        @click="currentTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>
    
    <!-- Game Configuration Tab -->
    <div v-if="currentTab === 'game-config'" class="tab-content">
      <h2>Game Configuration</h2>
      
      <div v-if="isLoadingConfigs" class="loading-container">
        <div class="spinner"></div>
        <p>Loading configurations...</p>
      </div>
      
      <div v-else class="config-list">
        <div v-for="config in configs" :key="config.key" class="config-item">
          <label>{{ config.label || config.key }}</label>
          <input v-model="config.value" :type="config.type || 'text'" />
          <button @click="saveConfig(config)" class="save-button">Save</button>
        </div>
      </div>
    </div>
    
    <!-- User Management Tab -->
    <div v-else-if="currentTab === 'user-management'" class="tab-content">
      <h2>User Management</h2>
      <p>User management features coming soon.</p>
    </div>
    
    <!-- System Status Tab -->
    <div v-else-if="currentTab === 'system-status'" class="tab-content">
      <h2>System Status</h2>
      <p>System monitoring and status features coming soon.</p>
    </div>
    
    <div v-if="message" class="message" :class="{ error: messageType === 'error' }">
      {{ message }}
    </div>
  </div>
  <div v-else class="access-denied">
    <h2>Access Denied</h2>
    <p>You do not have permission to access the admin dashboard.</p>
    <p>Only wallet addresses with admin privileges can access this page.</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useUserStore } from '../../store/userStore';
import { supabase } from '../../storage/config/supabase';
import { isAuthenticated } from '../../lib/auth';

// State
const loading = ref(true);
const isAdmin = ref(false);
const message = ref('');
const messageType = ref<'success' | 'error'>('success');
const configs = ref<any[]>([]);
const isLoadingConfigs = ref(false);
const currentTab = ref('game-config');

// Tabs
const tabs = [
  { id: 'game-config', label: 'Game Configuration' },
  { id: 'user-management', label: 'User Management' },
  { id: 'system-status', label: 'System Status' }
];

// Get user store
const userStore = useUserStore();

onMounted(async () => {
  // Check if user is authenticated first
  if (!isAuthenticated.value) {
    loading.value = false;
    return;
  }
  
  try {
    // First fetch the user profile
    await userStore.fetchUserProfile();
    
    // Then verify admin status from server
    isAdmin.value = await userStore.verifyAdminStatus();
    
    // If admin, load configurations
    if (isAdmin.value) {
      await loadGameConfigs();
    }
  } catch (error) {
    console.error('Error checking admin status:', error);
    message.value = 'Failed to verify admin status';
    messageType.value = 'error';
  } finally {
    loading.value = false;
  }
});

async function loadGameConfigs() {
  isLoadingConfigs.value = true;
  
  try {
    // Call to a secured endpoint that requires admin authentication
    const { data, error } = await supabase.functions.invoke('admin-get-game-configs');
    
    if (error) {
      throw error;
    }
    
    configs.value = data.configs.map((config: any) => ({
      ...config,
      label: formatConfigLabel(config.key)
    }));
  } catch (error) {
    console.error('Error loading game configs:', error);
    message.value = 'Failed to load game configurations';
    messageType.value = 'error';
  } finally {
    isLoadingConfigs.value = false;
  }
}

async function saveConfig(config: any) {
  message.value = '';
  
  try {
    const { data, error } = await supabase.functions.invoke('admin-update-game-config', {
      body: { 
        key: config.key, 
        value: config.value 
      }
    });
    
    if (error) {
      throw error;
    }
    
    message.value = `${formatConfigLabel(config.key)} updated successfully!`;
    messageType.value = 'success';
  } catch (error) {
    console.error('Error saving config:', error);
    message.value = error instanceof Error ? error.message : 'Failed to update configuration';
    messageType.value = 'error';
  }
}

function formatConfigLabel(key: string): string {
  return key.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}
</script>

<style scoped>
.admin-dashboard {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  padding: 2rem;
  max-width: 1000px;
  margin: 2rem auto;
}

h1 {
  color: #6c5ce7;
  margin-top: 0;
  margin-bottom: 1.5rem;
  font-size: 2rem;
}

h2 {
  color: #4a4a4a;
  margin-bottom: 1.5rem;
}

.dashboard-tabs {
  display: flex;
  border-bottom: 1px solid #eee;
  margin-bottom: 2rem;
}

.tab-button {
  background: none;
  border: none;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.2s;
}

.tab-button:hover {
  color: #6c5ce7;
}

.tab-button.active {
  border-bottom-color: #6c5ce7;
  color: #6c5ce7;
  font-weight: 600;
}

.tab-content {
  min-height: 300px;
}

.config-list {
  display: grid;
  gap: 1rem;
}

.config-item {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: 1rem;
  align-items: center;
  padding: 0.75rem;
  border-radius: 4px;
  background: #f8f9fa;
}

.config-item label {
  font-weight: 600;
  color: #4a4a4a;
}

.config-item input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.save-button {
  background: #6c5ce7;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.save-button:hover {
  background: #5549d1;
}

.message {
  margin-top: 1.5rem;
  padding: 0.75rem;
  border-radius: 4px;
  background: #d4edda;
  color: #155724;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
}

.loading-container,
.access-denied {
  text-align: center;
  padding: 3rem;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  max-width: 600px;
  margin: 2rem auto;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0,0,0,0.1);
  border-radius: 50%;
  border-left-color: #6c5ce7;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.access-denied h2 {
  color: #721c24;
}
</style> 