import { jobQueue } from '../../../lib/jobQueue.js';
import { SyncJobModel } from '../../../lib/models.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 Testing job queue functionality...');
    
    // Step 1: Check active jobs count
    const activeCount = await SyncJobModel.getActiveJobsCount();
    console.log(`📊 Current active jobs: ${activeCount}`);
    
    // Step 2: Get pending jobs
    const pendingJobs = await SyncJobModel.getJobsByStatus('pending', 5);
    console.log(`📋 Pending jobs: ${pendingJobs.length}`);
    
    // Step 3: Test if we can start new jobs
    const canStartResults = [];
    for (const job of pendingJobs.slice(0, 3)) {
      const canStart = await SyncJobModel.canStartNewJob(job.feedId);
      canStartResults.push({
        jobId: job.id,
        feedId: job.feedId,
        canStart
      });
      console.log(`🔍 Job ${job.id} for feed ${job.feedId}: canStart = ${canStart}`);
    }
    
    // Step 4: Try to process queue
    console.log('🔄 Attempting to process queue...');
    await jobQueue.processQueue();
    console.log('✅ Queue processing completed');
    
    // Step 5: Check status after processing
    const statusAfter = await jobQueue.getQueueStatus();
    console.log('📊 Queue status after processing:', statusAfter);
    
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      tests: {
        activeJobsCount: activeCount,
        pendingJobsCount: pendingJobs.length,
        canStartTests: canStartResults,
        queueStatusAfter: statusAfter
      },
      debug: {
        pendingJobs: pendingJobs.slice(0, 3).map(j => ({
          id: j.id,
          feedId: j.feedId,
          status: j.status,
          createdAt: j.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('Test queue error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
}