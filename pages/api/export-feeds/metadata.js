import { ProductModel } from '../../../lib/models.js';
import { verifyAuth } from '../../../lib/auth.js';
import emagCategories from '../../../emag_mapping.json';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await verifyAuth(req);
    
    // Get user's feed IDs
    const { FeedModel } = await import('../../../lib/models.js');
    const feeds = await FeedModel.getByUser(user.uid);
    const feedIds = feeds.map(feed => feed.id);

    if (feedIds.length === 0) {
      return res.json({
        brands: [],
        originalCategories: [],
        emagCategories: []
      });
    }

    // Get brands (reuse existing method)
    const brands = await ProductModel.getBrandsByUser(feedIds);

    // Get unique original categories from user's products
    const originalCategories = await getOriginalCategoriesByUser(feedIds);

    // Transform eMAG categories for frontend use
    const transformedEmagCategories = emagCategories.map(cat => ({
      id: cat.key,
      title: cat.title,
      path: cat.path || cat.title,
      parent: cat.parent
    }));

    return res.json({
      brands: brands || [],
      originalCategories: originalCategories || [],
      emagCategories: transformedEmagCategories || []
    });

  } catch (error) {
    console.error('Error fetching metadata:', error);
    return res.status(500).json({ error: 'Failed to fetch metadata' });
  }
}

async function getOriginalCategoriesByUser(feedIds) {
  try {
    const { collection, query, where, getDocs } = await import('firebase/firestore');
    const { db } = await import('../../../lib/firebase.js');
    
    const q = query(
      collection(db, 'products'),
      where('feedId', 'in', feedIds.slice(0, 10))
    );
    
    const snapshot = await getDocs(q);
    const categoriesSet = new Set();
    
    snapshot.docs.forEach(doc => {
      const product = doc.data();
      if (product.originalCategories && Array.isArray(product.originalCategories)) {
        product.originalCategories.forEach(category => {
          if (category && category.trim()) {
            categoriesSet.add(category.trim());
          }
        });
      }
    });
    
    return Array.from(categoriesSet).sort();
  } catch (error) {
    console.error('Error fetching original categories:', error);
    return [];
  }
}