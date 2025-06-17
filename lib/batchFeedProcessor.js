import dotenv from 'dotenv';
import xml2js from 'xml2js';
import { ProductModel, SyncJobModel } from './models.js';

dotenv.config({ path: '.env.local' });

export class BatchFeedProcessor {
  constructor(feedConfig) {
    this.feedConfig = feedConfig;
    this.parser = new xml2js.Parser();
    this.batchSize = 50; // Process 50 products per batch to stay within Vercel limits
  }

  async startFeedSync(jobId) {
    try {
      console.log(`🚀 Starting batch sync job ${jobId} for feed ${this.feedConfig.id}`);
      
      // Check if this is a resume operation
      const existingJob = await this.getJobById(jobId);
      if (existingJob && existingJob.status === 'running' && existingJob.batchProgress) {
        console.log(`🔄 Resuming existing job ${jobId}`);
        return await this.resumeJob(jobId, existingJob);
      }
      
      await SyncJobModel.updateStatus(jobId, 'running');
      
      const feedUrl = this.buildFeedUrl();
      console.log(`📡 Fetching XML from ${feedUrl}`);
      const xmlData = await this.fetchXML(feedUrl);
      
      const products = await this.parseProducts(xmlData);
      console.log(`📦 Parsed ${products.length} products from XML`);
      
      // Store products data for resume capability
      await this.storeJobData(jobId, { products, feedUrl });
      
      // Calculate total batches needed
      const totalBatches = Math.ceil(products.length / this.batchSize);
      
      await SyncJobModel.updateStatus(jobId, 'running', {
        itemsTotal: products.length,
        batchProgress: {
          totalBatches,
          completedBatches: 0,
          lastProcessedIndex: 0
        }
      });

      // Process all batches sequentially with small delays
      await this.processAllBatches(jobId, products);

      return { 
        success: true, 
        totalBatches,
        totalProducts: products.length,
        message: 'Batch processing completed'
      };

    } catch (error) {
      console.error(`❌ Sync job ${jobId} failed:`, error);
      await SyncJobModel.updateStatus(jobId, 'failed', {
        error: error.message
      });
      throw error;
    }
  }

  async processAllBatches(jobId, products) {
    const totalBatches = Math.ceil(products.length / this.batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * this.batchSize;
      const endIndex = Math.min(startIndex + this.batchSize, products.length);
      
      const batch = {
        index: batchIndex,
        startIndex,
        endIndex,
        products: products.slice(startIndex, endIndex)
      };
      
      console.log(`🔄 Processing batch ${batchIndex + 1}/${totalBatches}`);
      await this.processBatch(jobId, batch);
      
      // Small delay between batches to avoid overwhelming the system
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Check if job was cancelled or failed
      const currentJob = await this.getJobById(jobId);
      if (currentJob.status === 'failed' || currentJob.status === 'cancelled') {
        console.log(`⏹️  Job ${jobId} was ${currentJob.status}, stopping processing`);
        return;
      }
    }
  }
  
  async resumeJob(jobId, job) {
    console.log(`🔄 Resuming job ${jobId} from batch ${job.batchProgress.completedBatches}`);
    
    // Get stored job data
    const jobData = await this.getJobData(jobId);
    if (!jobData || !jobData.products) {
      throw new Error('Cannot resume job - product data not found');
    }
    
    const { products } = jobData;
    const remainingBatches = Math.ceil((products.length - job.batchProgress.lastProcessedIndex) / this.batchSize);
    
    console.log(`📊 Resuming with ${remainingBatches} remaining batches`);
    
    // Continue processing from where we left off
    await this.processRemainingBatches(jobId, products, job.batchProgress);
    
    return {
      success: true,
      message: 'Job resumed and completed',
      resumedFrom: job.batchProgress.completedBatches
    };
  }
  
