import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

// Load .env.local file
dotenv.config({ path: '.env.local' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let emagCategories = null;

function loadEmagCategories() {
  if (!emagCategories) {
    const filePath = path.join(process.cwd(), 'emag_mapping.json');
    emagCategories = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return emagCategories;
}

export async function matchCategoryWithAI(productInfo) {
  console.log(`🔍 Loading eMAG categories...`);
  const categories = loadEmagCategories();
  console.log(`📋 Loaded ${categories.length} eMAG categories`);
  
  console.log(`🔑 Checking Gemini API key...`);
  if (!process.env.GEMINI_API_KEY) {
    console.error(`❌ GEMINI_API_KEY not found in environment variables`);
    return null;
  }
  console.log(`✅ Gemini API key found (length: ${process.env.GEMINI_API_KEY.length})`);
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  
  const categoryList = categories.map(cat => `${cat.key}: ${cat.title} (${cat.nomenclature_name || 'N/A'})`).join('\n');
  
  const prompt = `
Based on the following product information, select the most appropriate eMAG category from the list below.

Product Information:
- Title: ${productInfo.title || 'N/A'}
- Description: ${productInfo.description || 'N/A'}
- Original Categories: ${Array.isArray(productInfo.originalCategories) ? productInfo.originalCategories.join(', ') : (productInfo.originalCategories || 'N/A')}
- Brand: ${productInfo.brand || 'N/A'}
- Price: ${productInfo.price || 'N/A'}

Available eMAG Categories:
${categoryList}

Instructions:
1. Analyze the product information carefully
2. Find the most specific and relevant category that matches the product
3. Consider the product's primary function and target audience
4. Avoid generic categories unless no specific match exists
5. Return ONLY the category key number, nothing else

Category Key:`;

  try {
    console.log(`🚀 Sending request to Gemini API...`);
    console.log(`📝 Prompt length: ${prompt.length} characters`);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const categoryKey = response.text().trim();
    
    console.log(`🤖 Gemini response: "${categoryKey}"`);
    
    const matchedCategory = categories.find(cat => cat.key === parseInt(categoryKey));
    
    if (matchedCategory) {
      console.log(`✅ Found matching category: ${matchedCategory.title}`);
      return {
        id: matchedCategory.key,
        title: matchedCategory.title,
        nomenclature: matchedCategory.nomenclature_name,
        path: matchedCategory.path,
        confidence: 0.95
      };
    } else {
      console.log(`❌ No category found for key: ${categoryKey}`);
      console.log(`🔍 Available keys: ${categories.slice(0, 5).map(cat => cat.key).join(', ')}...`);
    }
    
    return null;
  } catch (error) {
    console.error('❌ Gemini API error:', error.message);
    console.error('🔍 Error details:', error);
    return null;
  }
}

export async function matchCategoriesInBatch(products) {
  console.log(`🔍 Loading eMAG categories for batch processing...`);
  const categories = loadEmagCategories();
  console.log(`📋 Loaded ${categories.length} eMAG categories`);
  
  console.log(`🔑 Checking Gemini API key...`);
  if (!process.env.GEMINI_API_KEY) {
    console.error(`❌ GEMINI_API_KEY not found in environment variables`);
    return [];
  }
  console.log(`✅ Gemini API key found (length: ${process.env.GEMINI_API_KEY.length})`);
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  
  // Filter to only leaf categories (categories with no children)
  const leafCategories = categories.filter(cat => 
    !cat.allChildren || cat.allChildren.length === 0
  );
  console.log(`🍃 Found ${leafCategories.length} leaf categories out of ${categories.length} total`);
  
  const categoryList = leafCategories.map(cat => 
    `${cat.key}: ${cat.title} (${cat.nomenclature_name || 'N/A'})`
  ).join('\n');
  
  // Debug: Check originalCategories structure
  if (products.length > 0) {
    console.log(`🔍 Debugging first product originalCategories:`, {
      type: typeof products[0].originalCategories,
      isArray: Array.isArray(products[0].originalCategories),
      value: products[0].originalCategories,
      title: products[0].title
    });
  }

  // Build product list for batch processing
  const productList = products.map((product, index) => `
Product ${index + 1}:
- Title: ${product.title || 'N/A'}
- Description: ${(product.description || 'N/A').substring(0, 200)}${product.description?.length > 200 ? '...' : ''}
- Original Categories: ${Array.isArray(product.originalCategories) ? product.originalCategories.join(', ') : (product.originalCategories || 'N/A')}
- Brand: ${product.brand || 'N/A'}
- Price: ${product.price || 'N/A'}
- SKU: ${product.sku || 'N/A'}
`).join('\n');

  const prompt = `
You are an expert product categorization AI. Process the following ${products.length} products and match each to the most appropriate eMAG category.

IMPORTANT RULES:
1. Only select from LEAF CATEGORIES (most specific categories with no subcategories)
2. Choose the most specific and relevant category for each product
3. Consider the product's primary function, target audience, and use case
4. If no perfect match exists, choose the closest leaf category
5. Return results in JSON format as an array of objects

Products to categorize:
${productList}

Available LEAF Categories (choose ONLY from these):
${categoryList}

Return a JSON array with exactly ${products.length} objects in this format:
[
  {
    "productIndex": 1,
    "categoryKey": 123,
    "confidence": "high|medium|low",
    "reasoning": "brief explanation"
  }
]

JSON Response:`;

  try {
    console.log(`🚀 Sending batch request to Gemini API for ${products.length} products...`);
    console.log(`📝 Prompt length: ${prompt.length} characters`);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text().trim();
    
    console.log(`🤖 Gemini batch response received (${responseText.length} characters)`);
    
    // Parse JSON response
    let matches;
    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        matches = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON array found in response');
      }
    } catch (parseError) {
      console.error(`❌ Failed to parse JSON response:`, parseError.message);
      console.log(`📝 Raw response:`, responseText.substring(0, 500));
      return [];
    }
    
    if (!Array.isArray(matches)) {
      console.error(`❌ Response is not an array`);
      return [];
    }
    
    // Process and validate matches
    const results = [];
    for (let i = 0; i < products.length; i++) {
      const match = matches.find(m => m.productIndex === i + 1);
      
      if (match && match.categoryKey) {
        const matchedCategory = leafCategories.find(cat => cat.key === parseInt(match.categoryKey));
        
        if (matchedCategory) {
          results.push({
            productIndex: i,
            categoryMatch: {
              id: matchedCategory.key,
              title: matchedCategory.title,
              nomenclature: matchedCategory.nomenclature_name,
              path: matchedCategory.path,
              confidence: match.confidence || 'medium',
              reasoning: match.reasoning || 'AI categorization'
            }
          });
          console.log(`✅ Product ${i + 1}: "${products[i].title}" → ${matchedCategory.title}`);
        } else {
          console.log(`❌ Product ${i + 1}: Invalid category key ${match.categoryKey}`);
          results.push({
            productIndex: i,
            categoryMatch: null
          });
        }
      } else {
        console.log(`❌ Product ${i + 1}: No category match found`);
        results.push({
          productIndex: i,
          categoryMatch: null
        });
      }
    }
    
    console.log(`📊 Batch processing complete: ${results.filter(r => r.categoryMatch).length}/${products.length} products categorized`);
    return results;
    
  } catch (error) {
    console.error('❌ Gemini batch API error:', error.message);
    console.error('🔍 Error details:', error);
    return [];
  }
}