import { scheduler } from '../../../lib/scheduler.js';
import { jobQueue } from '../../../lib/jobQueue.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 Debug: Manually triggering queue processing');
    
    // First check for scheduled feeds
    await scheduler.processScheduledFeeds();
    console.log('✅ Scheduled feeds check completed');
    
    // Then process the queue
    await jobQueue.processQueue();
    console.log('✅ Queue processing completed');
    
    // Get status after processing
    const status = await jobQueue.getQueueStatus();
    
    return res.json({
      success: true,
      message: 'Queue processing triggered manually',
      status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Manual queue trigger error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
}