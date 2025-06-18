import { db } from './firebase.js';
import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  query, 
  where, 
  orderBy, 
  limit as fbLimit,
  startAfter
} from 'firebase/firestore';
import crypto from 'crypto';

export class FeedModel {
  static async create(userId, feedData) {
    const docRef = await addDoc(collection(db, 'feeds'), {
      ...feedData,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      lastSyncAt: null,
      syncInterval: feedData.syncInterval || 3600000, // 1 hour default
      isPaused: false
    });
    return docRef.id;
  }

  static async getByUser(userId) {
    const q = query(
      collection(db, 'feeds'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  static async getById(feedId) {
    const docRef = doc(db, 'feeds', feedId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  }

  static async update(feedId, updates) {
    const docRef = doc(db, 'feeds', feedId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date()
    });
  }

  static async delete(feedId) {
    const docRef = doc(db, 'feeds', feedId);
    await deleteDoc(docRef);
  }
}

export class ProductModel {
  static async createOrUpdate(feedId, productData) {
    const productId = `${feedId}_${productData.id}`;
    
    const docRef = doc(db, 'products', productId);
    const existingDoc = await getDoc(docRef);
    const existingData = existingDoc.exists() ? existingDoc.data() : null;
    
    const productDoc = {
      ...productData,
      feedId,
      lastUpdated: new Date(),
      // Preserve existing category processing data
      categoryProcessed: existingData?.categoryProcessed || false,
      emagCategory: existingData?.emagCategory || null,
      emagCategoryId: existingData?.emagCategoryId || null,
      emagCategoryPath: existingData?.emagCategoryPath || null,
      categoryUpdatedAt: existingData?.categoryUpdatedAt || null
    };

    if (!existingData) {
      productDoc.createdAt = new Date();
      console.log(`✨ Creating new product: ${productData.title}`);
    } else {
      console.log(`🔄 Updating existing product: ${productData.title} (categoryProcessed: ${existingData.categoryProcessed})`);
    }

    await setDoc(docRef, productDoc, { merge: true });
    return productId;
  }

  static async getByFeed(feedId, limitCount = 100, offset = 0) {
    const q = query(
      collection(db, 'products'),
      where('feedId', '==', feedId),
      orderBy('lastUpdated', 'desc'),
      fbLimit(limitCount)
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  static async getUnprocessedProducts(limitCount = 100) {
    console.log(`🔍 Fetching unprocessed products with limit: ${limitCount}`);
    console.log(`🔍 Limit type: ${typeof limitCount}, value: ${limitCount}`);
    
    // First get a count of all products and processed products for debugging
    const allProductsQ = query(collection(db, 'products'));
    const allSnapshot = await getDocs(allProductsQ);
    const totalProducts = allSnapshot.size;
    
    const processedQ = query(
      collection(db, 'products'),
      where('categoryProcessed', '==', true)
    );
    const processedSnapshot = await getDocs(processedQ);
    const processedCount = processedSnapshot.size;
    
    console.log(`📊 Database stats: ${totalProducts} total products, ${processedCount} processed, ${totalProducts - processedCount} unprocessed`);
    
    // Let's check what products have for categoryProcessed field
    console.log(`🔍 Checking categoryProcessed field values...`);
    let falseCount = 0;
    let trueCount = 0;
    let undefinedCount = 0;
    let nullCount = 0;
    
    allSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.categoryProcessed === false) falseCount++;
      else if (data.categoryProcessed === true) trueCount++;
      else if (data.categoryProcessed === undefined) undefinedCount++;
      else if (data.categoryProcessed === null) nullCount++;
    });
    
    console.log(`📊 CategoryProcessed values: false=${falseCount}, true=${trueCount}, undefined=${undefinedCount}, null=${nullCount}`);
    
    // Parse limit to ensure it's a number
    const numericLimit = parseInt(limitCount) || 100;
    console.log(`🔍 Using numeric limit: ${numericLimit}`);
    
    const q = query(
      collection(db, 'products'),
      where('categoryProcessed', '==', false),
      fbLimit(numericLimit)
    );
    const snapshot = await getDocs(q);
    
    const products = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        documentId: doc.id,    // Firestore document ID (feedId_productId)
        productId: data.id,    // Original feed product ID
        ...data
      };
    });
    
    console.log(`📦 Found ${products.length} unprocessed products to process (requested limit: ${limitCount}, numeric limit: ${numericLimit})`);
    
    // Show first few products for debugging
    if (products.length > 0) {
      console.log(`🔍 First few unprocessed products:`);
      products.slice(0, 3).forEach((product, index) => {
        console.log(`  ${index + 1}. "${product.title}" - categoryProcessed: ${product.categoryProcessed}`);
      });
    }
    
