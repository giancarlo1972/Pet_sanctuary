import dbManager from '@/lib/api/database-manager';

// GET - Fetch sync status
export async function GET(request: Request) {
  try {
    const syncStatus = await dbManager.getLatestSyncStatus();
    
    return Response.json({
      success: true,
      data: {
        lastSyncTime: syncStatus.lastSyncTime,
        status: syncStatus.status,
        recordCount: syncStatus.recordCount,
        errorMessage: syncStatus.errorMessage
      }
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return Response.json(
      { 
        success: false, 
        error: 'Failed to fetch sync status',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}