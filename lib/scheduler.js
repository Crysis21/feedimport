import cron from 'node-cron';
import { FeedModel, SyncJobModel } from './models.js';
import { FeedProcessor, processCategoriesWithAI } from './feedProcessor.js';
import { db } from './firebase.js';
import { collection, query, where, getDocs } from 'firebase/firestore';

class Scheduler {
  constructor() {
    this.scheduledTasks = new Map();
    this.isProcessing = false;
  }

  async initialize() {
    cron.schedule('*/5 * * * *', () => {
      this.processScheduledFeeds();
    });

    cron.schedule('*/2 * * * *', () => {
      processCategoriesWithAI(5);
    });

    console.log('Scheduler initialized');
  }

  async processScheduledFeeds() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    
    try {
      const feeds = await this.getActiveFeeds();
      
      for (const feed of feeds) {
        if (this.shouldSync(feed)) {
          await this.scheduleFeedSync(feed);
        }
      }
    } catch (error) {
      console.error('Error processing scheduled feeds:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async getActiveFeeds() {
    const q = query(
      collection(db, 'feeds'),
      where('status', '==', 'active'),
      where('isPaused', '==', false)
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  shouldSync(feed) {
    if (!feed.lastSyncAt) {
      return true;
    }

    const timeSinceLastSync = Date.now() - feed.lastSyncAt.toMillis();
    return timeSinceLastSync >= feed.syncInterval;
  }

  async scheduleFeedSync(feed) {
    try {
      const activeJobs = await SyncJobModel.getActive();
      const existingJob = activeJobs.find(job => job.feedId === feed.id);
      
      if (existingJob) {
        return;
      }

      const jobId = await SyncJobModel.create(feed.id, 'scheduled');
      
      setTimeout(async () => {
        await this.processFeed(feed, jobId);
      }, 0);

    } catch (error) {
      console.error(`Error scheduling sync for feed ${feed.id}:`, error);
    }
  }

  async processFeed(feed, jobId) {
    try {
      const processor = new FeedProcessor(feed);
      await processor.processFeed(jobId);
      
      await FeedModel.update(feed.id, {
        lastSyncAt: new Date()
      });
      
    } catch (error) {
      console.error(`Error processing feed ${feed.id}:`, error);
    }
  }

  async triggerManualSync(feedId) {
    const feed = await FeedModel.getById(feedId);
    if (!feed) {
      throw new Error('Feed not found');
    }

    const activeJobs = await SyncJobModel.getActive();
    const existingJob = activeJobs.find(job => job.feedId === feedId);
    
    if (existingJob) {
      throw new Error('Sync already in progress for this feed');
    }

    const jobId = await SyncJobModel.create(feedId, 'manual');
    
    setTimeout(async () => {
      await this.processFeed(feed, jobId);
    }, 0);

    return jobId;
  }

  async pauseFeed(feedId) {
    await FeedModel.update(feedId, { isPaused: true });
  }

  async resumeFeed(feedId) {
    await FeedModel.update(feedId, { isPaused: false });
  }

  getScheduledTasks() {
    return Array.from(this.scheduledTasks.entries()).map(([feedId, task]) => ({
      feedId,
      nextRun: task.nextRun,
      isRunning: task.isRunning
    }));
  }
}

export const scheduler = new Scheduler();

if (process.env.NODE_ENV !== 'test') {
  scheduler.initialize();
}