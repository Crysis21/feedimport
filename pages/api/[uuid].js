const xml2js = require('xml2js');
const FastCategoryMatcher = require('../../lib/fastCategoryMatcher');

export default async function handler(req, res) {
  const { uuid } = req.query;
  
  if (!uuid) {
    return res.status(400).json({ error: 'UUID parameter is required' });
  }

  // Support both GET and HEAD methods
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', ['GET', 'HEAD']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const feedUrl = `https://www.boribon.ro/feed/products/${uuid}`;
    
    const response = await fetch(feedUrl);
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Failed to fetch feed: ${response.statusText}` 
      });
    }
    
    const xmlData = await response.text();
    
    const parser = new xml2js.Parser();
    const builder = new xml2js.Builder();
    
    const result = await parser.parseStringPromise(xmlData);
    
    if (result.products && result.products.product && Array.isArray(result.products.product)) {
      const categoryMatcher = new FastCategoryMatcher();
      
      result.products.product.forEach(product => {
        if (product.categories && product.categories[0] && product.categories[0].category) {
          const categories = product.categories[0].category;
          const excludedCategories = ['Jucarii', 'Jocuri', 'Toate'];
          const filteredCategories = categories.filter(cat => !excludedCategories.includes(cat));
          const sortedCategories = filteredCategories.sort();
          const categoryString = sortedCategories.join(' ');
          product.category = [categoryString];
          
          // Try quick match first, then full matching
          let bestMatch = categoryMatcher.getQuickMatch(categories);
          if (!bestMatch) {
            bestMatch = categoryMatcher.findBestMatch(categories);
          }
          
          if (bestMatch) {
            product.emag_category = [bestMatch.title];
            product.emag_category_key = [bestMatch.key.toString()];
            product.emag_category_path = [bestMatch.path];
          }
        }
      });
    }
    
    // Set headers for both GET and HEAD requests
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="feed.xml"');
    
    // For HEAD requests, just return headers without body
    if (req.method === 'HEAD') {
      return res.status(200).end();
    }
    
    const transformedXml = builder.buildObject(result);
    res.status(200).send(transformedXml);
    
  } catch (error) {
    console.error('Error processing feed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}