import { SupabaseStorage } from '../supabase/SupabaseStorage';
import type {
  UserProfile,
  GameSettings,
  GameStatistics,
  PowerUp,
  Clan,
  Referral
} from '../interfaces/StorageInterface';

export class DataMigration {
  constructor(private supabaseStorage: SupabaseStorage) {}

  async migrateUserData(userId: string): Promise<void> {
    try {
      // Migrate user profile
      const localProfile = this.getLocalStorageItem<UserProfile>(`user_profile_${userId}`);
      if (localProfile) {
        await this.supabaseStorage.updateUserProfile(userId, localProfile);
      }

      // Migrate game settings
      const localSettings = this.getLocalStorageItem<GameSettings>(`game_settings_${userId}`);
      if (localSettings) {
        await this.supabaseStorage.updateGameSettings(userId, localSettings);
      }

      // Migrate game statistics
      const localStats = this.getLocalStorageItem<GameStatistics>(`game_statistics_${userId}`);
      if (localStats) {
        await this.supabaseStorage.updateGameStatistics(userId, localStats);
      }

      // Migrate power-ups
      const localPowerUps = this.getLocalStorageItem<PowerUp[]>(`power_ups_${userId}`) || [];
      for (const powerUp of localPowerUps) {
        await this.supabaseStorage.updatePowerUp(userId, powerUp.id, powerUp.quantity);
      }

      // Migrate clan data if user is a clan owner
      const localClan = this.getLocalStorageItem<Clan>(`clan_${userId}`);
      if (localClan && localClan.ownerId === userId) {
        await this.supabaseStorage.updateClan(localClan.id, localClan);
      }

      // Migrate referrals
      const localReferrals = this.getLocalStorageItem<Referral[]>(`referrals_${userId}`) || [];
      for (const referral of localReferrals) {
        if (referral.referrerId === userId) {
          await this.supabaseStorage.createReferral(referral.referrerId, referral.referredId);
        }
      }

      // After successful migration, clear localStorage data
      this.clearLocalStorageData(userId);

      console.log(`Successfully migrated data for user ${userId} to Supabase`);
    } catch (error) {
      console.error('Error during data migration:', error);
      throw new Error(`Failed to migrate data for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getLocalStorageItem<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error(`Error reading ${key} from localStorage:`, error);
      return null;
    }
  }

  private clearLocalStorageData(userId: string): void {
    const keysToRemove = [
      `user_profile_${userId}`,
      `game_settings_${userId}`,
      `game_statistics_${userId}`,
      `power_ups_${userId}`,
      `clan_${userId}`,
      `referrals_${userId}`
    ];

    for (const key of keysToRemove) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Error removing ${key} from localStorage:`, error);
      }
    }
  }
} 