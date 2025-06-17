import xml2js from 'xml2js';
import { ExportFeedModel } from '../../../lib/models.js';

export default async function handler(req, res) {
  const { uuid } = req.query;
  
  if (!uuid) {
    return res.status(400).json({ error: 'UUID parameter is required' });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', ['GET', 'HEAD']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Find the export feed by UUID
    const exportFeed = await ExportFeedModel.getByUuid(uuid);
    if (!exportFeed) {
      return res.status(404).json({ error: 'Export feed not found' });
    }

    // Record access for analytics (only for GET requests, not HEAD)
    if (req.method === 'GET') {
      await ExportFeedModel.recordAccess(uuid);
    }

    // Set common headers for both GET and HEAD requests
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="export-feed.xml"');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minute cache

    // For HEAD requests, just return headers without body
    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    // Get filtered products based on export feed configuration (only for GET)
    const products = await ExportFeedModel.getFilteredProducts(exportFeed);
    
    if (products.length === 0) {
      // Return empty XML structure
      const emptyXml = generateEmptyXML();
      return res.status(200).send(emptyXml);
    }

    // Convert products to XML format matching the original structure
    const xmlData = generateProductsXML(products);
    res.status(200).send(xmlData);
    
  } catch (error) {
    console.error('Error generating export feed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function generateEmptyXML() {
  const builder = new xml2js.Builder();
  const emptyData = {
    products: {
      product: []
    }
  };
  return builder.buildObject(emptyData);
}

function generateProductsXML(products) {
  const builder = new xml2js.Builder();
  
  const xmlProducts = products.map(product => ({
    id: [product.sku || ''],
    name: [product.title || ''],
    description: [product.description || ''],
    url: [product.link || ''],
    price_b2c: [product.price || ''],
    quantity: [product.stockQuantity?.toString() || '0'],
    brand: [product.brand || ''],
    avatar: [product.image || ''],
    model: [product.mpn || ''],
    categories: [{
      category: product.originalCategories || []
    }],
    // Add eMAG category fields if available
    ...(product.emagCategory && {
      emag_category: [product.emagCategory],
      emag_category_key: [product.emagCategoryId?.toString() || ''],
      emag_category_path: [product.emagCategoryPath || '']
    }),
    // Add filtered category string
    category: [generateCategoryString(product.originalCategories)]
  }));

  const xmlData = {
    products: {
      product: xmlProducts
    }
  };

  return builder.buildObject(xmlData);
}

function generateCategoryString(categories) {
  if (!categories || !Array.isArray(categories)) {
    return '';
  }
  
  const excludedCategories = ['Jucarii', 'Jocuri', 'Toate'];
  const filteredCategories = categories.filter(cat => !excludedCategories.includes(cat));
  const sortedCategories = filteredCategories.sort();
  return sortedCategories.join(' ');
}

// Export configuration for Vercel
export const config = {
  api: {
    responseLimit: '8mb', // Allow larger XML responses
  },
};