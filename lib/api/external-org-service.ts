import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Types for external organization data
export interface ExternalOrganizationData {
  id: string;
  name: string;
  description: string;
  type: 'shelter' | 'rescue' | 'clinic' | 'authority';
  contactInfo: {
    email: string;
    phone: string;
    website?: string;
  };
  location: {
    address: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  operationalHours: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };
  services: string[];
  animalCapacity: number;
  staffCount?: number;
  metadata: Record<string, any>;
  lastUpdated: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  metadata?: {
    page?: number;
    totalPages?: number;
    totalRecords?: number;
    nextPage?: string;
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// Configuration for the external API
interface ExternalApiConfig {
  apiKey: string;
  baseUrl: string;
  timeout?: number;
}

class ExternalOrganizationService {
  private api: AxiosInstance;
  private apiKey: string;
  private syncInProgress = false;
  private retryAttempts = 0;
  private maxRetries = 3;
  private retryDelay = 1000; // in milliseconds

  constructor(config: ExternalApiConfig) {
    this.apiKey = config.apiKey;
    this.api = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 10000, // Default timeout: 10 seconds
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': this.apiKey,
      }
    });

    // Set up request interceptor for logging in development
    this.api.interceptors.request.use(
      config => {
        if (__DEV__) {
          console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        }
        return config;
      },
      error => {
        if (__DEV__) {
          console.error('❌ API Request Error:', error);
        }
        return Promise.reject(error);
      }
    );

    // Set up response interceptor for error handling
    this.api.interceptors.response.use(
      response => {
        if (__DEV__) {
          console.log(`✅ API Response: ${response.status} ${response.statusText}`);
        }
        return response;
      },
      async (error: AxiosError) => {
        if (__DEV__) {
          console.error(`❌ API Response Error:`, error.response?.status, error.message);
        }

        // Handle 401 Unauthorized errors (invalid or expired API key)
        if (error.response?.status === 401) {
          // Attempt to refresh API key if possible
          await this.refreshApiKey();
          // Retry the original request with the new key
          const originalRequest = error.config as AxiosRequestConfig;
          if (originalRequest.headers) {
            originalRequest.headers['X-API-Key'] = this.apiKey;
          }
          return this.api(originalRequest);
        }

        // Implement retry logic for 5xx errors
        if (error.response && error.response.status >= 500 && this.retryAttempts < this.maxRetries) {
          this.retryAttempts++;
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * this.retryAttempts));
          return this.api(error.config as AxiosRequestConfig);
        }

        // Reset retry counter after finishing
        this.retryAttempts = 0;

