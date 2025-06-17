import { ExportFeedModel, FeedModel } from '../../lib/models.js';
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
  const { exportFeedId } = req.query;

  if (exportFeedId) {
    const exportFeed = await ExportFeedModel.getById(exportFeedId);
    if (!exportFeed || exportFeed.userId !== userId) {
      return res.status(404).json({ error: 'Export feed not found' });
    }
    
    return res.json({ exportFeed });
  }

  const exportFeeds = await ExportFeedModel.getByUser(userId);
  return res.json({ exportFeeds });
}

async function handlePost(req, res, userId) {
  const { 
    name, 
    feedId, 
    feedIds, 
    filters, 
    pricingMultiplier 
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Validate that user owns the specified feeds
  if (feedId) {
    const feed = await FeedModel.getById(feedId);
    if (!feed || feed.userId !== userId) {
      return res.status(400).json({ error: 'Invalid feed ID' });
    }
  }

  if (feedIds && feedIds.length > 0) {
    for (const fId of feedIds) {
      const feed = await FeedModel.getById(fId);
      if (!feed || feed.userId !== userId) {
        return res.status(400).json({ error: `Invalid feed ID: ${fId}` });
      }
    }
  }

  const exportFeedData = {
    name,
    feedId: feedId || null,
    feedIds: feedIds || null,
    filters: filters || {},
    pricingMultiplier: pricingMultiplier || 1
  };

  const result = await ExportFeedModel.create(userId, exportFeedData);
  
  return res.status(201).json({
    message: 'Export feed created successfully',
    exportFeedId: result.id,
    uuid: result.uuid
  });
}

async function handlePut(req, res, userId) {
  const { exportFeedId } = req.query;
  const { 
    name, 
    feedId, 
    feedIds, 
    filters, 
    pricingMultiplier 
  } = req.body;

  if (!exportFeedId) {
    return res.status(400).json({ error: 'Export feed ID is required' });
  }

  const exportFeed = await ExportFeedModel.getById(exportFeedId);
  if (!exportFeed || exportFeed.userId !== userId) {
    return res.status(404).json({ error: 'Export feed not found' });
  }

  // Validate feed ownership if specified
  if (feedId) {
    const feed = await FeedModel.getById(feedId);
    if (!feed || feed.userId !== userId) {
      return res.status(400).json({ error: 'Invalid feed ID' });
    }
  }

  if (feedIds && feedIds.length > 0) {
    for (const fId of feedIds) {
      const feed = await FeedModel.getById(fId);
      if (!feed || feed.userId !== userId) {
        return res.status(400).json({ error: `Invalid feed ID: ${fId}` });
      }
    }
  }

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (feedId !== undefined) updates.feedId = feedId;
  if (feedIds !== undefined) updates.feedIds = feedIds;
  if (filters !== undefined) updates.filters = filters;
  if (pricingMultiplier !== undefined) updates.pricingMultiplier = pricingMultiplier;

  await ExportFeedModel.update(exportFeedId, updates);
  
  return res.json({ message: 'Export feed updated successfully' });
}

async function handleDelete(req, res, userId) {
  const { exportFeedId } = req.query;

  if (!exportFeedId) {
    return res.status(400).json({ error: 'Export feed ID is required' });
  }

  const exportFeed = await ExportFeedModel.getById(exportFeedId);
  if (!exportFeed || exportFeed.userId !== userId) {
    return res.status(404).json({ error: 'Export feed not found' });
  }

  await ExportFeedModel.delete(exportFeedId);
  
  return res.json({ message: 'Export feed deleted successfully' });
}