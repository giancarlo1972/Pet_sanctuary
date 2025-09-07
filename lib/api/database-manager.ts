import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { ExternalOrganizationData } from './external-org-service';

// Database schema version for migrations
const SCHEMA_VERSION = 1;

// Database table and schema definitions
const TABLES = {
  ORGANIZATIONS: 'organizations',
  SERVICES: 'organization_services',
  METADATA: 'organization_metadata',
  SYNC_STATUS: 'sync_status'
};

interface LocalOrganization {
  id: string;
  external_id: string;
  name: string;
  description: string;
  type: string;
  email: string;
  phone: string;
  website?: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude: number;
  longitude: number;
  animal_capacity: number;
  staff_count?: number;
  operating_hours: string; // JSON stringified
  last_updated: string;
  synced_at: string;
}

interface LocalOrganizationService {
  id: string;
  organization_id: string;
  service_name: string;
}

interface LocalOrganizationMetadata {
  id: string;
  organization_id: string;
  key: string;
  value: string;
}

class DatabaseManager {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;
  private migrationInProgress = false;

  constructor() {
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // SQLite is not supported on web
      if (Platform.OS === 'web') {
        console.log('SQLite is not supported on web. Using alternative storage method.');
        this.isInitialized = true;
        return;
      }

      // Open or create the database
      this.db = SQLite.openDatabase('organizationsDb.db');
      
      // Check schema version and perform migrations if needed
      await this.checkAndMigrateSchema();
      
      this.isInitialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async checkAndMigrateSchema(): Promise<void> {
    if (!this.db || this.migrationInProgress) {
      return;
    }

    this.migrationInProgress = true;
    
    try {
      // Create version table if it doesn't exist
      await this.executeSql(`
        CREATE TABLE IF NOT EXISTS version (
          id INTEGER PRIMARY KEY NOT NULL,
          version INTEGER NOT NULL
        );
      `);

      // Get current schema version
      const result = await this.executeSql('SELECT version FROM version ORDER BY id DESC LIMIT 1');
      const currentVersion = result.rows.length > 0 ? result.rows.item(0).version : 0;

      if (currentVersion < SCHEMA_VERSION) {
        console.log(`Migrating database from version ${currentVersion} to ${SCHEMA_VERSION}`);
        
        // Start transaction
        await this.executeSql('BEGIN TRANSACTION');
        
        // Perform migrations based on current version
        if (currentVersion < 1) {
          // Initial schema creation
          await this.createInitialSchema();
        }
        
        // Update the schema version
        if (currentVersion === 0) {
          await this.executeSql('INSERT INTO version (version) VALUES (?)', [SCHEMA_VERSION]);
        } else {
          await this.executeSql('UPDATE version SET version = ?', [SCHEMA_VERSION]);
        }
        
        // Commit transaction
        await this.executeSql('COMMIT');
        
        console.log('Database migration completed successfully');
      }
    } catch (error) {
      console.error('Database migration failed:', error);
      // Rollback transaction on error
      await this.executeSql('ROLLBACK');
      throw error;
    } finally {
      this.migrationInProgress = false;
    }
  }

  private async createInitialSchema(): Promise<void> {
    // Create organizations table
    await this.executeSql(`
      CREATE TABLE IF NOT EXISTS ${TABLES.ORGANIZATIONS} (
        id TEXT PRIMARY KEY NOT NULL,
        external_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        website TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        postal_code TEXT,
        country TEXT,
        latitude REAL,
        longitude REAL,
        animal_capacity INTEGER,
        staff_count INTEGER,
        operating_hours TEXT,
        last_updated TEXT,
        synced_at TEXT,
        UNIQUE(external_id)
      );
    `);

    // Create organization services table
    await this.executeSql(`
      CREATE TABLE IF NOT EXISTS ${TABLES.SERVICES} (
        id TEXT PRIMARY KEY NOT NULL,
        organization_id TEXT NOT NULL,
        service_name TEXT NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES ${TABLES.ORGANIZATIONS} (id) ON DELETE CASCADE,
        UNIQUE(organization_id, service_name)
      );
    `);

    // Create organization metadata table
    await this.executeSql(`
      CREATE TABLE IF NOT EXISTS ${TABLES.METADATA} (
        id TEXT PRIMARY KEY NOT NULL,
        organization_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        FOREIGN KEY (organization_id) REFERENCES ${TABLES.ORGANIZATIONS} (id) ON DELETE CASCADE,
        UNIQUE(organization_id, key)
      );
    `);

    // Create sync status table
    await this.executeSql(`
      CREATE TABLE IF NOT EXISTS ${TABLES.SYNC_STATUS} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        last_sync_time TEXT NOT NULL,
        record_count INTEGER NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT
      );
    `);

    // Create indexes for better performance
    await this.executeSql(`CREATE INDEX IF NOT EXISTS idx_org_type ON ${TABLES.ORGANIZATIONS} (type);`);
    await this.executeSql(`CREATE INDEX IF NOT EXISTS idx_org_location ON ${TABLES.ORGANIZATIONS} (city, state, country);`);
    await this.executeSql(`CREATE INDEX IF NOT EXISTS idx_org_coords ON ${TABLES.ORGANIZATIONS} (latitude, longitude);`);
    await this.executeSql(`CREATE INDEX IF NOT EXISTS idx_services_org ON ${TABLES.SERVICES} (organization_id);`);
    await this.executeSql(`CREATE INDEX IF NOT EXISTS idx_metadata_org ON ${TABLES.METADATA} (organization_id);`);
    await this.executeSql(`CREATE INDEX IF NOT EXISTS idx_metadata_key ON ${TABLES.METADATA} (key);`);
  }

  private async executeSql(sql: string, params: any[] = []): Promise<SQLite.SQLResultSet> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject(new Error('Database not initialized'));
      }

