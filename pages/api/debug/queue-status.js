import { jobQueue } from '../../../lib/jobQueue.js';
import { SyncJobModel } from '../../../lib/models.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get queue status
    const queueStatus = await jobQueue.getQueueStatus();
    
    // Get recent jobs
    const [activeJobs, pendingJobs, recentCompleted, recentFailed] = await Promise.all([
      SyncJobModel.getJobsByStatus('running', 10),
      SyncJobModel.getJobsByStatus('pending', 10),
      SyncJobModel.getJobsByStatus('completed', 5),
      SyncJobModel.getJobsByStatus('failed', 5)
    ]);

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      queue: queueStatus,
      jobs: {
        active: activeJobs,
        pending: pendingJobs,
        recentCompleted: recentCompleted.map(job => ({
          id: job.id,
          feedId: job.feedId,
          itemsProcessed: job.itemsProcessed,
          completedAt: job.completedAt
        })),
        recentFailed: recentFailed.map(job => ({
          id: job.id,
          feedId: job.feedId,
          error: job.error,
          completedAt: job.completedAt
        }))
      },
      stats: {
        totalActive: activeJobs.length,
        totalPending: pendingJobs.length,
        totalCompleted: recentCompleted.length,
        totalFailed: recentFailed.length
      }
    });

  } catch (error) {
    console.error('Debug queue status error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
}