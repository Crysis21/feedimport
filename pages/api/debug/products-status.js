import { collection, query, where, getDocs, limit as fbLimit } from 'firebase/firestore';
import { db } from '../../../lib/firebase.js';

export default async function handler(req, res) {
  console.log('Debug endpoint called');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting database queries...');
    
    // Get all products first
    const allProductsQ = query(collection(db, 'products'));
    const allSnapshot = await getDocs(allProductsQ);
    console.log(`Found ${allSnapshot.size} total products`);
    
    if (allSnapshot.size === 0) {
      return res.json({
        error: 'No products found in database',
        totalProducts: 0
      });
    }

    // Analyze categoryProcessed field values
    let processedTrue = 0;
    let processedFalse = 0;
    let processedUndefined = 0;
    let processedNull = 0;
    
    const sampleProducts = [];
    
    allSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const categoryProcessed = data.categoryProcessed;
      
      if (categoryProcessed === true) {
        processedTrue++;
      } else if (categoryProcessed === false) {
        processedFalse++;
      } else if (categoryProcessed === undefined) {
        processedUndefined++;
      } else if (categoryProcessed === null) {
        processedNull++;
      }
      
      // Get first 5 products as samples
      if (index < 5) {
        sampleProducts.push({
          id: doc.id,
          title: data.title,
          categoryProcessed: data.categoryProcessed,
          emagCategory: data.emagCategory,
          feedId: data.feedId
        });
      }
    });

    const result = {
      totalProducts: allSnapshot.size,
      categoryProcessedStats: {
        true: processedTrue,
        false: processedFalse,
        undefined: processedUndefined,
        null: processedNull
      },
      sampleProducts,
      message: `Found ${processedFalse} products with categoryProcessed=false that should be processed`
    };
    
    console.log('Debug result:', result);
    return res.json(result);

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
}