        return Promise.reject(error);
      }
    );
  }

  // Securely store and retrieve the API key
  private async storeApiKey(apiKey: string): Promise<void> {
    if (Platform.OS === 'web') {
      // Use localStorage for web (not secure, but convenient for demo)
      localStorage.setItem('ext_org_api_key', apiKey);
    } else {
      // Use SecureStore for mobile platforms
      await SecureStore.setItemAsync('ext_org_api_key', apiKey);
    }
  }

  private async getStoredApiKey(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem('ext_org_api_key');
    } else {
      return await SecureStore.getItemAsync('ext_org_api_key');
    }
  }

  // Method to refresh API key - implementation depends on the external API's auth mechanism
  private async refreshApiKey(): Promise<void> {
    try {
      // This is a placeholder. In a real application, you would:
      // 1. Call your own backend API that safely holds the client secret
      // 2. Your backend exchanges the refresh token for a new access token
      // 3. Return the new access token to the app

      const storedKey = await this.getStoredApiKey();
      if (storedKey) {
        this.apiKey = storedKey;
        this.api.defaults.headers['X-API-Key'] = this.apiKey;
      }
    } catch (error) {
      console.error('Failed to refresh API key:', error);
      throw new Error('Authentication failed. Please login again.');
    }
  }

  // Fetch all organizations from the external API
  async fetchOrganizations(page: number = 1, limit: number = 20): Promise<ApiResponse<ExternalOrganizationData[]>> {
    try {
      const response = await this.api.get<ApiResponse<ExternalOrganizationData[]>>('/organizations', {
        params: {
          page,
          limit,
          include: 'location,services,operationalHours,metadata',
        }
      });
      return response.data;
    } catch (error) {
      this.handleApiError(error as AxiosError);
      throw error;
    }
  }

  // Fetch a specific organization by ID
  async fetchOrganizationById(id: string): Promise<ExternalOrganizationData> {
    try {
      const response = await this.api.get<ApiResponse<ExternalOrganizationData>>(`/organizations/${id}`, {
        params: {
          include: 'location,services,operationalHours,metadata',
        }
      });
      return response.data.data;
    } catch (error) {
      this.handleApiError(error as AxiosError);
      throw error;
    }
  }

  // Fetch organizations by geographic radius
  async fetchOrganizationsByLocation(
    latitude: number,
    longitude: number,
    radiusInKm: number = 10,
    page: number = 1,
    limit: number = 20
  ): Promise<ApiResponse<ExternalOrganizationData[]>> {
    try {
      const response = await this.api.get<ApiResponse<ExternalOrganizationData[]>>('/organizations/search', {
        params: {
          latitude,
          longitude,
          radius: radiusInKm,
          page,
          limit,
          include: 'location,services,operationalHours,metadata',
        }
      });
      return response.data;
    } catch (error) {
      this.handleApiError(error as AxiosError);
      throw error;
    }
  }

  // Search organizations by type, services, or other criteria
  async searchOrganizations(
    criteria: {
      type?: string;
      services?: string[];
      query?: string;
    },
    page: number = 1,
    limit: number = 20
  ): Promise<ApiResponse<ExternalOrganizationData[]>> {
    try {
      const response = await this.api.get<ApiResponse<ExternalOrganizationData[]>>('/organizations/search', {
        params: {
          ...criteria,
          page,
          limit,
          include: 'location,services,operationalHours,metadata',
        }
      });
      return response.data;
    } catch (error) {
      this.handleApiError(error as AxiosError);
      throw error;
    }
  }

  // Handle API errors with custom logic
  private handleApiError(error: AxiosError): void {
    const errorResponse = error.response?.data as ErrorResponse;
    
    if (errorResponse?.error) {
      // Log structured error information
      console.error(`API Error (${errorResponse.error.code}): ${errorResponse.error.message}`);
      
      // Specific error handling based on error code
      switch (errorResponse.error.code) {
        case 'RATE_LIMIT_EXCEEDED':
          // Handle rate limiting by implementing exponential backoff
          const retryAfter = parseInt(error.response?.headers['retry-after'] || '60', 10);
          console.warn(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
          break;
        
        case 'INVALID_CREDENTIALS':
          // Handle authentication errors
          console.error('API key is invalid or expired.');
          break;
        
        case 'RESOURCE_NOT_FOUND':
          // Handle 404 errors
          console.warn('The requested resource was not found.');
          break;
        
        default:
          // Generic error logging
          console.error('External API Error:', errorResponse);
      }
    } else {
      // Handle network or unexpected errors
      console.error('Network or unexpected error:', error.message);
    }
  }

  // Data synchronization methods
  async startSync(): Promise<boolean> {
    if (this.syncInProgress) {
      console.log('Sync already in progress');
      return false;
    }

    try {
      this.syncInProgress = true;
      console.log('Starting data synchronization...');

      // Get last sync timestamp from local storage
      let lastSyncTimestamp = await this.getLastSyncTimestamp();
      const currentTimestamp = new Date().toISOString();
      let page = 1;
      let hasMorePages = true;
      let totalRecords = 0;

      // Paginate through all changed records since last sync
      while (hasMorePages) {
        const response = await this.api.get<ApiResponse<ExternalOrganizationData[]>>('/organizations/changes', {
          params: {
            since: lastSyncTimestamp,
            page,
            limit: 50,
            include: 'location,services,operationalHours,metadata',
          }
        });

        const { data, metadata } = response.data;
        
        if (data.length > 0) {
          // Process and store the data batch
          await this.processDataBatch(data);
          totalRecords += data.length;
        }

        // Check if there are more pages
        hasMorePages = !!(metadata?.nextPage);
        page++;
      }

      // Update last sync timestamp
      await this.setLastSyncTimestamp(currentTimestamp);
      
      console.log(`Sync completed. ${totalRecords} records processed.`);
      return true;
    } catch (error) {
      console.error('Sync failed:', error);
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  // Process a batch of data for local storage
  private async processDataBatch(data: ExternalOrganizationData[]): Promise<void> {
    // This would typically involve:
    // 1. Mapping the external data to your local schema
    // 2. Storing in your local database (SQLite, Realm, etc.)
    // 3. Handling conflicts and merges

    // For simplicity, this implementation just logs the process
    console.log(`Processing ${data.length} records...`);
    
    // Example data mapping and storage logic
    for (const item of data) {
      try {
        const mappedData = this.mapExternalDataToLocalSchema(item);
        await this.storeOrganizationData(mappedData);
      } catch (error) {
        console.error(`Error processing record ${item.id}:`, error);
        // Continue processing other records despite errors
      }
    }
  }

  // Map external data to local schema
  private mapExternalDataToLocalSchema(data: ExternalOrganizationData): any {
    // Convert external organization data format to local database schema
    return {
      externalId: data.id,
      name: data.name,
      description: data.description,
      organizationType: data.type,
      email: data.contactInfo.email,
      phone: data.contactInfo.phone,
      website: data.contactInfo.website,
      
      // Location data
      address: `${data.location.address.street}, ${data.location.address.city}, ${data.location.address.state} ${data.location.address.postalCode}`,
      city: data.location.address.city,
      state: data.location.address.state,
      postalCode: data.location.address.postalCode,
      country: data.location.address.country,
      latitude: data.location.coordinates.latitude,
      longitude: data.location.coordinates.longitude,
      
      // Services offered
      services: data.services,
      
      // Capacity information
      animalCapacity: data.animalCapacity,
      staffCount: data.staffCount,
      
      // Operating hours
      operatingHours: {
        ...data.operationalHours
      },
      
      // Additional metadata
      metadata: data.metadata,
      
      // Sync metadata
      lastUpdated: data.lastUpdated,
      syncedAt: new Date().toISOString()
    };
  }

  // Store organization data locally
  private async storeOrganizationData(data: any): Promise<void> {
    // This would typically use a local database like SQLite
    // For demonstration, we'll just log the data
    console.log(`Storing data for ${data.name}`);
    
    // In a real implementation, this would be:
    // await database.insertOrUpdate('organizations', data);
  }

  // Get last sync timestamp from storage
  private async getLastSyncTimestamp(): Promise<string> {
    if (Platform.OS === 'web') {
      const timestamp = localStorage.getItem('last_org_sync_timestamp');
      return timestamp || '2000-01-01T00:00:00Z'; // Default to distant past if never synced
    } else {
      const timestamp = await SecureStore.getItemAsync('last_org_sync_timestamp');
      return timestamp || '2000-01-01T00:00:00Z';
    }
  }

  // Set last sync timestamp in storage
  private async setLastSyncTimestamp(timestamp: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem('last_org_sync_timestamp', timestamp);
    } else {
      await SecureStore.setItemAsync('last_org_sync_timestamp', timestamp);
    }
  }
}

export default ExternalOrganizationService;