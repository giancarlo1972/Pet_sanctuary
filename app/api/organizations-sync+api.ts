import dbManager from '@/lib/api/database-manager';
import orgClient from '@/lib/api/external-organization-client';

// POST - Start synchronization process
export async function POST(request: Request) {
  try {
    const { action, config } = await request.json();
    
    if (action === 'configure') {
      // Configure the client with new settings
      await orgClient.configure(config);
      
      return Response.json({
        success: true,
        message: 'External API configured successfully'
      });
    }
    
    if (action === 'sync') {
      // Ensure client is configured
      if (!orgClient.isClientConfigured()) {
        // Try to load stored configuration
        const configLoaded = await orgClient.loadStoredConfig();
        
        if (!configLoaded) {
          return Response.json({
            success: false,
            error: 'API client not configured. Please configure the external API first.'
          }, { status: 400 });
        }
      }
      
      // Test connection before sync
      const isConnected = await orgClient.testConnection();
      if (!isConnected) {
        return Response.json({
          success: false,
          error: 'Cannot connect to external API. Please check configuration.'
        }, { status: 503 });
      }

      // Start sync process
      console.log('Starting organization sync...');
      await dbManager.recordSyncStatus('organizations', 'in_progress', 0);
      
      const syncResult = await orgClient.syncOrganizations();
      
      // Record sync completion
      if (syncResult.errors.length === 0) {
        await dbManager.recordSyncStatus('organizations', 'success', syncResult.totalSynced);
        
        return Response.json({
          success: true,
          message: `Successfully synced ${syncResult.totalSynced} organizations`,
          data: {
            totalSynced: syncResult.totalSynced,
            lastSyncTime: syncResult.lastSyncTime,
          }
        });
      } else {
        await dbManager.recordSyncStatus(
          'organizations',
          'partial_success',
          syncResult.totalSynced,
          `${syncResult.errors.length} errors occurred`
        );
        
        return Response.json({
          success: true,
          message: `Synced ${syncResult.totalSynced} organizations with ${syncResult.errors.length} errors`,
          data: {
            totalSynced: syncResult.totalSynced,
            lastSyncTime: syncResult.lastSyncTime,
            errors: syncResult.errors,
          }
        });
      }
    }
    
    return Response.json({
      success: false,
      error: 'Invalid action specified'
    }, { status: 400 });
  } catch (error) {
    console.error('Sync API error:', error);
    
    // Record sync failure
    await dbManager.recordSyncStatus(
      'organizations',
      'failed',
      0,
      error instanceof Error ? error.message : String(error)
    );
    
    return Response.json({
      success: false,
      error: 'Synchronization failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET - Get synchronization status
export async function GET(request: Request) {
  try {
    const syncStatus = await dbManager.getLatestSyncStatus();
    
    // Check if client is configured
    const isConfigured = orgClient.isClientConfigured() || await orgClient.loadStoredConfig();
    
    return Response.json({
      success: true,
      data: {
        isConfigured,
        syncStatus,
        clientConfig: isConfigured ? {
          baseUrl: orgClient.getConfiguration()?.baseUrl,
          syncInterval: orgClient.getConfiguration()?.syncInterval,
        } : null,
      }
    });
  } catch (error) {
    console.error('Failed to get sync status:', error);
    
    return Response.json({
      success: false,
      error: 'Failed to retrieve sync status',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// DELETE - Reset sync data
export async function DELETE(request: Request) {
  try {
    await dbManager.deleteDatabase();
    
    return Response.json({
      success: true,
      message: 'Sync data reset successfully'
    });
  } catch (error) {
    console.error('Failed to reset sync data:', error);
    
    return Response.json({
      success: false,
      error: 'Failed to reset sync data',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}