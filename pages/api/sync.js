import { FeedModel, SyncJobModel } from '../../lib/models.js';
import { authenticateRequest } from '../../lib/auth.js';
import { scheduler } from '../../lib/scheduler.js';

export default async function handler(req, res) {
  try {
    const { userId } = await authenticateRequest(req);

    switch (req.method) {
      case 'POST':
        return await handleSync(req, res, userId);
      case 'PUT':
        return await handlePauseResume(req, res, userId);
      case 'GET':
        return await handleGetJobs(req, res, userId);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
}

async function handleSync(req, res, userId) {
  const { feedId } = req.body;

  if (!feedId) {
    return res.status(400).json({ error: 'Feed ID is required' });
  }

  const feed = await FeedModel.getById(feedId);
  if (!feed || feed.userId !== userId) {
    return res.status(404).json({ error: 'Feed not found' });
  }

  try {
    const jobId = await scheduler.triggerManualSync(feedId);
    return res.json({ jobId, message: 'Sync started' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

async function handlePauseResume(req, res, userId) {
  const { feedId, action } = req.body;

  if (!feedId || !action) {
    return res.status(400).json({ error: 'Feed ID and action are required' });
  }

  const feed = await FeedModel.getById(feedId);
  if (!feed || feed.userId !== userId) {
    return res.status(404).json({ error: 'Feed not found' });
  }

  try {
    if (action === 'pause') {
      await scheduler.pauseFeed(feedId);
    } else if (action === 'resume') {
      await scheduler.resumeFeed(feedId);
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "pause" or "resume"' });
    }

    return res.json({ message: `Feed ${action}d successfully` });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function handleGetJobs(req, res, userId) {
  const { feedId } = req.query;

  if (feedId) {
    const feed = await FeedModel.getById(feedId);
    if (!feed || feed.userId !== userId) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    const jobs = await SyncJobModel.getByFeed(feedId);
    return res.json({ jobs });
  }

  const activeJobs = await SyncJobModel.getActive();
  const userFeeds = await FeedModel.getByUser(userId);
  const userFeedIds = userFeeds.map(feed => feed.id);
  
  const userActiveJobs = activeJobs.filter(job => userFeedIds.includes(job.feedId));
  
  return res.json({ activeJobs: userActiveJobs });
}