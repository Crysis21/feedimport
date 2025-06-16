import { processCategoriesWithAI } from '../../../lib/feedProcessor.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await processCategoriesWithAI(5);
    return res.json({ success: true, message: 'Categories processed with AI' });
  } catch (error) {
    console.error('Cron process-categories error:', error);
    return res.status(500).json({ error: error.message });
  }
}