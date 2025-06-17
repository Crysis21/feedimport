import { db } from '../../../lib/firebase.js';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Simple counts without complex queries
    const [feedsSnapshot, productsSnapshot, jobsSnapshot] = await Promise.all([
      getDocs(collection(db, 'feeds')),
      getDocs(query(collection(db, 'products'), limit(10))),
      getDocs(query(collection(db, 'sync_jobs'), limit(20)))
    ]);

    const feeds = feedsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const products = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const jobs = jobsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Simple analysis
    const jobsByStatus = jobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});

    const activeFeedsCount = feeds.filter(f => f.status === 'active' && !f.isPaused).length;
    const processedProductsCount = products.filter(p => p.categoryProcessed === true).length;

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalFeeds: feeds.length,
        activeFeeds: activeFeedsCount,
        pausedFeeds: feeds.filter(f => f.isPaused).length,
        totalProducts: products.length,
        processedProducts: processedProductsCount,
        unprocessedProducts: products.length - processedProductsCount,
        totalJobs: jobs.length,
        jobsByStatus
      },
      recentFeeds: feeds.slice(0, 5).map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        status: f.status,
        isPaused: f.isPaused,
        lastSyncAt: f.lastSyncAt,
        syncInterval: f.syncInterval
      })),
      recentJobs: jobs.slice(0, 10).map(j => ({
        id: j.id,
        feedId: j.feedId,
        status: j.status,
        type: j.type,
        itemsProcessed: j.itemsProcessed || 0,
        itemsTotal: j.itemsTotal || 0,
        createdAt: j.createdAt,
        error: j.error
      })),
      diagnostics: {
        cronShouldBeWorking: activeFeedsCount > 0,
        indexesBuilding: 'Check Firebase Console for index status',
        recommendedAction: jobs.length === 0 && activeFeedsCount > 0 ? 
          'No jobs found but feeds exist - cron might not be running' : 
          'System appears normal'
      }
    });

  } catch (error) {
    console.error('Simple status error:', error);
    return res.status(500).json({ 
      error: error.message,
      details: 'This is a simplified status endpoint while indexes are building'
    });
  }
}