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
  
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  const categoryList = categories.map(cat => `${cat.key}: ${cat.title} (${cat.nomenclature_name || 'N/A'})`).join('\n');
  
  const prompt = `
Based on the following product information, select the most appropriate eMAG category from the list below.

Product Information:
- Title: ${productInfo.title || 'N/A'}
- Description: ${productInfo.description || 'N/A'}
- Original Categories: ${productInfo.originalCategories?.join(', ') || 'N/A'}
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