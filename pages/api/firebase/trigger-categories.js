export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { limit = 100, feedId } = req.body;

  try {
    // Get Firebase Functions URL from environment
    const functionsUrl = process.env.FIREBASE_FUNCTIONS_URL || 'https://us-central1-your-project.cloudfunctions.net';
    
    const response = await fetch(`${functionsUrl}/processCategoriesWithAI`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ limit, feedId })
    });

    if (!response.ok) {
      throw new Error(`Firebase function failed: ${response.status}`);
    }

    const result = await response.json();
    
    return res.json({
      success: true,
      message: 'Category processing triggered in Firebase',
      result
    });

  } catch (error) {
    console.error('Error triggering Firebase category processing:', error);
    return res.status(500).json({ error: error.message });
  }
}