import dotenv from 'dotenv';
import xml2js from 'xml2js';
import { ProductModel, SyncJobModel } from './models.js';
import { matchCategoryWithAI } from './geminiCategoryMatcher.js';
import { WebhookModel } from './models.js';
import FastCategoryMatcher from './fastCategoryMatcher.js';

// Load .env.local file
dotenv.config({ path: '.env.local' });

export class FeedProcessor {
  constructor(feedConfig) {
    this.feedConfig = feedConfig;
    this.parser = new xml2js.Parser();
    this.builder = new xml2js.Builder();
  }

  async processFeed(jobId) {
    try {
      console.log(`Starting sync job ${jobId} for feed ${this.feedConfig.id}`);
      await SyncJobModel.updateStatus(jobId, 'running');
      
      const feedUrl = this.buildFeedUrl();
      console.log(`Fetching XML from ${feedUrl}`);
      const xmlData = await this.fetchXML(feedUrl);
      console.log(`Fetched XML data length: ${xmlData.length}`);
      
      const products = await this.parseProducts(xmlData);
      console.log(`Parsed ${products.length} products from XML`);
      
      await SyncJobModel.updateStatus(jobId, 'running', {
        itemsTotal: products.length
      });

      let processedCount = 0;
      let failedCount = 0;
      
      for (const product of products) {
        try {
          console.log(`\n[${processedCount + 1}/${products.length}] Processing: ${product.title}`);
          console.log(`Original categories: ${JSON.stringify(product.originalCategories)}`);
          console.log(`Brand: ${product.brand || 'N/A'}`);
          
          // Match category with Gemini AI during sync
          console.log(`🤖 Starting Gemini AI category matching...`);
          const startTime = Date.now();
          
          const categoryMatch = await matchCategoryWithAI({
            title: product.title,
            description: product.description,
            originalCategories: product.originalCategories,
            brand: product.brand,
            price: product.price
          });
          
          const matchTime = Date.now() - startTime;
          console.log(`⏱️  Gemini API call took ${matchTime}ms`);
          
          if (categoryMatch) {
            product.emagCategory = {
              title: categoryMatch.title,
              id: categoryMatch.id,
              path: categoryMatch.path
            };
            product.categoryProcessed = true;
            console.log(`✅ Category matched: ${categoryMatch.title} (ID: ${categoryMatch.id})`);
            console.log(`📍 Path: ${categoryMatch.path}`);
          } else {
            product.emagCategory = null;
            product.categoryProcessed = false;
            console.log(`❌ No category match found - will be marked as unprocessed`);
          }
          
          console.log(`💾 Saving product to database...`);
          const saveStartTime = Date.now();
          await ProductModel.createOrUpdate(this.feedConfig.id, product);
          const saveTime = Date.now() - saveStartTime;
          console.log(`💾 Database save took ${saveTime}ms`);
          
          processedCount++;
          console.log(`✅ Product ${processedCount}/${products.length} completed successfully`);
          
        } catch (error) {
          console.error(`❌ Failed to process product ${product.sku || product.title}:`, error.message);
          console.error(`Stack trace:`, error.stack);
          failedCount++;
        }
        
        if ((processedCount + failedCount) % 10 === 0) {
          console.log(`📊 Progress update: ${processedCount} processed, ${failedCount} failed`);
          await SyncJobModel.updateStatus(jobId, 'running', {
            itemsProcessed: processedCount,
            itemsFailed: failedCount
          });
        }
      }

      console.log(`Sync completed: ${processedCount} processed, ${failedCount} failed`);
      await SyncJobModel.updateStatus(jobId, 'completed', {
        itemsProcessed: processedCount,
        itemsFailed: failedCount
      });

      await this.triggerWebhooks(this.feedConfig.userId, {
        feedId: this.feedConfig.id,
        itemsProcessed: processedCount,
        timestamp: new Date()
      });

      return { success: true, itemsProcessed: processedCount };
    } catch (error) {
      console.error(`Sync job ${jobId} failed:`, error);
      await SyncJobModel.updateStatus(jobId, 'failed', {
        error: error.message
      });
      throw error;
    }
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

  async triggerWebhooks(userId, data) {
    try {
      const webhooks = await WebhookModel.getByUser(userId);
      
      for (const webhook of webhooks) {
        try {
          await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(webhook.headers || {})
            },
            body: JSON.stringify(data)
          });
          
          await WebhookModel.trigger(webhook.id, data);
        } catch (error) {
          console.error(`Webhook ${webhook.id} failed:`, error);
        }
      }
    } catch (error) {
      console.error('Error triggering webhooks:', error);
    }
  }
}

export async function processCategoriesWithAI(limit = 10) {
  const products = await ProductModel.getUnprocessedProducts(limit);
  
  for (const product of products) {
    try {
      const categoryMatch = await matchCategoryWithAI({
        title: product.title,
        description: product.description,
        originalCategories: product.originalCategories,
        brand: product.brand,
        price: product.price
      });
      
      if (categoryMatch) {
        await ProductModel.updateCategory(product.id, categoryMatch);
      } else {
        await ProductModel.updateCategory(product.id, {
          title: 'Uncategorized',
          id: 0,
          path: 'Uncategorized'
        });
      }
    } catch (error) {
      console.error(`Failed to process category for product ${product.id}:`, error);
    }
  }
}