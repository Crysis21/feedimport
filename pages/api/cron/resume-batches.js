import { jobQueue } from '../../../lib/jobQueue.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cleanedCount = await jobQueue.cleanupStalledJobs(15);
    return res.json({ 
      success: true, 
      message: `Cleaned up ${cleanedCount} stalled jobs` 
    });
  } catch (error) {
    console.error('Cron cleanup-stalled error:', error);
    return res.status(500).json({ error: error.message });
  }
}