import { verifyToken, generateApiKey } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method === 'POST' && req.url.includes('/verify')) {
    return await handleVerifyToken(req, res);
  }
  
  if (req.method === 'POST' && req.url.includes('/api-key')) {
    return await handleGenerateApiKey(req, res);
  }

  res.setHeader('Allow', ['POST']);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleVerifyToken(req, res) {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: 'ID token is required' });
  }

  try {
    const decodedToken = await verifyToken(idToken);
    
    return res.json({
      valid: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name,
        picture: decodedToken.picture
      }
    });
  } catch (error) {
    return res.status(401).json({ 
      valid: false, 
      error: error.message 
    });
  }
}

async function handleGenerateApiKey(req, res) {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: 'ID token is required' });
  }

  try {
    const decodedToken = await verifyToken(idToken);
    const apiKey = generateApiKey(decodedToken.uid);
    
    return res.json({ 
      apiKey,
      userId: decodedToken.uid,
      message: 'API key generated successfully' 
    });
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
}