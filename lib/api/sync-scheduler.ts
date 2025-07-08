import { AppState, AppStateStatus, Platform } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import ExternalOrganizationService from './external-org-service';

// Task name for background sync
const BACKGROUND_SYNC_TASK = 'BACKGROUND_ORG_SYNC';

// Create service instance
const createApiService = () => {
  return new ExternalOrganizationService({
    apiKey: process.env.EXPO_PUBLIC_EXTERNAL_ORG_API_KEY || '',
    baseUrl: process.env.EXPO_PUBLIC_EXTERNAL_ORG_API_URL || '',
  });
};

// Define the background task
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    console.log('[Background Sync] Starting background sync task');
    const apiService = createApiService();
    const syncResult = await apiService.startSync();
    
    // Return success or failure to the background fetch API
    if (syncResult) {
      console.log('[Background Sync] Sync completed successfully');
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } else {
      console.log('[Background Sync] Sync had no new data');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
  } catch (error) {
    console.error('[Background Sync] Error during background sync:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

class SyncScheduler {
  private apiService: ExternalOrganizationService;
  private syncInterval: number = 15; // in minutes
  private lastSyncTime: Date | null = null;
  private appState: AppStateStatus = 'active';
  private timeoutId: NodeJS.Timeout | null = null;

  constructor() {
    this.apiService = createApiService();
    
    // Initialize app state listener
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  // Initialize the scheduler
  async initialize(): Promise<void> {
    try {
      // Register background fetch task if on mobile platforms
      if (Platform.OS !== 'web') {
        await this.registerBackgroundFetch();
      }
      
      // Start foreground sync scheduling
      this.scheduleForegroundSync();
      
      console.log('Sync scheduler initialized');
    } catch (error) {
      console.error('Failed to initialize sync scheduler:', error);
    }
  }

  // Register the background fetch task
  private async registerBackgroundFetch(): Promise<void> {
    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: this.syncInterval * 60, // convert to seconds
        stopOnTerminate: false,
        startOnBoot: true,
      });
      
      console.log('Background sync task registered');
    } catch (error) {
      console.error('Error registering background fetch task:', error);
    }
  }

  // Handle app state changes (foreground/background)
  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    console.log(`App state changed: ${this.appState} -> ${nextAppState}`);
    
    // When app comes to foreground, check if we need to sync
    if (this.appState.match(/inactive|background/) && nextAppState === 'active') {
      this.checkAndSyncIfNeeded();
    }
    
    this.appState = nextAppState;
  };

  // Schedule the next foreground sync
  private scheduleForegroundSync(): void {
    // Clear any existing timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    
    // Schedule next sync
    this.timeoutId = setTimeout(() => {
      this.performSync();
    }, this.syncInterval * 60 * 1000); // convert to milliseconds
  }

  // Check if sync is needed and perform if necessary
  private async checkAndSyncIfNeeded(): Promise<void> {
    if (!this.lastSyncTime) {
      await this.performSync();
      return;
    }
    
    const now = new Date();
    const timeSinceLastSync = (now.getTime() - this.lastSyncTime.getTime()) / (60 * 1000); // in minutes
    
    if (timeSinceLastSync >= this.syncInterval) {
      await this.performSync();
    }
  }

  // Perform the synchronization
  async performSync(): Promise<boolean> {
    try {
      console.log('Starting foreground sync...');
      const result = await this.apiService.startSync();
      
      if (result) {
        this.lastSyncTime = new Date();
        console.log('Foreground sync completed successfully at', this.lastSyncTime);
      } else {
        console.log('Foreground sync completed with no changes');
      }
      
      // Reschedule next sync
      this.scheduleForegroundSync();
      
      return result;
    } catch (error) {
      console.error('Error during foreground sync:', error);
      
      // Reschedule next sync despite error
      this.scheduleForegroundSync();
      
      return false;
    }
  }

  // Set a custom sync interval (in minutes)
  setSyncInterval(minutes: number): void {
    if (minutes < 15) {
      console.warn('Sync interval cannot be less than 15 minutes. Setting to 15 minutes.');
      minutes = 15;
    }
    
    this.syncInterval = minutes;
    
    // Update background fetch if on mobile
    if (Platform.OS !== 'web') {
      this.registerBackgroundFetch().catch(err => {
        console.error('Failed to update background fetch interval:', err);
      });
    }
    
    // Reschedule foreground sync with new interval
    this.scheduleForegroundSync();
    
    console.log(`Sync interval updated to ${minutes} minutes`);
  }

  // Force an immediate sync
  async forceSync(): Promise<boolean> {
    return await this.performSync();
  }

  // Clean up resources
  cleanup(): void {
    // Remove app state listener
    AppState.removeEventListener('change', this.handleAppStateChange);
    
    // Clear any pending timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    // Unregister background fetch task if on mobile
    if (Platform.OS !== 'web') {
      BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK).catch(err => {
        console.error('Failed to unregister background fetch task:', err);
      });
    }
    
    console.log('Sync scheduler cleaned up');
  }
}

// Export a singleton instance
export default new SyncScheduler();