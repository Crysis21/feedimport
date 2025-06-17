import { SyncJobModel, FeedModel } from './models.js';
import { BatchFeedProcessor } from './batchFeedProcessor.js';

export class JobQueue {
  constructor() {
    this.maxConcurrentJobs = 5; // Maximum number of concurrent sync jobs
    this.processingJobs = new Set(); // Track currently processing jobs
  }

  async processQueue() {
    try {
      console.log('🔄 Processing job queue...');
      
      // Get current active jobs count
      const activeCount = await SyncJobModel.getActiveJobsCount();
      console.log(`📊 Currently active jobs: ${activeCount}/${this.maxConcurrentJobs}`);
      
      if (activeCount >= this.maxConcurrentJobs) {
        console.log('⏸️  Queue full, waiting for jobs to complete');
        return;
      }
      
      // Get pending jobs
      const pendingJobs = await SyncJobModel.getJobsByStatus('pending', 10);
      console.log(`📋 Found ${pendingJobs.length} pending jobs`);
      
      if (pendingJobs.length === 0) {
        console.log('✅ No pending jobs to process');
        return;
      }
      
      // Filter jobs we can start (no other job running for same feed)
      const availableJobs = [];
      for (const job of pendingJobs) {
        const canStart = await SyncJobModel.canStartNewJob(job.feedId);
        if (canStart && !this.processingJobs.has(job.id)) {
          availableJobs.push(job);
        }
      }
      
      console.log(`🚀 ${availableJobs.length} jobs ready to start`);
      
      // Start jobs up to our concurrent limit
      const jobsToStart = availableJobs.slice(0, this.maxConcurrentJobs - activeCount);
      
      for (const job of jobsToStart) {
        this.startJob(job);
      }
      
    } catch (error) {
      console.error('❌ Error processing job queue:', error);
    }
  }

  async startJob(job) {
    try {
      console.log(`🚀 Starting job ${job.id} for feed ${job.feedId}`);
      this.processingJobs.add(job.id);
      
      // Get feed configuration
      const feed = await FeedModel.getById(job.feedId);
      if (!feed) {
        throw new Error(`Feed ${job.feedId} not found`);
      }
      
      // Start batch processing in background
      this.processBatchJob(job, feed);
      
    } catch (error) {
      console.error(`❌ Error starting job ${job.id}:`, error);
      this.processingJobs.delete(job.id);
      
      await SyncJobModel.updateStatus(job.id, 'failed', {
        error: error.message
      });
    }
  }

  async processBatchJob(job, feed) {
    try {
      const processor = new BatchFeedProcessor(feed);
      await processor.startFeedSync(job.id);
      
      // Update feed last sync time
      await FeedModel.update(feed.id, {
        lastSyncAt: new Date()
      });
      
      console.log(`✅ Job ${job.id} completed successfully`);
      
    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error);
      
      await SyncJobModel.updateStatus(job.id, 'failed', {
        error: error.message
      });
      
    } finally {
      this.processingJobs.delete(job.id);
      
      // Try to process more jobs from queue
      setTimeout(() => {
        this.processQueue();
      }, 1000);
    }
  }

  async getQueueStatus() {
    const [activeJobs, pendingJobs] = await Promise.all([
      SyncJobModel.getJobsByStatus('running', 20),
      SyncJobModel.getJobsByStatus('pending', 20)
    ]);
    
    return {
      active: activeJobs.length,
      pending: pendingJobs.length,
      maxConcurrent: this.maxConcurrentJobs,
      processing: this.processingJobs.size,
      queue: {
        active: activeJobs,
        pending: pendingJobs
      }
    };
  }

  async scheduleJob(feedId, type = 'scheduled') {
    // Check if we can start a new job for this feed
    const canStart = await SyncJobModel.canStartNewJob(feedId);
    
    if (!canStart) {
      throw new Error('A sync job is already running for this feed');
    }
    
    // Create the job
    const jobId = await SyncJobModel.create(feedId, type);
    console.log(`📝 Created job ${jobId} for feed ${feedId}`);
    
    // Try to process the queue immediately
    setTimeout(() => {
      this.processQueue();
    }, 100);
    
    return jobId;
  }

  async cleanupStalledJobs(maxMinutes = 15) {
    console.log('🧹 Cleaning up stalled jobs...');
    
    const stalledJobs = await SyncJobModel.getStalled(maxMinutes);
    console.log(`🔍 Found ${stalledJobs.length} stalled jobs`);
    
    let cleanedCount = 0;
    let resumedCount = 0;
    
    for (const job of stalledJobs) {
      // Try to resume jobs that have batch progress data
      if (job.batchProgress && job.batchProgress.completedBatches < job.batchProgress.totalBatches) {
        console.log(`🔄 Attempting to resume stalled job ${job.id}`);
        
        try {
          // Try to resume the job by re-queuing it
          await this.resumeJob(job);
          resumedCount++;
        } catch (error) {
          console.error(`❌ Failed to resume job ${job.id}, marking as failed:`, error.message);
          await SyncJobModel.updateStatus(job.id, 'failed', {
            error: `Job stalled and resume failed: ${error.message}`
          });
          cleanedCount++;
        }
      } else {
        console.log(`🔄 Marking stalled job ${job.id} as failed (no resume data)`);
        
        await SyncJobModel.updateStatus(job.id, 'failed', {
          error: `Job stalled for more than ${maxMinutes} minutes and was automatically failed`
        });
        cleanedCount++;
      }
      
      // Remove from processing set if it's there
      this.processingJobs.delete(job.id);
    }
    
    console.log(`🧹 Cleanup complete: ${cleanedCount} failed, ${resumedCount} resumed`);
    return { cleaned: cleanedCount, resumed: resumedCount };
  }
  
  async resumeJob(job) {
    const feed = await FeedModel.getById(job.feedId);
    if (!feed) {
      throw new Error(`Feed ${job.feedId} not found`);
    }
    
    console.log(`🔄 Resuming job ${job.id} in background`);
    
    // Start the resume process asynchronously
    this.processingJobs.add(job.id);
    
    // Process in background
    setTimeout(async () => {
      try {
        const processor = new BatchFeedProcessor(feed);
        await processor.startFeedSync(job.id); // This will detect and resume
        
        console.log(`✅ Job ${job.id} resumed successfully`);
        
      } catch (error) {
        console.error(`❌ Job ${job.id} resume failed:`, error);
        
        await SyncJobModel.updateStatus(job.id, 'failed', {
          error: `Resume failed: ${error.message}`
        });
        
      } finally {
        this.processingJobs.delete(job.id);
      }
    }, 1000);
  }
}

// Global job queue instance
export const jobQueue = new JobQueue();