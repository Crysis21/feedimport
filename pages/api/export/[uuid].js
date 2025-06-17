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
  
  const xmlProducts = products.map(product => {
    // Start with all original fields
    const xmlProduct = {};
    
    // Add ALL original fields that were preserved
    const originalFields = [
      'id', 'name', 'description', 'url', 'price_b2c', 'price_b2b', 'quantity', 
      'brand', 'avatar', 'model', 'sku', 'TVA', 'gen', 'greutate', 'latime', 
      'lungime', 'varsta', 'image_additional1', 'image_additional2', 
      'image_additional3', 'image_additional4'
    ];
    
    // Include all original fields if they exist
    originalFields.forEach(field => {
      if (product[field] !== undefined && product[field] !== null) {
        xmlProduct[field] = [product[field]];
      }
    });
    
    // Add any other fields that might be in the product but not in our standard list
    Object.keys(product).forEach(key => {
      if (!originalFields.includes(key) && 
          !['title', 'link', 'image', 'stockQuantity', 'availability', 'condition', 
            'originalCategories', 'emagCategory', 'emagCategoryId', 'emagCategoryPath',
            'categoryProcessed', 'categoryUpdatedAt', 'feedId', 'lastUpdated', 'createdAt'].includes(key)) {
        if (product[key] !== undefined && product[key] !== null) {
          xmlProduct[key] = [product[key]];
        }
      }
    });
    
    // Handle categories specially
    if (product.originalCategories && product.originalCategories.length > 0) {
      xmlProduct.categories = [{
        category: product.originalCategories
      }];
    } else if (product.categories) {
      xmlProduct.categories = [{
        category: Array.isArray(product.categories) ? product.categories : [product.categories]
      }];
    }
    
    // Add eMAG category fields if available (our enhancements)
    if (product.emagCategory) {
      xmlProduct.emag_category = [product.emagCategory];
      xmlProduct.emag_category_key = [product.emagCategoryId?.toString() || ''];
      xmlProduct.emag_category_path = [product.emagCategoryPath || ''];
    }
    
    // Add filtered category string for compatibility
    const categoryString = generateCategoryString(product.originalCategories || product.categories);
    if (categoryString) {
      xmlProduct.category = [categoryString];
    }

    return xmlProduct;
  });

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