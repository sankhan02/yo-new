import { ref } from 'vue';
import { supabase } from '../storage/config/supabase';
import type { User } from '@supabase/supabase-js';
import { errorHandler, StorageError, SyncError } from './errorHandler';

interface QueuedOperation {
  type: 'click' | 'powerUp' | 'settings' | 'referral';
  data: any;
  timestamp: number;
}

interface PowerUpOperationData {
  userId: string;
  powerUpId: string;
  quantity: number;
}

class OfflineManager {
  private isOnline = ref(navigator.onLine);
  private syncQueue: QueuedOperation[] = [];
  private localCache = new Map<string, any>();
  private readonly CACHE_KEY = 'game_offline_cache';
  private readonly QUEUE_KEY = 'game_sync_queue';

  constructor() {
    // Initialize online status listeners
    window.addEventListener('online', () => {
      this.isOnline.value = true;
      this.processSyncQueue().catch(error => 
        errorHandler.handleError(error, 'Processing sync queue after coming online')
      );
    });
    window.addEventListener('offline', () => {
      this.isOnline.value = false;
    });

    // Load cached data
    this.loadFromStorage().catch(error => 
      errorHandler.handleError(error, 'Loading initial cached data')
    );
  }

  // Check if we're online
  public getOnlineStatus(): boolean {
    return this.isOnline.value;
  }

  // Cache data for offline use
  public async cacheData(key: string, data: any): Promise<void> {
    try {
      this.localCache.set(key, {
        data,
        timestamp: Date.now()
      });
      await this.saveToStorage();
    } catch (error) {
      throw new StorageError(`Failed to cache data for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Get cached data
  public getCachedData<T>(key: string): T | null {
    try {
      const cached = this.localCache.get(key);
      return cached ? cached.data : null;
    } catch (error) {
      errorHandler.handleError(
        new StorageError(`Failed to get cached data for key ${key}: ${error instanceof Error ? error.message : String(error)}`),
        'Retrieving cached data'
      );
      return null;
    }
  }

  // Queue an operation for sync
  public async queueOperation(operation: QueuedOperation): Promise<void> {
    try {
      this.syncQueue.push(operation);
      await this.saveToStorage();
    } catch (error) {
      throw new StorageError(`Failed to queue operation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Process the sync queue when back online
  private async processSyncQueue(): Promise<void> {
    if (!this.isOnline.value || this.syncQueue.length === 0) return;

    const operations = [...this.syncQueue];
    this.syncQueue = [];

    for (const operation of operations) {
      try {
        await errorHandler.retryOperation(
          async () => {
            switch (operation.type) {
              case 'click':
                await this.processClickOperation(operation.data);
                break;
              case 'powerUp':
                await this.processPowerUpOperation(operation.data);
                break;
              case 'settings':
                await this.processSettingsOperation(operation.data);
                break;
              case 'referral':
                await this.processReferralOperation(operation.data);
                break;
            }
          },
          `Processing ${operation.type} operation`,
          // Validate the operation was successful
          () => true // Add specific validation if needed
        );
      } catch (error) {
        // If operation fails even after retries, add it back to queue
        this.syncQueue.push(operation);
        await errorHandler.handleError(
          new SyncError(`Failed to process ${operation.type} operation: ${error instanceof Error ? error.message : String(error)}`),
          'Processing sync queue'
        );
      }
    }

    await this.saveToStorage();
  }

  // Process specific operation types
  private async processClickOperation(data: { userId: string, count: number }): Promise<void> {
    const { userId, count } = data;
    const { error } = await supabase
      .from('game_states')
      .update({ total_clicks: count })
      .eq('user_id', userId);

    if (error) {
      throw new SyncError(`Failed to sync click count: ${error.message}`);
    }
  }

  private async processPowerUpOperation(data: PowerUpOperationData): Promise<void> {
    const { userId, powerUpId, quantity } = data;
    const { error } = await supabase
      .from('power_ups')
      .update({ quantity })
      .eq('user_id', userId)
      .eq('id', powerUpId);

    if (error) {
      throw new SyncError(`Failed to sync power-up: ${error.message}`);
    }
  }

  private async processSettingsOperation(data: { userId: string, settings: any }): Promise<void> {
    const { userId, settings } = data;
    const { error } = await supabase
      .from('game_settings')
      .update(settings)
      .eq('user_id', userId);

    if (error) {
      throw new SyncError(`Failed to sync settings: ${error.message}`);
    }
  }

  private async processReferralOperation(data: { referrerId: string, referredId: string }): Promise<void> {
    const { referrerId, referredId } = data;
    const { error } = await supabase
      .from('referrals')
      .insert([{ referrer_id: referrerId, referred_id: referredId }]);

    if (error) {
      throw new SyncError(`Failed to sync referral: ${error.message}`);
    }
  }

  // Storage management
  private async loadFromStorage(): Promise<void> {
    try {
      const cachedData = localStorage.getItem(this.CACHE_KEY);
      const queueData = localStorage.getItem(this.QUEUE_KEY);

      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        this.localCache = new Map(Object.entries(parsed));
      }

      if (queueData) {
        this.syncQueue = JSON.parse(queueData);
      }
    } catch (error) {
      throw new StorageError(`Failed to load from storage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      const cacheData = Object.fromEntries(this.localCache);
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
      localStorage.setItem(this.QUEUE_KEY, JSON.stringify(this.syncQueue));
    } catch (error) {
      throw new StorageError(`Failed to save to storage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const offlineManager = new OfflineManager(); 