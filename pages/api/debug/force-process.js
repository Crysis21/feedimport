import { SyncJobModel, FeedModel } from '../../../lib/models.js';
import { BatchFeedProcessor } from '../../../lib/batchFeedProcessor.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.body;

  try {
    let targetJob;
    
    if (jobId) {
      // Process specific job
      targetJob = await getJobById(jobId);
      if (!targetJob) {
        return res.status(404).json({ error: 'Job not found' });
      }
    } else {
      // Get the first pending job
      const pendingJobs = await SyncJobModel.getJobsByStatus('pending', 1);
      if (pendingJobs.length === 0) {
        return res.status(400).json({ error: 'No pending jobs found' });
      }
      targetJob = pendingJobs[0];
    }

    console.log(`🔧 Force processing job ${targetJob.id} for feed ${targetJob.feedId}`);

    // Get feed configuration
    const feed = await FeedModel.getById(targetJob.feedId);
    if (!feed) {
      await SyncJobModel.updateStatus(targetJob.id, 'failed', {
        error: 'Feed not found'
      });
      return res.status(404).json({ error: 'Feed not found' });
    }

    console.log(`📋 Feed found: ${feed.name} (${feed.type})`);

    // Start processing
    res.json({
      success: true,
      message: `Started processing job ${targetJob.id}`,
      jobId: targetJob.id,
      feedId: targetJob.feedId,
      feedName: feed.name
    });

    // Process in background
    setTimeout(async () => {
      try {
        console.log(`🚀 Starting BatchFeedProcessor for job ${targetJob.id}`);
        const processor = new BatchFeedProcessor(feed);
        
        const result = await processor.startFeedSync(targetJob.id);
        console.log(`✅ Job ${targetJob.id} completed:`, result);
        
        // Update feed last sync time
        await FeedModel.update(feed.id, {
          lastSyncAt: new Date()
        });
        
      } catch (error) {
        console.error(`❌ Job ${targetJob.id} failed:`, error);
        
        await SyncJobModel.updateStatus(targetJob.id, 'failed', {
          error: error.message
        });
      }
    }, 1000);

  } catch (error) {
    console.error('Force process error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
}

async function getJobById(jobId) {
  const { doc, getDoc } = await import('firebase/firestore');
  const { db } = await import('../../../lib/firebase.js');
  
  const docRef = doc(db, 'sync_jobs', jobId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}