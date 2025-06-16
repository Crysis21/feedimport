import { processCategoriesWithAI } from '../../../lib/feedProcessor.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting manual category processing...');
    await processCategoriesWithAI(100);
    return res.json({ success: true, message: 'Category processing completed' });
  } catch (error) {
    console.error('Manual category processing error:', error);
    return res.status(500).json({ error: error.message });
  }
}