      this.db.exec([{ sql, args: params }], false, (err, resultSet) => {
        if (err) {
          return reject(err);
        }
        
        if (resultSet && resultSet.length > 0) {
          return resolve(resultSet[0]);
        }
        
        return reject(new Error('Execution failed with no error message'));
      });
    });
  }

  // Store an organization in the local database
  async storeOrganization(organization: ExternalOrganizationData): Promise<string> {
    try {
      if (!this.db) {
        if (Platform.OS === 'web') {
          // Alternative storage for web
          this.storeOrganizationInLocalStorage(organization);
          return organization.id;
        } else {
          throw new Error('Database not initialized');
        }
      }

      // Generate a local ID
      const localId = `org_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      // Map the external organization data to local schema
      const localOrg: LocalOrganization = {
        id: localId,
        external_id: organization.id,
        name: organization.name,
        description: organization.description,
        type: organization.type,
        email: organization.contactInfo.email,
        phone: organization.contactInfo.phone,
        website: organization.contactInfo.website,
        address: `${organization.location.address.street}, ${organization.location.address.city}, ${organization.location.address.state} ${organization.location.address.postalCode}`,
        city: organization.location.address.city,
        state: organization.location.address.state,
        postal_code: organization.location.address.postalCode,
        country: organization.location.address.country,
        latitude: organization.location.coordinates.latitude,
        longitude: organization.location.coordinates.longitude,
        animal_capacity: organization.animalCapacity,
        staff_count: organization.staffCount,
        operating_hours: JSON.stringify(organization.operationalHours),
        last_updated: organization.lastUpdated,
        synced_at: new Date().toISOString()
      };

      // Begin transaction
      await this.executeSql('BEGIN TRANSACTION');

      // Insert or update the organization
      await this.executeSql(
        `INSERT OR REPLACE INTO ${TABLES.ORGANIZATIONS} 
         (id, external_id, name, description, type, email, phone, website, address, 
          city, state, postal_code, country, latitude, longitude, animal_capacity, 
          staff_count, operating_hours, last_updated, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          localOrg.id, localOrg.external_id, localOrg.name, localOrg.description,
          localOrg.type, localOrg.email, localOrg.phone, localOrg.website, localOrg.address,
          localOrg.city, localOrg.state, localOrg.postal_code, localOrg.country,
          localOrg.latitude, localOrg.longitude, localOrg.animal_capacity,
          localOrg.staff_count, localOrg.operating_hours, localOrg.last_updated, localOrg.synced_at
        ]
      );

      // Clear existing services for this organization
      await this.executeSql(
        `DELETE FROM ${TABLES.SERVICES} WHERE organization_id = ?`,
        [localId]
      );

      // Insert services
      for (const service of organization.services) {
        const serviceId = `svc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        await this.executeSql(
          `INSERT INTO ${TABLES.SERVICES} (id, organization_id, service_name)
           VALUES (?, ?, ?)`,
          [serviceId, localId, service]
        );
      }

      // Clear existing metadata for this organization
      await this.executeSql(
        `DELETE FROM ${TABLES.METADATA} WHERE organization_id = ?`,
        [localId]
      );

      // Insert metadata
      for (const [key, value] of Object.entries(organization.metadata)) {
        const metaId = `meta_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        
        await this.executeSql(
          `INSERT INTO ${TABLES.METADATA} (id, organization_id, key, value)
           VALUES (?, ?, ?, ?)`,
          [metaId, localId, key, stringValue]
        );
      }

      // Commit transaction
      await this.executeSql('COMMIT');

      console.log(`Organization ${organization.name} (ID: ${organization.id}) stored successfully`);
      return localId;
    } catch (error) {
      // Rollback transaction on error
      if (this.db) {
        await this.executeSql('ROLLBACK');
      }
      console.error('Failed to store organization:', error);
      throw error;
    }
  }

  // Store RescueGroups organization with enhanced metadata
  private async storeRescueGroupsOrganization(organization: ExternalOrganizationData): Promise<string> {
    try {
      if (!this.db) {
        if (Platform.OS === 'web') {
          this.storeRescueGroupsInLocalStorage(organization);
          return organization.id;
        } else {
          throw new Error('Database not initialized');
        }
      }

      const localId = `rg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      // Enhanced mapping for RescueGroups data
      const localOrg: LocalOrganization = {
        id: localId,
        external_id: organization.id,
        name: organization.name,
        description: organization.description,
        type: organization.type,
        email: organization.contactInfo.email,
        phone: organization.contactInfo.phone,
        website: organization.contactInfo.website,
        address: `${organization.location.address.street}, ${organization.location.address.city}, ${organization.location.address.state} ${organization.location.address.postalCode}`,
        city: organization.location.address.city,
        state: organization.location.address.state,
        postal_code: organization.location.address.postalCode,
        country: organization.location.address.country,
        latitude: organization.location.coordinates.latitude,
        longitude: organization.location.coordinates.longitude,
        animal_capacity: organization.animalCapacity,
        staff_count: organization.staffCount,
        operating_hours: JSON.stringify(organization.operationalHours),
        last_updated: organization.lastUpdated,
        synced_at: new Date().toISOString()
      };

      // Begin transaction
      await this.executeSql('BEGIN TRANSACTION');

      // Insert organization with RescueGroups tag
      await this.executeSql(
        `INSERT OR REPLACE INTO ${TABLES.ORGANIZATIONS} 
         (id, external_id, name, description, type, email, phone, website, address, 
          city, state, postal_code, country, latitude, longitude, animal_capacity, 
          staff_count, operating_hours, last_updated, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          localOrg.id, localOrg.external_id, localOrg.name, localOrg.description,
          localOrg.type, localOrg.email, localOrg.phone, localOrg.website, localOrg.address,
          localOrg.city, localOrg.state, localOrg.postal_code, localOrg.country,
          localOrg.latitude, localOrg.longitude, localOrg.animal_capacity,
          localOrg.staff_count, localOrg.operating_hours, localOrg.last_updated, localOrg.synced_at
        ]
      );

      // Store RescueGroups-specific metadata
      const metaId = `meta_${Date.now()}_rescuegroups_source`;
      await this.executeSql(
        `INSERT OR REPLACE INTO ${TABLES.METADATA} (id, organization_id, key, value)
         VALUES (?, ?, ?, ?)`,
        [metaId, localId, 'rescuegroups_source', 'true']
      );

      // Store services
      await this.executeSql(
        `DELETE FROM ${TABLES.SERVICES} WHERE organization_id = ?`,
        [localId]
      );

      for (const service of organization.services) {
        const serviceId = `svc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        await this.executeSql(
          `INSERT INTO ${TABLES.SERVICES} (id, organization_id, service_name)
           VALUES (?, ?, ?)`,
          [serviceId, localId, service]
        );
      }

      await this.executeSql('COMMIT');
      console.log(`RescueGroups organization ${organization.name} stored successfully`);
      return localId;
    } catch (error) {
      if (this.db) {
        await this.executeSql('ROLLBACK');
      }
      console.error('Failed to store RescueGroups organization:', error);
      throw error;
    }
  }

  private storeRescueGroupsInLocalStorage(organization: ExternalOrganizationData): void {
    try {
      const storedOrgs = localStorage.getItem('rescueGroupsOrganizations');
      const organizations = storedOrgs ? JSON.parse(storedOrgs) : [];
      
      const index = organizations.findIndex((org: any) => org.id === organization.id);
      
      const enhancedOrg = {
        ...organization,
        source: 'RescueGroups.org',
        apiKey: '5yZd7GC8',
        synced_at: new Date().toISOString()
      };
      
      if (index >= 0) {
        organizations[index] = enhancedOrg;
      } else {
        organizations.push(enhancedOrg);
      }
      
      localStorage.setItem('rescueGroupsOrganizations', JSON.stringify(organizations));
      console.log(`RescueGroups organization ${organization.name} stored in localStorage`);
    } catch (error) {
      console.error('Failed to store RescueGroups organization in localStorage:', error);
      throw error;
    }
  }

  // Alternative storage method for web platform
  private storeOrganizationInLocalStorage(organization: ExternalOrganizationData): void {
    try {
      // Get existing organizations
      const storedOrgs = localStorage.getItem('externalOrganizations');
      const organizations = storedOrgs ? JSON.parse(storedOrgs) : [];
      
      // Check if organization already exists
      const index = organizations.findIndex((org: any) => org.id === organization.id);
      
      if (index >= 0) {
        // Update existing organization
        organizations[index] = {
          ...organization,
          synced_at: new Date().toISOString()
        };
      } else {
        // Add new organization
        organizations.push({
          ...organization,
          synced_at: new Date().toISOString()
        });
      }
      
      // Save back to localStorage
      localStorage.setItem('externalOrganizations', JSON.stringify(organizations));
      
      console.log(`Organization ${organization.name} (ID: ${organization.id}) stored in localStorage`);
    } catch (error) {
      console.error('Failed to store organization in localStorage:', error);
      throw error;
    }
  }

  // Query organizations with filtering
  async queryOrganizations(filters: {
    type?: string;
    city?: string;
    state?: string;
    service?: string;
    searchTerm?: string;
    withinKm?: {
      latitude: number;
      longitude: number;
      distance: number;
    };
    limit?: number;
    offset?: number;
  } = {}): Promise<any[]> {
    try {
      if (!this.db) {
        if (Platform.OS === 'web') {
          // Alternative query for web
          return this.queryOrganizationsFromLocalStorage(filters);
        } else {
          throw new Error('Database not initialized');
        }
      }

      // Build the query
      let query = `SELECT o.* FROM ${TABLES.ORGANIZATIONS} o`;
      const params: any[] = [];
      const whereConditions: string[] = [];
      
      // Join with services table if filtering by service
      if (filters.service) {
        query += ` INNER JOIN ${TABLES.SERVICES} s ON o.id = s.organization_id`;
        whereConditions.push('s.service_name = ?');
        params.push(filters.service);
      }

      // Apply filters
      if (filters.type) {
        whereConditions.push('o.type = ?');
        params.push(filters.type);
      }
      
      if (filters.city) {
        whereConditions.push('o.city = ?');
        params.push(filters.city);
      }
      
      if (filters.state) {
        whereConditions.push('o.state = ?');
        params.push(filters.state);
      }
      
      if (filters.searchTerm) {
        whereConditions.push(`(o.name LIKE ? OR o.description LIKE ?)`);
        const searchPattern = `%${filters.searchTerm}%`;
        params.push(searchPattern, searchPattern);
      }
      
      // Geographic radius search
      if (filters.withinKm) {
        // Haversine formula to calculate distance between two points on the Earth
        whereConditions.push(`
          (6371 * acos(
            cos(radians(?)) * cos(radians(o.latitude)) * cos(radians(o.longitude) - radians(?)) +
            sin(radians(?)) * sin(radians(o.latitude))
          )) <= ?
        `);
        params.push(
          filters.withinKm.latitude,
          filters.withinKm.longitude,
          filters.withinKm.latitude,
          filters.withinKm.distance
        );
      }
      
      // Add WHERE clause if any conditions exist
      if (whereConditions.length > 0) {
        query += ' WHERE ' + whereConditions.join(' AND ');
      }
      
      // Add ordering, limit and offset
      query += ' ORDER BY o.name ASC';
      
      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
        
        if (filters.offset) {
          query += ' OFFSET ?';
          params.push(filters.offset);
        }
      }
      
      // Execute the query
      const result = await this.executeSql(query, params);
      
      // Convert result to array of objects
      const organizations = [];
      for (let i = 0; i < result.rows.length; i++) {
        const org = result.rows.item(i);
        
        // Get services for this organization
        const servicesResult = await this.executeSql(
          `SELECT service_name FROM ${TABLES.SERVICES} WHERE organization_id = ?`,
          [org.id]
        );
        
        const services = [];
        for (let j = 0; j < servicesResult.rows.length; j++) {
          services.push(servicesResult.rows.item(j).service_name);
        }
        
        // Get metadata for this organization
        const metadataResult = await this.executeSql(
          `SELECT key, value FROM ${TABLES.METADATA} WHERE organization_id = ?`,
          [org.id]
        );
        
        const metadata: Record<string, any> = {};
        for (let j = 0; j < metadataResult.rows.length; j++) {
          const item = metadataResult.rows.item(j);
          try {
            // Attempt to parse JSON values
            metadata[item.key] = JSON.parse(item.value);
          } catch (e) {
            // If not JSON, store as string
            metadata[item.key] = item.value;
          }
        }
        
        // Parse operating hours JSON
        let operatingHours = {};
        try {
          operatingHours = JSON.parse(org.operating_hours);
        } catch (e) {
          console.warn(`Failed to parse operating hours for organization ${org.id}`);
        }
        
        // Add to results
        organizations.push({
          id: org.id,
          externalId: org.external_id,
          name: org.name,
          description: org.description,
          type: org.type,
          contactInfo: {
            email: org.email,
            phone: org.phone,
            website: org.website,
          },
          location: {
            address: {
              full: org.address,
              city: org.city,
              state: org.state,
              postalCode: org.postal_code,
              country: org.country,
            },
            coordinates: {
              latitude: org.latitude,
              longitude: org.longitude,
            },
          },
          operationalHours: operatingHours,
          services,
          animalCapacity: org.animal_capacity,
          staffCount: org.staff_count,
          metadata,
          lastUpdated: org.last_updated,
          syncedAt: org.synced_at,
        });
      }
      
      return organizations;
    } catch (error) {
      console.error('Failed to query organizations:', error);
      throw error;
    }
  }

  // Query from localStorage for web platform
  private queryOrganizationsFromLocalStorage(filters: any = {}): any[] {
    try {
      // Get organizations from localStorage
      const storedOrgs = localStorage.getItem('externalOrganizations');
      if (!storedOrgs) {
        return [];
      }
      
      const organizations = JSON.parse(storedOrgs);
      
      // Filter the organizations
      return organizations.filter((org: any) => {
        let matches = true;
        
        if (filters.type && org.type !== filters.type) {
          matches = false;
        }
        
        if (matches && filters.city && org.location?.address?.city !== filters.city) {
          matches = false;
        }
        
        if (matches && filters.state && org.location?.address?.state !== filters.state) {
          matches = false;
        }
        
        if (matches && filters.service && !org.services?.includes(filters.service)) {
          matches = false;
        }
        
        if (matches && filters.searchTerm) {
          const searchTerm = filters.searchTerm.toLowerCase();
          const nameMatches = org.name?.toLowerCase().includes(searchTerm);
          const descMatches = org.description?.toLowerCase().includes(searchTerm);
          
          if (!nameMatches && !descMatches) {
            matches = false;
          }
        }
        
        // Geographic filtering would require additional implementation
        
        return matches;
      }).slice(0, filters.limit || organizations.length);
    } catch (error) {
      console.error('Failed to query organizations from localStorage:', error);
      return [];
    }
  }

  // Get all unique cities where organizations exist
  async getAllCities(): Promise<string[]> {
    if (!this.db) {
      if (Platform.OS === 'web') {
        return this.getAllCitiesFromLocalStorage();
      } else {
        throw new Error('Database not initialized');
      }
    }
    
    try {
      const result = await this.executeSql(
        `SELECT DISTINCT city FROM ${TABLES.ORGANIZATIONS} ORDER BY city ASC`
      );
      
      const cities = [];
      for (let i = 0; i < result.rows.length; i++) {
        cities.push(result.rows.item(i).city);
      }
      
      return cities;
    } catch (error) {
      console.error('Failed to get all cities:', error);
      throw error;
    }
  }

  // Get cities from localStorage for web platform
  private getAllCitiesFromLocalStorage(): string[] {
    try {
      const storedOrgs = localStorage.getItem('externalOrganizations');
      if (!storedOrgs) {
        return [];
      }
      
      const organizations = JSON.parse(storedOrgs);
      
      // Extract unique cities
      const cities = new Set<string>();
      organizations.forEach((org: any) => {
        if (org.location?.address?.city) {
          cities.add(org.location.address.city);
        }
      });
      
      return Array.from(cities).sort();
    } catch (error) {
      console.error('Failed to get cities from localStorage:', error);
      return [];
    }
  }

  // Get all unique services offered by organizations
  async getAllServices(): Promise<string[]> {
    if (!this.db) {
      if (Platform.OS === 'web') {
        return this.getAllServicesFromLocalStorage();
      } else {
        throw new Error('Database not initialized');
      }
    }
    
    try {
      const result = await this.executeSql(
        `SELECT DISTINCT service_name FROM ${TABLES.SERVICES} ORDER BY service_name ASC`
      );
      
      const services = [];
      for (let i = 0; i < result.rows.length; i++) {
        services.push(result.rows.item(i).service_name);
      }
      
      return services;
    } catch (error) {
      console.error('Failed to get all services:', error);
      throw error;
    }
  }

  // Get services from localStorage for web platform
  private getAllServicesFromLocalStorage(): string[] {
    try {
      const storedOrgs = localStorage.getItem('externalOrganizations');
      if (!storedOrgs) {
        return [];
      }
      
      const organizations = JSON.parse(storedOrgs);
      
      // Extract unique services
      const services = new Set<string>();
      organizations.forEach((org: any) => {
        if (org.services && Array.isArray(org.services)) {
          org.services.forEach((service: string) => {
            services.add(service);
          });
        }
      });
      
      return Array.from(services).sort();
    } catch (error) {
      console.error('Failed to get services from localStorage:', error);
      return [];
    }
  }

  // Get the latest sync status
  async getLatestSyncStatus(): Promise<any> {
    if (!this.db) {
      return {
        lastSyncTime: localStorage.getItem('last_org_sync_timestamp') || null,
        status: 'unknown',
        recordCount: 0
      };
    }
    
    try {
      const result = await this.executeSql(
        `SELECT * FROM ${TABLES.SYNC_STATUS} WHERE entity_type = 'organizations'
         ORDER BY id DESC LIMIT 1`
      );
      
      if (result.rows.length > 0) {
        return result.rows.item(0);
      }
      
      return {
        lastSyncTime: null,
        status: 'never',
        recordCount: 0
      };
    } catch (error) {
      console.error('Failed to get sync status:', error);
      throw error;
    }
  }

  // Record a sync status
  async recordSyncStatus(entityType: string, status: string, recordCount: number, errorMessage?: string): Promise<void> {
    if (!this.db) {
      return;
    }
    
    try {
      await this.executeSql(
        `INSERT INTO ${TABLES.SYNC_STATUS} (entity_type, last_sync_time, record_count, status, error_message)
         VALUES (?, ?, ?, ?, ?)`,
        [entityType, new Date().toISOString(), recordCount, status, errorMessage || null]
      );
      
      console.log(`Sync status recorded: ${entityType}, ${status}, ${recordCount} records`);
    } catch (error) {
      console.error('Failed to record sync status:', error);
    }
  }

  // Get organization by ID
  async getOrganizationById(id: string): Promise<any | null> {
    try {
      if (!this.db) {
        if (Platform.OS === 'web') {
          return this.getOrganizationByIdFromLocalStorage(id);
        } else {
          throw new Error('Database not initialized');
        }
      }

      // Query organization
      const result = await this.executeSql(
        `SELECT * FROM ${TABLES.ORGANIZATIONS} WHERE id = ? OR external_id = ?`,
        [id, id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const org = result.rows.item(0);
      
      // Get services
      const servicesResult = await this.executeSql(
        `SELECT service_name FROM ${TABLES.SERVICES} WHERE organization_id = ?`,
        [org.id]
      );
      
      const services = [];
      for (let i = 0; i < servicesResult.rows.length; i++) {
        services.push(servicesResult.rows.item(i).service_name);
      }
      
      // Get metadata
      const metadataResult = await this.executeSql(
        `SELECT key, value FROM ${TABLES.METADATA} WHERE organization_id = ?`,
        [org.id]
      );
      
      const metadata: Record<string, any> = {};
      for (let i = 0; i < metadataResult.rows.length; i++) {
        const item = metadataResult.rows.item(i);
        try {
          metadata[item.key] = JSON.parse(item.value);
        } catch (e) {
          metadata[item.key] = item.value;
        }
      }
      
      // Parse operating hours
      let operatingHours = {};
      try {
        operatingHours = JSON.parse(org.operating_hours);
      } catch (e) {
        console.warn(`Failed to parse operating hours for organization ${org.id}`);
      }
      
      // Return the full organization object
      return {
        id: org.id,
        externalId: org.external_id,
        name: org.name,
        description: org.description,
        type: org.type,
        contactInfo: {
          email: org.email,
          phone: org.phone,
          website: org.website,
        },
        location: {
          address: {
            full: org.address,
            city: org.city,
            state: org.state,
            postalCode: org.postal_code,
            country: org.country,
          },
          coordinates: {
            latitude: org.latitude,
            longitude: org.longitude,
          },
        },
        operationalHours: operatingHours,
        services,
        animalCapacity: org.animal_capacity,
        staffCount: org.staff_count,
        metadata,
        lastUpdated: org.last_updated,
        syncedAt: org.synced_at,
      };
    } catch (error) {
      console.error(`Failed to get organization by ID ${id}:`, error);
      throw error;
    }
  }

  // Get organization by ID from localStorage for web platform
  private getOrganizationByIdFromLocalStorage(id: string): any | null {
    try {
      const storedOrgs = localStorage.getItem('externalOrganizations');
      if (!storedOrgs) {
        return null;
      }
      
      const organizations = JSON.parse(storedOrgs);
      return organizations.find((org: any) => org.id === id || org.external_id === id) || null;
    } catch (error) {
      console.error(`Failed to get organization ${id} from localStorage:`, error);
      return null;
    }
  }

  // Delete database (for testing/reset purposes)
  async deleteDatabase(): Promise<void> {
    if (Platform.OS === 'web') {
      // Clear localStorage
      localStorage.removeItem('externalOrganizations');
      localStorage.removeItem('last_org_sync_timestamp');
      console.log('Local storage cleared');
      return;
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Close database connection
      this.db.closeAsync();
      this.db = null;
      this.isInitialized = false;

      // Delete database file
      const dbDir = `${FileSystem.documentDirectory}SQLite/`;
      await FileSystem.deleteAsync(`${dbDir}organizationsDb.db`, { idempotent: true });
      console.log('Database deleted successfully');

      // Reinitialize database
      await this.initializeDatabase();
    } catch (error) {
      console.error('Failed to delete database:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export default new DatabaseManager();