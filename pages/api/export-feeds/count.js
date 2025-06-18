import { ExportFeedModel } from '../../../lib/models.js';
import { verifyAuth } from '../../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await verifyAuth(req);
    const formData = req.body;

    // Get user's feed IDs
    const { FeedModel } = await import('../../../lib/models.js');
    const feeds = await FeedModel.getByUser(user.uid);
    const userFeedIds = feeds.map(feed => feed.id);

    if (userFeedIds.length === 0) {
      return res.json({ count: 0 });
    }

    // Create a temporary export feed configuration for filtering
    const tempExportFeed = {
      feedId: formData.feedId || null,
      feedIds: formData.feedId ? [formData.feedId] : userFeedIds,
      filters: formData.filters || {},
      pricingMultiplier: formData.pricingMultiplier || 1
    };

    // Get filtered products using enhanced filtering
    const products = await getFilteredProductsEnhanced(tempExportFeed);
    
    // Apply max items limit if specified
    let count = products.length;
    if (formData.maxItems && parseInt(formData.maxItems) > 0) {
      count = Math.min(count, parseInt(formData.maxItems));
    }

    return res.json({ count });

  } catch (error) {
    console.error('Error counting products:', error);
    return res.status(500).json({ error: 'Failed to count products' });
  }
}

async function getFilteredProductsEnhanced(exportFeed) {
  try {
    const { collection, query, where, getDocs } = await import('firebase/firestore');
    const { db } = await import('../../../lib/firebase.js');
    
    let q = collection(db, 'products');
    const conditions = [];
    
    // Filter by user's feeds
    if (exportFeed.feedId) {
      conditions.push(where('feedId', '==', exportFeed.feedId));
    } else if (exportFeed.feedIds && exportFeed.feedIds.length > 0) {
      conditions.push(where('feedId', 'in', exportFeed.feedIds.slice(0, 10))); // Firestore limit
    }
    
    // Filter by brands at database level if only one brand is selected
    if (exportFeed.filters?.brands && exportFeed.filters.brands.length === 1) {
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
        // Multi-brand filtering (if more than one brand)
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
    const uniqueProducts = new Map();
    products.forEach(product => {
      const productId = product.id;
      const existing = uniqueProducts.get(productId);
      
      if (!existing || new Date(product.lastUpdated) > new Date(existing.lastUpdated)) {
        uniqueProducts.set(productId, product);
      }
    });
    
    return Array.from(uniqueProducts.values());
    
  } catch (error) {
    console.error('Error in getFilteredProductsEnhanced:', error);
    return [];
  }
}