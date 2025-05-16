import { SupabaseStorage } from './supabase/SupabaseStorage';

// Storage type enum
export enum StorageType {
  SUPABASE = 'supabase',
  LOCAL_STORAGE = 'localStorage'
}

// Singleton storage factory
export class StorageFactory {
  private static instance: StorageFactory;
  private storageType: StorageType = StorageType.LOCAL_STORAGE;
  private supabaseStorage: SupabaseStorage | null = null;

  private constructor() {
    // Private constructor to enforce singleton
  }

  public static getInstance(): StorageFactory {
    if (!StorageFactory.instance) {
      StorageFactory.instance = new StorageFactory();
    }
    return StorageFactory.instance;
  }

  public setStorageType(type: StorageType): void {
    this.storageType = type;
    if (type === StorageType.SUPABASE && !this.supabaseStorage) {
      this.supabaseStorage = new SupabaseStorage();
    }
  }

  public getStorage(): SupabaseStorage {
    if (this.storageType === StorageType.SUPABASE) {
      if (!this.supabaseStorage) {
        this.supabaseStorage = new SupabaseStorage();
      }
      return this.supabaseStorage;
    }
    throw new Error('Storage type not supported or not initialized');
  }

  public getCurrentStorageType(): StorageType {
    return this.storageType;
  }

  public isSupabaseEnabled(): boolean {
    return this.storageType === StorageType.SUPABASE;
  }
} 