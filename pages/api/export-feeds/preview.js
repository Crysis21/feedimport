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
    const limit = Math.min(parseInt(formData.limit) || 10, 50); // Max 50 for preview

    // Get user's feed IDs
    const { FeedModel } = await import('../../../lib/models.js');
    const feeds = await FeedModel.getByUser(user.uid);
    const userFeedIds = feeds.map(feed => feed.id);

    if (userFeedIds.length === 0) {
      return res.json({ products: [] });
    }

    // Create a temporary export feed configuration for filtering
    const tempExportFeed = {
      feedId: formData.feedId || null,
      feedIds: formData.feedId ? [formData.feedId] : userFeedIds,
      filters: formData.filters || {},
      pricingMultiplier: formData.pricingMultiplier || 1
    };

    // Get filtered products using enhanced filtering
    const allProducts = await getFilteredProductsEnhanced(tempExportFeed);
    
    // Apply pricing multiplier for preview
    let products = allProducts.slice(0, limit);
    if (tempExportFeed.pricingMultiplier && tempExportFeed.pricingMultiplier !== 1) {
      products = products.map(product => {
        const updatedProduct = { ...product };
        
        // Apply multiplier to price_b2c if it exists
        if (product.price_b2c !== undefined && product.price_b2c !== null) {
          const originalPriceB2C = parseFloat(product.price_b2c) || 0;
          updatedProduct.price_b2c = (originalPriceB2C * tempExportFeed.pricingMultiplier).toFixed(2);
        }
        
        // Apply multiplier to price_b2b if it exists
        if (product.price_b2b !== undefined && product.price_b2b !== null) {
          const originalPriceB2B = parseFloat(product.price_b2b) || 0;
          updatedProduct.price_b2b = (originalPriceB2B * tempExportFeed.pricingMultiplier).toFixed(2);
        }
        
        // Also apply to generic 'price' field if it exists
        if (product.price !== undefined && product.price !== null) {
          const originalPrice = parseFloat(product.price) || 0;
          updatedProduct.price = (originalPrice * tempExportFeed.pricingMultiplier).toFixed(2);
        }
        
        return updatedProduct;
      });
    }

    return res.json({ 
      products,
      total: allProducts.length
    });

  } catch (error) {
    console.error('Error getting product preview:', error);
    return res.status(500).json({ error: 'Failed to get product preview' });
  }
}

async function getFilteredProductsEnhanced(exportFeed) {
  try {
    const { collection, query, where, getDocs, orderBy, limit } = await import('firebase/firestore');
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
    
    // Add ordering for consistent results
    conditions.push(orderBy('lastUpdated', 'desc'));
    
    // Limit to reasonable number for filtering
    conditions.push(limit(1000));
    
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