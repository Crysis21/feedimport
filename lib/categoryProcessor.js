import dotenv from 'dotenv';
import { ProductModel } from './models.js';
import { matchCategoriesInBatch } from './geminiCategoryMatcher.js';

dotenv.config({ path: '.env.local' });

export class CategoryProcessor {
  constructor() {
    this.batchSize = 50; // Process 50 products per API call to stay within limits
    this.maxRetries = 3;
    this.rateLimitDelay = 2000; // 2 seconds between batches
  }

  async processUnprocessedCategories(limit = 100) {
    console.log(`🚀 Starting category processing with limit: ${limit}`);
    
    const products = await ProductModel.getUnprocessedProducts(limit);
    console.log(`📦 Found ${products.length} unprocessed products`);
    
    if (products.length === 0) {
      console.log(`✅ No products to process`);
      return { processed: 0, successful: 0, failed: 0 };
    }
    
    // Process in smaller batches to avoid timeouts
    const batches = [];
    for (let i = 0; i < products.length; i += this.batchSize) {
      batches.push(products.slice(i, i + this.batchSize));
    }
    
    console.log(`📊 Processing ${products.length} products in ${batches.length} batches`);
    
    let totalProcessed = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} products)`);
      
      const result = await this.processBatch(batch, batchIndex + 1);
      totalProcessed += result.processed;
      totalSuccessful += result.successful;
      totalFailed += result.failed;
      
      // Rate limiting between batches
      if (batchIndex < batches.length - 1) {
        console.log(`⏱️  Rate limit delay: ${this.rateLimitDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      }
    }
    
    console.log(`\n🎉 Category processing complete!`);
    console.log(`📊 Total processed: ${totalProcessed}`);
    console.log(`✅ Successfully categorized: ${totalSuccessful}`);
    console.log(`❌ Failed: ${totalFailed}`);
    
    return { 
      processed: totalProcessed, 
      successful: totalSuccessful, 
      failed: totalFailed 
    };
  }

  async processBatch(products, batchNumber) {
    let processed = 0;
    let successful = 0;
    let failed = 0;
    let retryCount = 0;
    
    while (retryCount < this.maxRetries) {
      try {
        console.log(`🤖 Calling Gemini API for batch ${batchNumber} (attempt ${retryCount + 1})`);
        
        // Call Gemini API for batch processing
        const results = await matchCategoriesInBatch(products);
        
        // Process results and update database
        for (const result of results) {
          const product = products[result.productIndex];
          
          try {
            if (result.categoryMatch) {
              await ProductModel.updateCategory(product.id, {
                title: result.categoryMatch.title,
                id: result.categoryMatch.id,
                path: result.categoryMatch.path
              });
              successful++;
              console.log(`✅ ${product.title} → ${result.categoryMatch.title}`);
            } else {
              await ProductModel.updateCategory(product.id, {
                title: 'Uncategorized',
                id: 0,
                path: 'Uncategorized'
              });
              console.log(`❌ ${product.title} → Uncategorized`);
            }
            processed++;
          } catch (dbError) {
            console.error(`❌ Database error for ${product.id}:`, dbError.message);
            failed++;
          }
        }
        
        console.log(`📊 Batch ${batchNumber} success: ${successful}/${products.length} categorized`);
        break; // Success, exit retry loop
        
      } catch (batchError) {
        retryCount++;
        console.error(`❌ Batch ${batchNumber} attempt ${retryCount} failed:`, batchError.message);
        
        if (retryCount >= this.maxRetries) {
          console.error(`❌ Batch ${batchNumber} failed after ${this.maxRetries} attempts, marking as uncategorized`);
          
          // Fallback: mark all products in failed batch as uncategorized
          for (const product of products) {
            try {
              await ProductModel.updateCategory(product.id, {
                title: 'Uncategorized',
                id: 0,
                path: 'Uncategorized'
              });
              processed++;
              failed++;
            } catch (dbError) {
              console.error(`❌ Database fallback error for ${product.id}:`, dbError.message);
            }
          }
        } else {
          // Wait before retry
          const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          console.log(`⏱️  Retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    return { processed, successful, failed };
  }

  async getProcessingStats() {
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('./firebase.js');
      
      // Get total products count
      const allProductsQuery = query(collection(db, 'products'));
      const allSnapshot = await getDocs(allProductsQuery);
      const total = allSnapshot.size;
      
      // Get processed products count
      const processedQuery = query(
        collection(db, 'products'),
        where('categoryProcessed', '==', true)
      );
      const processedSnapshot = await getDocs(processedQuery);
      const processed = processedSnapshot.size;
      
      // Get unprocessed products count
      const unprocessedQuery = query(
        collection(db, 'products'),
        where('categoryProcessed', '==', false)
      );
      const unprocessedSnapshot = await getDocs(unprocessedQuery);
      const unprocessed = unprocessedSnapshot.size;
      
      return {
        total,
        processed,
        unprocessed,
        processedPercentage: total > 0 ? Math.round((processed / total) * 100) : 0
      };
    } catch (error) {
      console.error('Error getting processing stats:', error);
      return { total: 0, processed: 0, unprocessed: 0, processedPercentage: 0 };
    }
  }
}

// Standalone function for cron job
export async function processCategoriesWithAI(limit = 100) {
  const processor = new CategoryProcessor();
  return await processor.processUnprocessedCategories(limit);
}