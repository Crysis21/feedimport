import { ProductModel, FeedModel } from '../../../lib/models.js';
import { auth } from '../../../lib/firebase.js';
import { collection, query, where, orderBy, limit as fbLimit, getDocs, startAfter, getDoc, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the user ID from the session/token
    const { userId } = req.query;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const {
      search = '',
      brand = '',
      feedId = '',
      categoryProcessed = '',
      limit = 50,
      offset = 0
    } = req.query;

    // Get user's feeds to filter products
    const userFeeds = await FeedModel.getByUser(userId);
    const feedIds = userFeeds.map(feed => feed.id);

    if (feedIds.length === 0) {
      return res.json({
        products: [],
        total: 0,
        brands: [],
        feeds: [],
        processingStats: { processed: 0, unprocessed: 0, total: 0 }
      });
    }

    // Build filters for the dashboard
    const filters = {
      feedIds,
      search: search.toLowerCase().trim(),
      brand: brand.trim(),
      feedId: feedId.trim(),
      categoryProcessed: categoryProcessed === '' ? null : categoryProcessed === 'true',
      limit: Math.min(parseInt(limit) || 50, 100), // Max 100 products per request
      offset: parseInt(offset) || 0
    };

    // Get products with dashboard-specific filtering
    const result = await ProductModel.getForDashboard(filters);
    
    // Get all unique brands for filter dropdown
    const brands = await ProductModel.getBrandsByUser(feedIds);
    
    // Get processing statistics
    const processingStats = await ProductModel.getProcessingStats(feedIds);

    return res.json({
      products: result.products,
      total: result.total,
      brands,
      feeds: userFeeds.map(feed => ({ id: feed.id, name: feed.name, url: feed.url })),
      processingStats,
      filters: {
        search: search || null,
        brand: brand || null,
        feedId: feedId || null,
        categoryProcessed: categoryProcessed || null
      }
    });

  } catch (error) {
    console.error('Dashboard products API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}