import cron from 'node-cron';
import { FeedModel, SyncJobModel } from './models.js';
import { jobQueue } from './jobQueue.js';
import { processCategoriesWithAI } from './categoryProcessor.js';
import { db } from './firebase.js';
import { collection, query, where, getDocs } from 'firebase/firestore';

class Scheduler {
  constructor() {
    this.scheduledTasks = new Map();
    this.isProcessing = false;
  }

  async initialize() {
    // Feed synchronization every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      this.processScheduledFeeds();
    });

    // Process job queue every 2 minutes
    cron.schedule('*/2 * * * *', () => {
      jobQueue.processQueue();
    });

    // Category processing every 2 minutes (independent)
    cron.schedule('*/2 * * * *', () => {
      processCategoriesWithAI(100);
    });

    // Cleanup stalled jobs every 10 minutes
    cron.schedule('*/10 * * * *', () => {
      jobQueue.cleanupStalledJobs(15);
    });

    console.log('🚀 Scheduler initialized with job queue system');
    console.log('📅 Feed sync discovery: every 5 minutes');
    console.log('🔄 Job queue processing: every 2 minutes');
    console.log('🤖 Category processing: every 2 minutes');
    console.log('🧹 Cleanup stalled jobs: every 10 minutes');
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
      console.log(`🚀 Scheduling sync for feed ${feed.id}`);
      await jobQueue.scheduleJob(feed.id, 'scheduled');
      console.log(`✅ Feed ${feed.id} added to job queue`);
    } catch (error) {
      if (error.message.includes('already running')) {
        console.log(`⏸️  Skipping feed ${feed.id} - ${error.message}`);
      } else {
        console.error(`❌ Error scheduling sync for feed ${feed.id}:`, error);
      }
    }
  }

  // This method is now handled by the job queue
  // Keeping for backward compatibility but it's deprecated
  async processFeed(feed, jobId) {
    console.warn('processFeed is deprecated, use jobQueue.scheduleJob instead');
  }

  async triggerManualSync(feedId) {
    const feed = await FeedModel.getById(feedId);
    if (!feed) {
      throw new Error('Feed not found');
    }

    console.log(`🚀 Starting manual sync for feed ${feedId}`);
    const jobId = await jobQueue.scheduleJob(feedId, 'manual');
    
    return jobId;
  }

  async pauseFeed(feedId) {
    await FeedModel.update(feedId, { isPaused: true });
  }

  async resumeFeed(feedId) {
    await FeedModel.update(feedId, { isPaused: false });
  }

  async getScheduledTasks() {
    return await jobQueue.getQueueStatus();
  }
}

export const scheduler = new Scheduler();

if (process.env.NODE_ENV !== 'test') {
  scheduler.initialize();
}