const fs = require('fs');
const path = require('path');

class CategoryMatcher {
  constructor() {
    this.categories = [];
    this.searchIndex = new Map();
    this.keywordIndex = new Map();
    this.loaded = false;
  }

  loadCategories() {
    if (this.loaded) return;
    
    try {
      const filePath = path.join(process.cwd(), 'emag_mapping.json');
      const data = fs.readFileSync(filePath, 'utf8');
      const categories = JSON.parse(data);
      
      this.categories = categories;
      this.buildSearchIndex();
      this.loaded = true;
    } catch (error) {
      console.error('Error loading eMAG categories:', error);
      throw error;
    }
  }

  buildSearchIndex() {
    this.categories.forEach(category => {
      const normalizedTitle = this.normalizeText(category.title);
      const normalizedNomenclature = this.normalizeText(category.nomenclature_name);
      const normalizedPath = this.normalizeText(category.path);
      
      this.searchIndex.set(normalizedTitle, category);
      this.searchIndex.set(normalizedNomenclature, category);
      
      this.indexKeywords(normalizedTitle, category);
      this.indexKeywords(normalizedNomenclature, category);
      this.indexKeywords(normalizedPath, category);
    });
  }

  normalizeText(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  indexKeywords(text, category) {
    const words = text.split(' ').filter(word => word.length > 2);
    words.forEach(word => {
      if (!this.keywordIndex.has(word)) {
        this.keywordIndex.set(word, []);
      }
      this.keywordIndex.get(word).push(category);
    });
  }

  findBestMatch(inputCategories) {
    if (!this.loaded) this.loadCategories();
    
    const results = [];
    const processedInput = inputCategories
      .filter(cat => !['jucarii', 'jocuri', 'toate'].includes(cat.toLowerCase()))
      .map(cat => this.normalizeText(cat));

    for (const input of processedInput) {
      let bestMatch = null;
      let bestScore = 0;

      const exactMatch = this.searchIndex.get(input);
      if (exactMatch) {
        bestMatch = exactMatch;
        bestScore = 1.0;
      } else {
        const fuzzyMatch = this.findFuzzyMatch(input);
        if (fuzzyMatch.score > bestScore) {
          bestMatch = fuzzyMatch.category;
          bestScore = fuzzyMatch.score;
        }

        const keywordMatch = this.findKeywordMatch(input);
        if (keywordMatch.score > bestScore) {
          bestMatch = keywordMatch.category;
          bestScore = keywordMatch.score;
        }
      }

      if (bestMatch && bestScore > 0.3) {
        results.push({
          input: input,
          match: bestMatch,
          score: bestScore,
          matchType: bestScore === 1.0 ? 'exact' : bestScore > 0.7 ? 'fuzzy' : 'keyword'
        });
      }
    }

    return this.selectBestCategory(results);
  }

  findFuzzyMatch(input) {
    let bestMatch = null;
    let bestScore = 0;

    for (const [key, category] of this.searchIndex) {
      const score = this.calculateSimilarity(input, key);
      if (score > bestScore && score > 0.6) {
        bestMatch = category;
        bestScore = score;
      }
    }

    return { category: bestMatch, score: bestScore };
  }

  findKeywordMatch(input) {
    const words = input.split(' ').filter(word => word.length > 2);
    const matchCounts = new Map();

    words.forEach(word => {
      if (this.keywordIndex.has(word)) {
        this.keywordIndex.get(word).forEach(category => {
          const count = matchCounts.get(category.key) || 0;
          matchCounts.set(category.key, count + 1);
        });
      }
    });

    let bestMatch = null;
    let bestScore = 0;

    for (const [key, count] of matchCounts) {
      const category = this.categories.find(c => c.key === key);
      const score = count / words.length;
      if (score > bestScore) {
        bestMatch = category;
        bestScore = score;
      }
    }

    return { category: bestMatch, score: bestScore };
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  selectBestCategory(results) {
    if (results.length === 0) return null;

    results.sort((a, b) => {
      if (a.match.pathDepth !== b.match.pathDepth) {
        return b.match.pathDepth - a.match.pathDepth;
      }
      return b.score - a.score;
    });

    return results[0].match;
  }
}

module.exports = CategoryMatcher;