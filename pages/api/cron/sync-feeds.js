import { scheduler } from '../../../lib/scheduler.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await scheduler.processScheduledFeeds();
    return res.json({ success: true, message: 'Scheduled feeds processed' });
  } catch (error) {
    console.error('Cron sync-feeds error:', error);
    return res.status(500).json({ error: error.message });
  }
}