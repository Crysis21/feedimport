import { jobQueue } from '../../../lib/jobQueue.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await jobQueue.processQueue();
    const status = await jobQueue.getQueueStatus();
    
    return res.json({ 
      success: true, 
      message: 'Queue processed',
      status 
    });
  } catch (error) {
    console.error('Cron process-queue error:', error);
    return res.status(500).json({ error: error.message });
  }
}