import { SyncJobModel } from '../../../lib/models.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { limit = 20 } = req.query;
    
    // Get recent jobs with details
    const [running, pending, completed, failed] = await Promise.all([
      SyncJobModel.getJobsByStatus('running', 10),
      SyncJobModel.getJobsByStatus('pending', 10),
      SyncJobModel.getJobsByStatus('completed', parseInt(limit)),
      SyncJobModel.getJobsByStatus('failed', parseInt(limit))
    ]);

    const allJobs = [
      ...running.map(j => ({ ...j, status: 'running' })),
      ...pending.map(j => ({ ...j, status: 'pending' })),
      ...completed.map(j => ({ ...j, status: 'completed' })),
      ...failed.map(j => ({ ...j, status: 'failed' }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Check if cron jobs are working
    const lastJob = allJobs[0];
    const timeSinceLastJob = lastJob ? Date.now() - new Date(lastJob.createdAt).getTime() : null;
    const minutesSinceLastJob = timeSinceLastJob ? Math.floor(timeSinceLastJob / 1000 / 60) : null;

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        running: running.length,
        pending: pending.length,
        completed: completed.length,
        failed: failed.length,
        total: allJobs.length,
        lastJobAgo: minutesSinceLastJob ? `${minutesSinceLastJob} minutes ago` : 'No jobs found',
        cronWorking: minutesSinceLastJob < 10 // Jobs should be created every 5 minutes
      },
      recentJobs: allJobs.slice(0, parseInt(limit)).map(job => ({
        id: job.id,
        feedId: job.feedId,
        status: job.status,
        type: job.type,
        itemsProcessed: job.itemsProcessed || 0,
        itemsTotal: job.itemsTotal || 0,
        error: job.error,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        batchProgress: job.batchProgress,
        runningTime: job.startedAt ? `${Math.floor((new Date(job.completedAt || new Date()) - new Date(job.startedAt)) / 1000)}s` : null
      }))
    });

  } catch (error) {
    console.error('Debug logs error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
}