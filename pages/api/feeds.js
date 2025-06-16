import { FeedModel, SyncJobModel } from '../../lib/models.js';
import { authenticateRequest } from '../../lib/auth.js';
import { scheduler } from '../../lib/scheduler.js';

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
  const { feedId } = req.query;

  if (feedId) {
    const feed = await FeedModel.getById(feedId);
    if (!feed || feed.userId !== userId) {
      return res.status(404).json({ error: 'Feed not found' });
    }
    
    const jobs = await SyncJobModel.getByFeed(feedId, 10);
    
    return res.json({
      feed,
      recentJobs: jobs
    });
  }

  const feeds = await FeedModel.getByUser(userId);
  return res.json({ feeds });
}

async function handlePost(req, res, userId) {
  const { name, type, uuid, url, syncInterval } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required' });
  }

  if (type === 'boribon' && !uuid) {
    return res.status(400).json({ error: 'UUID is required for boribon feeds' });
  }

  if (type === 'custom' && !url) {
    return res.status(400).json({ error: 'URL is required for custom feeds' });
  }

  const feedData = {
    name,
    type,
    uuid: type === 'boribon' ? uuid : null,
    url: type === 'custom' ? url : null,
    syncInterval: syncInterval || 3600000
  };

  const feedId = await FeedModel.create(userId, feedData);
  const feed = await FeedModel.getById(feedId);

  return res.status(201).json({ feed });
}

async function handlePut(req, res, userId) {
  const { feedId } = req.query;
  const updates = req.body;

  if (!feedId) {
    return res.status(400).json({ error: 'Feed ID is required' });
  }

  const feed = await FeedModel.getById(feedId);
  if (!feed || feed.userId !== userId) {
    return res.status(404).json({ error: 'Feed not found' });
  }

  await FeedModel.update(feedId, updates);
  const updatedFeed = await FeedModel.getById(feedId);

  return res.json({ feed: updatedFeed });
}

async function handleDelete(req, res, userId) {
  const { feedId } = req.query;

  if (!feedId) {
    return res.status(400).json({ error: 'Feed ID is required' });
  }

  const feed = await FeedModel.getById(feedId);
  if (!feed || feed.userId !== userId) {
    return res.status(404).json({ error: 'Feed not found' });
  }

  await FeedModel.delete(feedId);
  return res.json({ success: true });
}