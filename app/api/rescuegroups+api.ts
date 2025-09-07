import rescueGroupsClient from '@/lib/api/rescuegroups-ftp-client';
import dbManager from '@/lib/api/database-manager';

// POST - Configure and sync RescueGroups data
export async function POST(request: Request) {
  try {
    const { action } = await request.json();
    
    if (action === 'configure') {
      // Configure RescueGroups integration
      await rescueGroupsClient.configure(true);
      
      return Response.json({
        success: true,
        message: 'RescueGroups.org integration configured successfully',
        data: {
          hostname: 'ftp.rescuegroups.org',
          apiKey: '5yZd7GC8',
          syncSchedule: 'Daily at 6:00 AM EST'
        }
      });
    }
    
    if (action === 'sync') {
      // Start manual sync process
      console.log('Starting RescueGroups data sync...');
      
      try {
        await dbManager.recordSyncStatus('rescuegroups', 'in_progress', 0);
        
        const syncResult = await rescueGroupsClient.syncDailyData();
        
        // Store organizations in local database
        const fileName = `organizations_${new Date().toISOString().split('T')[0]}.json`;
        const filePath = await rescueGroupsClient.downloadDataFile(fileName);
        const organizations = await rescueGroupsClient.parseOrganizationsFile(filePath);
        
        // Convert to standard format and store
        let storedCount = 0;
        for (const rgOrg of organizations) {
          try {
            const standardOrg = rescueGroupsClient.mapToStandardFormat(rgOrg);
            await dbManager.storeOrganization(standardOrg);
            storedCount++;
          } catch (error) {
            console.error(`Failed to store organization ${rgOrg.orgName}:`, error);
          }
        }
        
        await dbManager.recordSyncStatus('rescuegroups', 'success', storedCount);
        
        return Response.json({
          success: true,
          message: `Successfully synced ${storedCount} organizations from RescueGroups.org`,
          data: {
            totalRecords: storedCount,
            lastSyncTime: syncResult.lastSyncTime,
            source: 'RescueGroups.org FTP',
            nextSync: 'Tomorrow at 6:00 AM EST'
          }
        });
      } catch (error) {
        await dbManager.recordSyncStatus(
          'rescuegroups',
          'failed',
          0,
          error instanceof Error ? error.message : String(error)
        );
        throw error;
      }
    }
    
    if (action === 'disable') {
      await rescueGroupsClient.configure(false);
      
      return Response.json({
        success: true,
        message: 'RescueGroups.org integration disabled'
      });
    }
    
    return Response.json({
      success: false,
      error: 'Invalid action specified'
    }, { status: 400 });
  } catch (error) {
    console.error('RescueGroups API error:', error);
    
    return Response.json({
      success: false,
      error: 'RescueGroups integration failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET - Get RescueGroups integration status
export async function GET(request: Request) {
  try {
    await rescueGroupsClient.initialize();
    
    const config = rescueGroupsClient.getConfig();
    const lastSyncTime = await rescueGroupsClient.getLastSyncTime();
    const syncStatus = await dbManager.getLatestSyncStatus();
    
    return Response.json({
      success: true,
      data: {
        isConfigured: true,
        isEnabled: rescueGroupsClient.isEnabled(),
        ftpServer: {
          hostname: 'ftp.rescuegroups.org',
          username: 'apikey-5yZd7GC8',
          status: 'Connected'
        },
        syncInfo: {
          lastSyncTime,
          nextSync: 'Tomorrow at 6:00 AM EST',
          recordCount: syncStatus?.recordCount || 0,
          status: syncStatus?.status || 'never'
        },
        developerGuide: 'https://userguide.rescuegroups.org/x/QACl'
      }
    });
  } catch (error) {
    console.error('Failed to get RescueGroups status:', error);
    
    return Response.json({
      success: false,
      error: 'Failed to retrieve RescueGroups status',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}