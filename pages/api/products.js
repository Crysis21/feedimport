import { ProductModel } from '../../lib/models.js';
import { verifyApiKey } from '../../lib/auth.js';
import xml2js from 'xml2js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const userId = verifyApiKey(apiKey);
    
    const {
      feedId,
      brand,
      format = 'json',
      limit = 1000,
      offset = 0
    } = req.query;

    const filters = {
      feedId,
      brand,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const products = await ProductModel.getForFeedAPI(filters);

    if (format === 'xml') {
      return await handleXMLResponse(res, products);
    }

    return res.json({
      products,
      total: products.length,
      filters: {
        feedId: feedId || null,
        brand: brand || null
      }
    });

  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
}

async function handleXMLResponse(res, products) {
  const builder = new xml2js.Builder({
    rootName: 'rss',
    xmldec: { version: '1.0', encoding: 'UTF-8' }
  });

  const xmlData = {
    $: { version: '2.0' },
    channel: [{
      title: 'Product Feed',
      description: 'Synchronized product feed',
      link: 'https://your-domain.com',
      item: products.map(product => ({
        title: product.title,
        description: product.description,
        link: product.link,
        'g:id': product.sku,
        'g:price': product.price,
        'g:availability': product.availability,
        'g:condition': product.condition,
        'g:brand': product.brand,
        'g:image_link': product.image,
        'g:gtin': product.gtin,
        'g:mpn': product.mpn,
        'g:quantity': product.stockQuantity,
        category: product.originalCategories,
        emag_category: product.emagCategory,
        emag_category_key: product.emagCategoryId,
        emag_category_path: product.emagCategoryPath,
        updated_at: product.lastUpdated
      }))
    }]
  };

  const xml = builder.buildObject(xmlData);
  
  res.setHeader('Content-Type', 'application/xml');
  return res.send(xml);
}