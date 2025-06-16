const fs = require('fs');
const path = require('path');

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchIndex() {
  console.log('Loading eMAG categories...');
  const rawData = fs.readFileSync('emag_mapping.json', 'utf8');
  const categories = JSON.parse(rawData);
  
  console.log(`Processing ${categories.length} categories...`);
  
  const searchIndex = {};
  const keywordMap = {};
  
  categories.forEach(category => {
    const normalizedTitle = normalizeText(category.title);
    const normalizedNomenclature = normalizeText(category.nomenclature_name);
    
    // Direct lookup index
    searchIndex[normalizedTitle] = {
      key: category.key,
      title: category.title,
      path: category.path,
      pathDepth: category.pathDepth
    };
    
    searchIndex[normalizedNomenclature] = {
      key: category.key,
      title: category.title,
      path: category.path,
      pathDepth: category.pathDepth
    };
    
    // Keyword index
    const words = [...normalizedTitle.split(' '), ...normalizedNomenclature.split(' ')]
      .filter(word => word.length > 2);
    
    words.forEach(word => {
      if (!keywordMap[word]) {
        keywordMap[word] = [];
      }
      keywordMap[word].push({
        key: category.key,
        title: category.title,
        path: category.path,
        pathDepth: category.pathDepth,
        score: 1.0 / words.length
      });
    });
  });
  
  // Sort keyword matches by relevance
  Object.keys(keywordMap).forEach(word => {
    keywordMap[word].sort((a, b) => b.pathDepth - a.pathDepth || b.score - a.score);
    keywordMap[word] = keywordMap[word].slice(0, 10); // Keep top 10 matches per keyword
  });
  
  const optimizedIndex = {
    searchIndex,
    keywordMap,
    metadata: {
      totalCategories: categories.length,
      buildDate: new Date().toISOString()
    }
  };
  
  console.log('Writing optimized index...');
  fs.writeFileSync('lib/categoryIndex.json', JSON.stringify(optimizedIndex, null, 2));
  
  console.log('Index built successfully!');
  console.log(`- Direct lookups: ${Object.keys(searchIndex).length}`);
  console.log(`- Keywords indexed: ${Object.keys(keywordMap).length}`);
}

buildSearchIndex();