    return products;
  }

  static async updateCategory(productId, categoryData) {
    const docRef = doc(db, 'products', productId);
    await updateDoc(docRef, {
      emagCategory: categoryData.title,
      emagCategoryId: categoryData.id,
      emagCategoryPath: categoryData.path,
      categoryProcessed: true,
      categoryUpdatedAt: new Date()
    });
  }

  static async getForFeedAPI(filters = {}) {
    let q = collection(db, 'products');
    const conditions = [];
    
    if (filters.feedId) {
      conditions.push(where('feedId', '==', filters.feedId));
    }
    
    if (filters.brand) {
      conditions.push(where('brand', '==', filters.brand));
    }
    
    if (filters.limit) {
      conditions.push(fbLimit(filters.limit));
    }
    
    if (conditions.length > 0) {
      q = query(q, ...conditions);
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  static async getForDashboard(filters = {}) {
    let q = collection(db, 'products');
    const conditions = [];
    
    // Filter by user's feeds
    if (filters.feedIds && filters.feedIds.length > 0) {
      conditions.push(where('feedId', 'in', filters.feedIds.slice(0, 10))); // Firestore limit
    }
    
    // Filter by specific feed
    if (filters.feedId) {
      conditions.push(where('feedId', '==', filters.feedId));
    }
    
    // Filter by brand
    if (filters.brand) {
      conditions.push(where('brand', '==', filters.brand));
    }
    
    // Filter by category processing status
    if (filters.categoryProcessed !== null) {
      conditions.push(where('categoryProcessed', '==', filters.categoryProcessed));
    }
    
    // Add ordering and limit
    conditions.push(orderBy('lastUpdated', 'desc'));
    conditions.push(fbLimit(filters.limit || 50));
    
    if (conditions.length > 0) {
      q = query(q, ...conditions);
    }
    
    const snapshot = await getDocs(q);
    let products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Client-side filtering for search terms (since Firestore doesn't support full-text search)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      products = products.filter(product => 
        (product.title || '').toLowerCase().includes(searchLower) ||
        (product.description || '').toLowerCase().includes(searchLower) ||
        (product.brand || '').toLowerCase().includes(searchLower) ||
        (product.originalCategories || []).some(cat => 
          cat.toLowerCase().includes(searchLower)
        )
      );
    }
    
    return {
      products,
      total: products.length
    };
  }

  static async getBrandsByUser(feedIds) {
    if (!feedIds || feedIds.length === 0) return [];
    
    const q = query(
      collection(db, 'products'),
      where('feedId', 'in', feedIds.slice(0, 10))
    );
    
    const snapshot = await getDocs(q);
    const brands = new Set();
    
    snapshot.docs.forEach(doc => {
      const product = doc.data();
      if (product.brand && product.brand.trim()) {
        brands.add(product.brand.trim());
      }
    });
    
    return Array.from(brands).sort();
  }

  static async getProcessingStats(feedIds) {
    if (!feedIds || feedIds.length === 0) {
      return { processed: 0, unprocessed: 0, total: 0 };
    }
    
    const q = query(
      collection(db, 'products'),
      where('feedId', 'in', feedIds.slice(0, 10))
    );
    
    const snapshot = await getDocs(q);
    let processed = 0;
    let unprocessed = 0;
    
    snapshot.docs.forEach(doc => {
      const product = doc.data();
      if (product.categoryProcessed === true) {
        processed++;
      } else {
        unprocessed++;
      }
    });
    
    return {
      processed,
      unprocessed,
      total: processed + unprocessed
    };
  }
}

export class SyncJobModel {
  static async create(feedId, type = 'scheduled') {
    const docRef = await addDoc(collection(db, 'sync_jobs'), {
      feedId,
      type,
      status: 'pending',
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      error: null,
      itemsProcessed: 0,
      itemsTotal: 0,
      batchProgress: {
        totalBatches: 0,
        completedBatches: 0,
        lastProcessedIndex: 0
      }
    });
    return docRef.id;
  }

  static async updateStatus(jobId, status, updates = {}) {
    const updateData = {
      status,
      ...updates
    };
    
    if (status === 'running') {
      updateData.startedAt = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
    }
    
    const docRef = doc(db, 'sync_jobs', jobId);
    await updateDoc(docRef, updateData);
  }

