export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Trigger Firebase Function for category processing
    const functionsUrl = process.env.FIREBASE_FUNCTIONS_URL || 'https://us-central1-your-project.cloudfunctions.net';
    
    const response = await fetch(`${functionsUrl}/processCategoriesWithAI`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ limit: 100 })
    });

    if (response.ok) {
      return res.json({ success: true, message: 'Category processing triggered in Firebase' });
    } else {
      // Fallback to local processing if Firebase is unavailable
      const { processCategoriesWithAI } = await import('../../../lib/categoryProcessor.js');
      await processCategoriesWithAI(50); // Smaller batch for Vercel
      return res.json({ success: true, message: 'Categories processed locally (Firebase unavailable)' });
    }
  } catch (error) {
    console.error('Cron process-categories error:', error);
    return res.status(500).json({ error: error.message });
  }
}