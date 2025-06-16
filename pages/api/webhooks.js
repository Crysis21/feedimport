import { WebhookModel } from '../../lib/models.js';
import { authenticateRequest } from '../../lib/auth.js';

export default async function handler(req, res) {
  try {
    const { userId } = await authenticateRequest(req);

    switch (req.method) {
      case 'GET':
        return await handleGet(req, res, userId);
      case 'POST':
        return await handlePost(req, res, userId);
      case 'PUT':
        return await handlePut(req, res, userId);
      case 'DELETE':
        return await handleDelete(req, res, userId);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
}

async function handleGet(req, res, userId) {
  const webhooks = await WebhookModel.getByUser(userId);
  return res.json({ webhooks });
}

async function handlePost(req, res, userId) {
  const { name, url, headers, events } = req.body;

  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  const webhookData = {
    name,
    url,
    headers: headers || {},
    events: events || ['sync_completed']
  };

  const webhookId = await WebhookModel.create(userId, webhookData);
  
  return res.status(201).json({ 
    id: webhookId,
    ...webhookData,
    message: 'Webhook created successfully' 
  });
}

async function handlePut(req, res, userId) {
  const { webhookId } = req.query;
  const updates = req.body;

  if (!webhookId) {
    return res.status(400).json({ error: 'Webhook ID is required' });
  }

  if (updates.url && !isValidUrl(updates.url)) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  const webhook = await WebhookModel.getById(webhookId);
  if (!webhook || webhook.userId !== userId) {
    return res.status(404).json({ error: 'Webhook not found' });
  }

  await WebhookModel.update(webhookId, {
    ...updates,
    updatedAt: new Date()
  });

  return res.json({ message: 'Webhook updated successfully' });
}

async function handleDelete(req, res, userId) {
  const { webhookId } = req.query;

  if (!webhookId) {
    return res.status(400).json({ error: 'Webhook ID is required' });
  }

  const webhook = await WebhookModel.getById(webhookId);
  if (!webhook || webhook.userId !== userId) {
    return res.status(404).json({ error: 'Webhook not found' });
  }

  await WebhookModel.update(webhookId, { isActive: false });
  
  return res.json({ message: 'Webhook deleted successfully' });
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}