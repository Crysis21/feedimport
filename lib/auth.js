// Simple auth using Firebase REST API - no Admin SDK needed
export async function verifyToken(idToken) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    }
  );
  
  if (!response.ok) {
    throw new Error('Invalid token');
  }
  
  const data = await response.json();
  return data.users[0];
}

export function generateApiKey(userId) {
  // Simple API key using base64 encoding - no JWT needed
  return Buffer.from(`${userId}:${Date.now()}`).toString('base64');
}

export function verifyApiKey(apiKey) {
  try {
    const decoded = Buffer.from(apiKey, 'base64').toString();
    const [userId] = decoded.split(':');
    return userId;
  } catch {
    throw new Error('Invalid API key');
  }
}

export async function authenticateRequest(req) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    throw new Error('No authorization header');
  }
  
  if (authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.slice(7);
    const user = await verifyToken(idToken);
    return { userId: user.localId, email: user.email };
  }
  
  if (authHeader.startsWith('ApiKey ')) {
    const apiKey = authHeader.slice(7);
    const userId = verifyApiKey(apiKey);
    return { userId, isApiKey: true };
  }
  
  throw new Error('Invalid authorization format');
}