  static async getActive(feedId = null) {
    let q;
    if (feedId) {
      q = query(
        collection(db, 'sync_jobs'),
        where('feedId', '==', feedId),
        where('status', 'in', ['pending', 'running']),
        orderBy('createdAt', 'asc')
      );
    } else {
      q = query(
        collection(db, 'sync_jobs'),
        where('status', 'in', ['pending', 'running']),
        orderBy('createdAt', 'asc')
      );
    }
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  static async canStartNewJob(feedId) {
    // Check if there are any RUNNING sync jobs for this specific feed
    const runningJobs = await this.getJobsByStatus('running');
    const feedRunningJobs = runningJobs.filter(job => job.feedId === feedId);
    return feedRunningJobs.length === 0;
  }

  static async getActiveJobsCount() {
    // Only count RUNNING jobs, not pending ones
    const runningJobs = await this.getJobsByStatus('running');
    return runningJobs.length;
  }

  static async getJobsByStatus(status, limit = 50) {
    const q = query(
      collection(db, 'sync_jobs'),
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
      fbLimit(limit)
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  static async updateBatchProgress(jobId, batchProgress) {
    const docRef = doc(db, 'sync_jobs', jobId);
    await updateDoc(docRef, {
      batchProgress,
      lastProgressUpdate: new Date()
    });
  }

  static async getStalled(maxMinutes = 10) {
    const cutoffTime = new Date(Date.now() - maxMinutes * 60 * 1000);
    const q = query(
      collection(db, 'sync_jobs'),
      where('status', '==', 'running'),
      where('startedAt', '<', cutoffTime)
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  static async getByFeed(feedId, limitCount = 20) {
    const q = query(
      collection(db, 'sync_jobs'),
      where('feedId', '==', feedId),
      orderBy('createdAt', 'desc'),
      fbLimit(limitCount)
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }
}

export class ExportFeedModel {
  static async create(userId, exportFeedData) {
    // Generate UUID for public access
    const uuid = crypto.randomUUID();
    
    const docRef = await addDoc(collection(db, 'export_feeds'), {
      ...exportFeedData,
      userId,
      uuid,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      lastAccessedAt: null,
      accessCount: 0
    });
    return { id: docRef.id, uuid };
  }

  static async getByUser(userId) {
    const q = query(
      collection(db, 'export_feeds'),
      where('userId', '==', userId),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  static async getByUuid(uuid) {
    const q = query(
      collection(db, 'export_feeds'),
      where('uuid', '==', uuid),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    };
  }

  static async getById(exportFeedId) {
    const docRef = doc(db, 'export_feeds', exportFeedId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  }

  static async update(exportFeedId, updates) {
    const docRef = doc(db, 'export_feeds', exportFeedId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date()
    });
  }

  static async delete(exportFeedId) {
    const docRef = doc(db, 'export_feeds', exportFeedId);
    await updateDoc(docRef, {
      isActive: false,
      updatedAt: new Date()
    });
  }

  static async recordAccess(uuid) {
    const q = query(
      collection(db, 'export_feeds'),
      where('uuid', '==', uuid),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const docRef = snapshot.docs[0].ref;
      const currentData = snapshot.docs[0].data();
      await updateDoc(docRef, {
        lastAccessedAt: new Date(),
        accessCount: (currentData.accessCount || 0) + 1
      });
    }
  }

  static async getFilteredProducts(exportFeed) {
    let q = collection(db, 'products');
    const conditions = [];
    
    // Filter by user's feeds if no specific feed is set
    if (exportFeed.feedId) {
      conditions.push(where('feedId', '==', exportFeed.feedId));
    } else if (exportFeed.feedIds && exportFeed.feedIds.length > 0) {
      conditions.push(where('feedId', 'in', exportFeed.feedIds.slice(0, 10))); // Firestore limit
    }
    
    // Filter by brand (legacy support and single brand optimization)
    if (exportFeed.filters?.brand) {
      conditions.push(where('brand', '==', exportFeed.filters.brand));
    } else if (exportFeed.filters?.brands && exportFeed.filters.brands.length === 1) {
      conditions.push(where('brand', '==', exportFeed.filters.brands[0]));
    }
    
    if (conditions.length > 0) {
      q = query(q, ...conditions);
    }
    
    const snapshot = await getDocs(q);
    let products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Client-side filtering for complex conditions
    if (exportFeed.filters) {
      products = products.filter(product => {
        // Legacy filters (backward compatibility)
        if (exportFeed.filters.category) {
          const categoryMatch = (product.originalCategories || []).some(cat => 
            cat.toLowerCase().includes(exportFeed.filters.category.toLowerCase())
          );
          if (!categoryMatch) return false;
        }
        
        if (exportFeed.filters.emagCategoryId) {
          if (product.emagCategoryId !== exportFeed.filters.emagCategoryId) {
            return false;
          }
        }
        
        if (exportFeed.filters.emagCategoryName) {
          if (!product.emagCategory || 
              !product.emagCategory.toLowerCase().includes(exportFeed.filters.emagCategoryName.toLowerCase())) {
            return false;
          }
        }
        
        // New enhanced filters
        // Multi-brand filtering (if more than one brand or not handled at DB level)
        if (exportFeed.filters.brands && exportFeed.filters.brands.length > 1) {
          if (!exportFeed.filters.brands.includes(product.brand)) {
            return false;
          }
        }
        
        // Include categories filter
        if (exportFeed.filters.includeCategories && exportFeed.filters.includeCategories.length > 0) {
          const hasIncludedCategory = exportFeed.filters.includeCategories.some(filterCategory => 
            (product.originalCategories || []).some(productCategory => 
              productCategory.toLowerCase().includes(filterCategory.toLowerCase())
            )
          );
          if (!hasIncludedCategory) return false;
        }
        
        // Exclude categories filter
        if (exportFeed.filters.excludeCategories && exportFeed.filters.excludeCategories.length > 0) {
          const hasExcludedCategory = exportFeed.filters.excludeCategories.some(filterCategory => 
            (product.originalCategories || []).some(productCategory => 
              productCategory.toLowerCase().includes(filterCategory.toLowerCase())
            )
          );
          if (hasExcludedCategory) return false;
        }
        
        // Include eMAG categories filter
        if (exportFeed.filters.includeEmagCategories && exportFeed.filters.includeEmagCategories.length > 0) {
          const hasIncludedEmagCategory = exportFeed.filters.includeEmagCategories.some(filterCategory => 
            product.emagCategory && product.emagCategory.toLowerCase().includes(filterCategory.toLowerCase())
          );
          if (!hasIncludedEmagCategory) return false;
        }
        
        // Exclude eMAG categories filter
        if (exportFeed.filters.excludeEmagCategories && exportFeed.filters.excludeEmagCategories.length > 0) {
          const hasExcludedEmagCategory = exportFeed.filters.excludeEmagCategories.some(filterCategory => 
            product.emagCategory && product.emagCategory.toLowerCase().includes(filterCategory.toLowerCase())
          );
          if (hasExcludedEmagCategory) return false;
        }
        
        return true;
      });
    }
    
    // Deduplicate products based on their 'id' field
    // Keep the most recently updated version of each product
    const uniqueProducts = new Map();
    products.forEach(product => {
      const productId = product.id; // This is the original product ID from the feed
      const existing = uniqueProducts.get(productId);
      
      if (!existing || new Date(product.lastUpdated) > new Date(existing.lastUpdated)) {
        uniqueProducts.set(productId, product);
      }
    });
    
    products = Array.from(uniqueProducts.values());
    
    // Apply max items limit
    if (exportFeed.maxItems && parseInt(exportFeed.maxItems) > 0) {
      products = products.slice(0, parseInt(exportFeed.maxItems));
    }
    
    // Apply pricing multiplier
    if (exportFeed.pricingMultiplier && exportFeed.pricingMultiplier !== 1) {
      products = products.map(product => {
        const updatedProduct = { ...product };
        
        // Apply multiplier to price_b2c if it exists
        if (product.price_b2c !== undefined && product.price_b2c !== null) {
          const originalPriceB2C = parseFloat(product.price_b2c) || 0;
          updatedProduct.price_b2c = (originalPriceB2C * exportFeed.pricingMultiplier).toFixed(2);
        }
        
        // Apply multiplier to price_b2b if it exists
        if (product.price_b2b !== undefined && product.price_b2b !== null) {
          const originalPriceB2B = parseFloat(product.price_b2b) || 0;
          updatedProduct.price_b2b = (originalPriceB2B * exportFeed.pricingMultiplier).toFixed(2);
        }
        
        // Also apply to generic 'price' field if it exists (for backward compatibility)
        if (product.price !== undefined && product.price !== null) {
          const originalPrice = parseFloat(product.price) || 0;
          updatedProduct.price = (originalPrice * exportFeed.pricingMultiplier).toFixed(2);
        }
        
        return updatedProduct;
      });
    }
    
    return products;
  }
}

export class WebhookModel {
  static async create(userId, webhookData) {
    const docRef = await addDoc(collection(db, 'webhooks'), {
      ...webhookData,
      userId,
      createdAt: new Date(),
      isActive: true,
      lastTriggered: null
    });
    return docRef.id;
  }

  static async getByUser(userId) {
    const q = query(
      collection(db, 'webhooks'),
      where('userId', '==', userId),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  static async trigger(webhookId, data) {
    const docRef = doc(db, 'webhooks', webhookId);
    await updateDoc(docRef, {
      lastTriggered: new Date(),
      lastTriggerData: data
    });
  }

  static async getById(webhookId) {
    const docRef = doc(db, 'webhooks', webhookId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  }

  static async update(webhookId, updates) {
    const docRef = doc(db, 'webhooks', webhookId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date()
    });
  }
}