import { jobQueue } from '../../../lib/jobQueue.js';
import { authenticateRequest } from '../../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await authenticateRequest(req);
    
    const status = await jobQueue.getQueueStatus();
    
    return res.json({
      success: true,
      queue: status
    });
    
  } catch (error) {
    console.error('Error getting queue status:', error);
    return res.status(500).json({ error: error.message });
  }
}