  async processRemainingBatches(jobId, products, progress) {
    const startIndex = progress.lastProcessedIndex;
    const totalBatches = Math.ceil(products.length / this.batchSize);
    const remainingProducts = products.slice(startIndex);
    const remainingBatchCount = Math.ceil(remainingProducts.length / this.batchSize);
    
    for (let i = 0; i < remainingBatchCount; i++) {
      const batchStartIndex = i * this.batchSize;
      const batchEndIndex = Math.min(batchStartIndex + this.batchSize, remainingProducts.length);
      const actualBatchIndex = progress.completedBatches + i;
      
      const batch = {
        index: actualBatchIndex,
        startIndex: startIndex + batchStartIndex,
        endIndex: startIndex + batchEndIndex,
        products: remainingProducts.slice(batchStartIndex, batchEndIndex)
      };
      
      console.log(`🔄 Processing resumed batch ${actualBatchIndex + 1}/${totalBatches}`);
      await this.processBatch(jobId, batch);
      
      // Small delay between batches
      if (i < remainingBatchCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  async processBatch(jobId, batch) {
    console.log(`🔄 Processing batch ${batch.index + 1} (products ${batch.startIndex + 1}-${batch.endIndex})`);
    
    let processedCount = 0;
    let failedCount = 0;
    
    for (const product of batch.products) {
      try {
        await ProductModel.createOrUpdate(this.feedConfig.id, product);
        processedCount++;
        console.log(`✅ Product ${batch.startIndex + processedCount} saved: ${product.title}`);
      } catch (error) {
        console.error(`❌ Failed to save product ${product.sku || product.title}:`, error.message);
        failedCount++;
      }
    }

    // Get current job status
    const currentJob = await this.getJobById(jobId);
    if (!currentJob) {
      throw new Error('Job not found');
    }

    const newCompletedBatches = currentJob.batchProgress.completedBatches + 1;
    const newProcessedItems = currentJob.itemsProcessed + processedCount;
    
    // Update job progress
    await SyncJobModel.updateStatus(jobId, 'running', {
      itemsProcessed: newProcessedItems,
      itemsFailed: (currentJob.itemsFailed || 0) + failedCount,
      batchProgress: {
        ...currentJob.batchProgress,
        completedBatches: newCompletedBatches,
        lastProcessedIndex: batch.endIndex
      }
    });

    console.log(`📊 Batch ${batch.index + 1} complete: ${processedCount} saved, ${failedCount} failed`);

    // Check if all batches are complete
    if (newCompletedBatches >= currentJob.batchProgress.totalBatches) {
      await SyncJobModel.updateStatus(jobId, 'completed', {
        itemsProcessed: newProcessedItems,
        itemsFailed: (currentJob.itemsFailed || 0) + failedCount
      });
      console.log(`🎉 All batches complete! Total: ${newProcessedItems} processed`);
      
      // Clean up job data after completion
      await this.cleanupJobData(jobId);
      
      // Trigger webhooks after completion
      await this.triggerWebhooks();
    }

    return { processedCount, failedCount };
  }

  async getJobById(jobId) {
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase.js');
    
    const docRef = doc(db, 'sync_jobs', jobId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  }

  buildFeedUrl() {
    switch (this.feedConfig.type) {
      case 'boribon':
        return `https://www.boribon.ro/feed/products/${this.feedConfig.uuid}`;
      default:
        return this.feedConfig.url;
    }
  }

  async fetchXML(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch XML: ${response.status}`);
    }
    return await response.text();
  }

  async parseProducts(xmlData) {
    const result = await this.parser.parseStringPromise(xmlData);
    const products = [];

    // Handle boribon XML structure: <products><product>
    if (result.products && result.products.product) {
      for (const item of result.products.product) {
        const product = this.extractProductData(item);
        products.push(product);
      }
    }
    // Handle RSS XML structure: <rss><channel><item>
    else if (result.rss && result.rss.channel && result.rss.channel[0].item) {
      for (const item of result.rss.channel[0].item) {
        const product = this.extractProductData(item);
        products.push(product);
      }
    }

    return products;
  }

  extractProductData(item) {
    // Handle boribon XML structure
    if (item.name && item.id) {
      return {
        title: item.name?.[0] || '',
        description: item.description?.[0] || '',
        link: item.url?.[0] || '',
        sku: item.id?.[0] || '',
        price: item.price_b2c?.[0] || '',
        availability: parseInt(item.quantity?.[0]) > 0 ? 'in stock' : 'out of stock',
        condition: 'new',
        brand: item.brand?.[0] || '',
        image: item.avatar?.[0] || '',
        originalCategories: item.categories?.[0]?.category || [],
        gtin: '',
        mpn: item.model?.[0] || '',
        stockQuantity: parseInt(item.quantity?.[0]) || 0
      };
    }
    
    // Handle RSS/Google Shopping XML structure
    return {
      title: item.title?.[0] || '',
      description: item.description?.[0] || '',
      link: item.link?.[0] || '',
      sku: item['g:id']?.[0] || item.guid?.[0] || '',
      price: item['g:price']?.[0] || '',
      availability: item['g:availability']?.[0] || '',
      condition: item['g:condition']?.[0] || 'new',
      brand: item['g:brand']?.[0] || '',
      image: item['g:image_link']?.[0] || '',
      originalCategories: item.category || [],
      gtin: item['g:gtin']?.[0] || '',
      mpn: item['g:mpn']?.[0] || '',
      stockQuantity: parseInt(item['g:quantity']?.[0]) || 0
    };
  }

  async storeJobData(jobId, data) {
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase.js');
      
      const docRef = doc(db, 'job_data', jobId);
      await setDoc(docRef, {
        ...data,
        storedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });
    } catch (error) {
      console.error(`Failed to store job data for ${jobId}:`, error);
    }
  }
  
  async getJobData(jobId) {
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase.js');
      
      const docRef = doc(db, 'job_data', jobId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      console.error(`Failed to get job data for ${jobId}:`, error);
      return null;
    }
  }
  
  async cleanupJobData(jobId) {
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase.js');
      
      const docRef = doc(db, 'job_data', jobId);
      await deleteDoc(docRef);
      console.log(`🧹 Cleaned up job data for ${jobId}`);
    } catch (error) {
      console.error(`Failed to cleanup job data for ${jobId}:`, error);
    }
  }

  async triggerWebhooks() {
    try {
      const { WebhookModel } = await import('./models.js');
      const webhooks = await WebhookModel.getByUser(this.feedConfig.userId);
      
      for (const webhook of webhooks) {
        try {
          await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(webhook.headers || {})
            },
            body: JSON.stringify({
              feedId: this.feedConfig.id,
              event: 'sync_completed',
              timestamp: new Date()
            })
          });
          
          await WebhookModel.trigger(webhook.id, {
            feedId: this.feedConfig.id,
            event: 'sync_completed'
          });
        } catch (error) {
          console.error(`Webhook ${webhook.id} failed:`, error);
        }
      }
    } catch (error) {
      console.error('Error triggering webhooks:', error);
    }
  }
}

// Utility function to continue processing incomplete jobs
export async function resumeIncompleteBatches() {
  console.log('🔍 Checking for incomplete batch jobs...');
  
  const stalledJobs = await SyncJobModel.getStalled(10); // Jobs running for more than 10 minutes
  
  for (const job of stalledJobs) {
    console.log(`🔄 Resuming stalled job ${job.id} for feed ${job.feedId}`);
    
    try {
      // Mark as failed for now - in production, you might want to implement actual resumption
      await SyncJobModel.updateStatus(job.id, 'failed', {
        error: 'Job stalled and was automatically failed'
      });
    } catch (error) {
      console.error(`Failed to handle stalled job ${job.id}:`, error);
    }
  }
}