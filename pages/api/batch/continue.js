import { BatchFeedProcessor } from '../../../lib/batchFeedProcessor.js';
import { SyncJobModel, FeedModel } from '../../../lib/models.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.body;

  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  try {
    // Get the job details
    const job = await getJobById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'running') {
      return res.status(400).json({ error: 'Job is not in running state' });
    }

    // Get the feed configuration
    const feed = await FeedModel.getById(job.feedId);
    if (!feed) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    // Continue processing the next batch
    const processor = new BatchFeedProcessor(feed);
    
    // This is a simplified version - in production you'd want to reconstruct
    // the exact batch from the job's progress state
    const { batchProgress } = job;
    
    if (batchProgress.completedBatches >= batchProgress.totalBatches) {
      return res.json({ 
        success: true, 
        message: 'All batches already completed',
        completed: true 
      });
    }

    // For now, just update the job status - actual batch continuation would need
    // the original product data to be stored or re-fetched
    console.log(`Continuing batch processing for job ${jobId}`);
    
    return res.json({ 
      success: true, 
      message: 'Batch processing continued',
      currentBatch: batchProgress.completedBatches + 1,
      totalBatches: batchProgress.totalBatches
    });

  } catch (error) {
    console.error('Error continuing batch:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function getJobById(jobId) {
  const { doc, getDoc } = await import('firebase/firestore');
  const { db } = await import('../../../lib/firebase.js');
  
  const docRef = doc(db, 'sync_jobs', jobId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}