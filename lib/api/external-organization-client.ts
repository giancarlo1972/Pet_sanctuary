import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

interface ApiConfiguration {
  apiKey: string;
  baseUrl: string;
  timeout?: number;
  retryAttempts?: number;
  syncInterval?: number;
}

interface ExternalOrganization {
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
  operationalHours: Record<string, string>;
  services: string[];
  animalCapacity: number;
  staffCount?: number;
  metadata: Record<string, any>;
  lastUpdated: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  metadata?: {
    page?: number;
    totalPages?: number;
    totalRecords?: number;
    nextPage?: string;
  };
  error?: string;
}

class ExternalOrganizationClient {
  private config: ApiConfiguration | null = null;
  private isConfigured = false;

  async configure(config: ApiConfiguration): Promise<void> {
    this.config = config;
    this.isConfigured = true;

    // Store configuration securely
    await this.storeConfig(config);
  }

  async loadStoredConfig(): Promise<boolean> {
    try {
      const storedConfig = await this.getStoredConfig();
      if (storedConfig) {
        this.config = storedConfig;
        this.isConfigured = true;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to load stored config:', error);
      return false;
    }
  }

  private async storeConfig(config: ApiConfiguration): Promise<void> {
    const configData = JSON.stringify(config);
    
    if (Platform.OS === 'web') {
      localStorage.setItem('external_org_config', configData);
    } else {
      await SecureStore.setItemAsync('external_org_config', configData);
    }
  }

  private async getStoredConfig(): Promise<ApiConfiguration | null> {
    try {
      let configData: string | null = null;
      
      if (Platform.OS === 'web') {
        configData = localStorage.getItem('external_org_config');
      } else {
        configData = await SecureStore.getItemAsync('external_org_config');
      }
      
      return configData ? JSON.parse(configData) : null;
    } catch (error) {
      console.error('Error retrieving stored config:', error);
      return null;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured || !this.config) {
      throw new Error('Client not configured');
    }

    try {
      const response = await this.makeApiRequest('/health', 'GET');
      return response.success;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async fetchOrganizations(options: {
    page?: number;
    limit?: number;
    type?: string;
    city?: string;
    state?: string;
    service?: string;
    searchTerm?: string;
    location?: {
      latitude: number;
      longitude: number;
      radius: number;
    };
  } = {}): Promise<ExternalOrganization[]> {
    if (!this.isConfigured || !this.config) {
      throw new Error('Client not configured');
    }

    const params = new URLSearchParams();
    
    // Add pagination parameters
    if (options.page) params.append('page', options.page.toString());
    if (options.limit) params.append('limit', options.limit.toString());
    
    // Add filter parameters
    if (options.type) params.append('type', options.type);
    if (options.city) params.append('city', options.city);
    if (options.state) params.append('state', options.state);
    if (options.service) params.append('service', options.service);
    if (options.searchTerm) params.append('q', options.searchTerm);
    
    // Add location-based search
    if (options.location) {
      params.append('lat', options.location.latitude.toString());
      params.append('lng', options.location.longitude.toString());
      params.append('radius', options.location.radius.toString());
    }

    const endpoint = `/organizations?${params.toString()}`;
    const response = await this.makeApiRequest(endpoint, 'GET');
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch organizations');
    }

    return response.data;
  }

  async fetchOrganizationById(id: string): Promise<ExternalOrganization> {
    if (!this.isConfigured || !this.config) {
      throw new Error('Client not configured');
    }

    const response = await this.makeApiRequest(`/organizations/${id}`, 'GET');
    
    if (!response.success) {
      throw new Error(response.error || 'Organization not found');
    }

    return response.data;
  }

  async syncOrganizations(): Promise<{
    totalSynced: number;
    lastSyncTime: string;
    errors: string[];
  }> {
    if (!this.isConfigured || !this.config) {
      throw new Error('Client not configured');
    }

    let totalSynced = 0;
    const errors: string[] = [];
    let page = 1;
    const limit = 50;
    let hasMore = true;

    try {
      while (hasMore) {
        const organizations = await this.fetchOrganizations({ page, limit });
        
        if (organizations.length === 0) {
          hasMore = false;
          break;
        }

        // Process this batch
        for (const org of organizations) {
          try {
            // Store in local database via API endpoint
            const storeResponse = await fetch('/api/external-organizations', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(org),
            });

            if (storeResponse.ok) {
              totalSynced++;
            } else {
              errors.push(`Failed to store ${org.name}`);
            }
          } catch (error) {
            errors.push(`Error storing ${org.name}: ${error}`);
          }
        }

        // Check if we have more pages
        hasMore = organizations.length === limit;
        page++;

        // Add a small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return {
        totalSynced,
        lastSyncTime: new Date().toISOString(),
        errors,
      };
    } catch (error) {
      console.error('Sync process failed:', error);
      throw error;
    }
  }

  private async makeApiRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<ApiResponse<any>> {
    if (!this.config) {
      throw new Error('Client not configured');
    }

    const url = `${this.config.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'X-API-Key': this.config.apiKey,
    };

    const requestOptions: RequestInit = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    };

    const maxRetries = this.config.retryAttempts || 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, requestOptions);
        
        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            data: data.data || data,
            metadata: data.metadata,
          };
        } else {
          const errorData = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorData}`);
        }
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    return {
      success: false,
      data: null,
      error: lastError?.message || 'Request failed after retries',
    };
  }

  isClientConfigured(): boolean {
    return this.isConfigured;
  }

  getConfiguration(): ApiConfiguration | null {
    return this.config;
  }
}

// Export singleton instance
export default new ExternalOrganizationClient();