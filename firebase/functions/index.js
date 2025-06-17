const { onRequest, onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Category processing with longer timeout (up to 60 minutes)
exports.processCategoriesWithAI = onRequest({
  timeoutSeconds: 3600, // 60 minutes
  memory: '2GiB',
  concurrency: 1
}, async (req, res) => {
  try {
    console.log('🚀 Starting Firebase category processing');
    
    const limit = req.body?.limit || 100;
    const result = await processUnprocessedCategories(limit);
    
    res.json({
      success: true,
      processed: result.processed,
      successful: result.successful,
      failed: result.failed
    });
  } catch (error) {
    console.error('Category processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Scheduled category processing every 5 minutes
exports.scheduledCategoryProcessing = onSchedule({
  schedule: 'every 5 minutes',
  timeoutSeconds: 3600,
  memory: '2GiB'
}, async (event) => {
  console.log('🕐 Scheduled category processing started');
  
  try {
    await processUnprocessedCategories(100);
    console.log('✅ Scheduled category processing completed');
  } catch (error) {
    console.error('❌ Scheduled category processing failed:', error);
  }
});

// Process categories for a specific feed when sync completes
exports.onSyncComplete = onDocumentCreated('sync_jobs/{jobId}', async (event) => {
  const job = event.data.data();
  
  if (job.status === 'completed') {
    console.log(`🎉 Sync job ${event.params.jobId} completed, triggering category processing`);
    
    // Trigger category processing for this feed's products
    setTimeout(async () => {
      try {
        await processFeedCategories(job.feedId, 200);
      } catch (error) {
        console.error('Feed category processing error:', error);
      }
    }, 10000); // Wait 10 seconds before starting
  }
});

// Callable function for manual category processing
exports.triggerCategoryProcessing = onCall({
  timeoutSeconds: 3600,
  memory: '2GiB'
}, async (request) => {
  const { feedId, limit = 100 } = request.data;
  
  try {
    let result;
    if (feedId) {
      result = await processFeedCategories(feedId, limit);
    } else {
      result = await processUnprocessedCategories(limit);
    }
    
    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error('Manual category processing error:', error);
    throw new Error(error.message);
  }
});

async function processUnprocessedCategories(limit = 100) {
  console.log(`📦 Processing ${limit} unprocessed products`);
  
  // Get unprocessed products
  const productsSnapshot = await db.collection('products')
    .where('categoryProcessed', '==', false)
    .limit(limit)
    .get();
  
  const products = productsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  console.log(`Found ${products.length} unprocessed products`);
  
  if (products.length === 0) {
    return { processed: 0, successful: 0, failed: 0 };
  }
  
  return await processCategoriesInBatches(products);
}

async function processFeedCategories(feedId, limit = 200) {
  console.log(`📦 Processing categories for feed ${feedId}`);
  
  const productsSnapshot = await db.collection('products')
    .where('feedId', '==', feedId)
    .where('categoryProcessed', '==', false)
    .limit(limit)
    .get();
  
  const products = productsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  console.log(`Found ${products.length} unprocessed products for feed ${feedId}`);
  
  if (products.length === 0) {
    return { processed: 0, successful: 0, failed: 0 };
  }
  
  return await processCategoriesInBatches(products);
}

async function processCategoriesInBatches(products) {
  const batchSize = 20; // Smaller batches for more reliable processing
  const batches = [];
  
  for (let i = 0; i < products.length; i += batchSize) {
    batches.push(products.slice(i, i + batchSize));
  }
  
  console.log(`🔄 Processing ${products.length} products in ${batches.length} batches`);
  
  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`\n🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} products)`);
    
    try {
      const result = await processBatchWithGemini(batch);
      totalProcessed += result.processed;
      totalSuccessful += result.successful;
      totalFailed += result.failed;
      
      // Longer delay between batches to respect rate limits
      if (batchIndex < batches.length - 1) {
        console.log('⏱️  Waiting 10 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      
    } catch (batchError) {
      console.error(`❌ Batch ${batchIndex + 1} failed:`, batchError.message);
      
      // Mark all products in failed batch as uncategorized
      for (const product of batch) {
        try {
          await updateProductCategory(product.id, {
            title: 'Uncategorized',
            id: 0,
            path: 'Uncategorized'
          });
          totalProcessed++;
          totalFailed++;
        } catch (dbError) {
          console.error(`Database error for ${product.id}:`, dbError.message);
        }
      }
    }
  }
  
  console.log(`\n🎉 Batch processing complete!`);
  console.log(`📊 Total processed: ${totalProcessed}`);
  console.log(`✅ Successfully categorized: ${totalSuccessful}`);
  console.log(`❌ Failed: ${totalFailed}`);
  
  return {
    processed: totalProcessed,
    successful: totalSuccessful,
    failed: totalFailed
  };
}

async function processBatchWithGemini(products) {
  // Load eMAG categories
  const categoriesSnapshot = await db.collection('categories').doc('emag_mapping').get();
  const categories = categoriesSnapshot.exists ? categoriesSnapshot.data().categories : [];
  
  if (categories.length === 0) {
    throw new Error('No eMAG categories found in database');
  }
  
  // Prepare products for Gemini
  const productTexts = products.map((product, index) => 
    `${index}: "${product.title}" - Categories: [${(product.originalCategories || []).join(', ')}]`
  ).join('\n');
  
  const prompt = `You are a product categorization expert. Match each product to the most appropriate eMAG category.

Products to categorize:
${productTexts}

Available eMAG categories (first 50 examples):
${categories.slice(0, 50).map(cat => `- ${cat.title} (ID: ${cat.id})`).join('\n')}

Return a JSON array with format:
[{"productIndex": 0, "categoryId": 123, "categoryTitle": "Category Name", "confidence": 0.95}]

Only return the JSON array, no other text.`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse Gemini response
    const matches = JSON.parse(text.replace(/```json|```/g, '').trim());
    
    let processed = 0;
    let successful = 0;
    let failed = 0;
    
    // Update products with matches
    for (const match of matches) {
      const product = products[match.productIndex];
      if (!product) continue;
      
      try {
        if (match.categoryId && match.categoryTitle && match.confidence > 0.3) {
          const category = categories.find(cat => cat.id === match.categoryId);
          
          await updateProductCategory(product.id, {
            title: match.categoryTitle,
            id: match.categoryId,
            path: category?.path || match.categoryTitle
          });
          
          successful++;
          console.log(`✅ ${product.title} → ${match.categoryTitle} (${match.confidence})`);
        } else {
          await updateProductCategory(product.id, {
            title: 'Uncategorized',
            id: 0,
            path: 'Uncategorized'
          });
          console.log(`❌ ${product.title} → Uncategorized (low confidence)`);
        }
        processed++;
      } catch (error) {
        console.error(`Database error for ${product.id}:`, error.message);
        failed++;
      }
    }
    
    return { processed, successful, failed };
    
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

async function updateProductCategory(productId, categoryData) {
  await db.collection('products').doc(productId).update({
    emagCategory: categoryData.title,
    emagCategoryId: categoryData.id,
    emagCategoryPath: categoryData.path,
    categoryProcessed: true,
    categoryUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}