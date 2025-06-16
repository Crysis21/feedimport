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
    const productId = `${feedId}_${productData.sku || productData.id}`;
    
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
    
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
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
      itemsTotal: 0
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

  static async getActive() {
    const q = query(
      collection(db, 'sync_jobs'),
      where('status', 'in', ['pending', 'running']),
      orderBy('createdAt', 'asc')
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