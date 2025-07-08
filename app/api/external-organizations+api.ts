import { ExternalOrganizationData } from '@/lib/api/external-org-service';
import syncScheduler from '@/lib/api/sync-scheduler';
import dbManager from '@/lib/api/database-manager';

// GET - Fetch organizations (with optional filtering)
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    
    // Extract query parameters
    const type = url.searchParams.get('type');
    const city = url.searchParams.get('city');
    const state = url.searchParams.get('state');
    const service = url.searchParams.get('service');
    const searchTerm = url.searchParams.get('q');
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');
    
    // Parse geographic query parameters if present
    let withinKm;
    const lat = url.searchParams.get('lat');
    const lng = url.searchParams.get('lng');
    const distance = url.searchParams.get('distance');
    
    if (lat && lng && distance) {
      withinKm = {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        distance: parseFloat(distance)
      };
    }
    
    // Build query filters
    const filters: any = {
      type: type || undefined,
      city: city || undefined,
      state: state || undefined,
      service: service || undefined,
      searchTerm: searchTerm || undefined,
      withinKm,
      limit: limitParam ? parseInt(limitParam, 10) : 20,
      offset: offsetParam ? parseInt(offsetParam, 10) : 0
    };
    
    // Query the database
    const organizations = await dbManager.queryOrganizations(filters);
    
    // If it's a specific ID lookup, return just that organization
    const id = url.searchParams.get('id');
    if (id) {
      const org = await dbManager.getOrganizationById(id);
      if (!org) {
        return Response.json(
          { success: false, error: 'Organization not found' },
          { status: 404 }
        );
      }
      return Response.json({ success: true, data: org });
    }

    // Return the results
    return Response.json({
      success: true,
      data: organizations,
      metadata: {
        totalRecords: organizations.length,
        limit: filters.limit,
        offset: filters.offset
      }
    });
  } catch (error) {
    console.error('Error processing organization request:', error);
    return Response.json(
      { 
        success: false, 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// POST - Force a sync operation
export async function POST(request: Request) {
  try {
    const { action } = await request.json();
    
    if (action === 'sync') {
      // Start a sync operation
      const syncStarted = await syncScheduler.forceSync();
      
      if (syncStarted) {
        return Response.json({
          success: true,
          message: 'Synchronization started successfully',
          timestamp: new Date().toISOString()
        });
      } else {
        return Response.json(
          { 
            success: false, 
            error: 'Failed to start synchronization' 
          },
          { status: 500 }
        );
      }
    }
    
    // If the action is not recognized
    return Response.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing sync request:', error);
    return Response.json(
      { 
        success: false, 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// DELETE - Clear the local database (for development/testing)
export async function DELETE(request: Request) {
  try {
    // This should be protected in production
    await dbManager.deleteDatabase();
    
    return Response.json({
      success: true,
      message: 'Database reset successfully'
    });
  } catch (error) {
    console.error('Error resetting database:', error);
    return Response.json(
      { 
        success: false, 
        error: 'Failed to reset database',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}