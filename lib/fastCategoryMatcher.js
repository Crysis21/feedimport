const categoryIndex = require('./categoryIndex.json');

class FastCategoryMatcher {
  constructor() {
    this.searchIndex = categoryIndex.searchIndex;
    this.keywordMap = categoryIndex.keywordMap;
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

  findBestMatch(inputCategories) {
    const processedInput = inputCategories
      .filter(cat => !['jucarii', 'jocuri', 'toate'].includes(cat.toLowerCase()))
      .map(cat => this.normalizeText(cat));

    let bestMatch = null;
    let bestScore = 0;

    for (const input of processedInput) {
      // Try exact match first
      const exactMatch = this.searchIndex[input];
      if (exactMatch) {
        return exactMatch;
      }

      // Try keyword matching
      const words = input.split(' ').filter(word => word.length > 2);
      const candidates = new Map();

      words.forEach(word => {
        if (this.keywordMap[word]) {
          this.keywordMap[word].forEach(match => {
            const existing = candidates.get(match.key) || { match, score: 0, matches: 0 };
            existing.score += match.score;
            existing.matches += 1;
            candidates.set(match.key, existing);
          });
        }
      });

      // Find best candidate
      for (const [key, candidate] of candidates) {
        const score = (candidate.score * candidate.matches) / words.length;
        if (score > bestScore && score > 0.3) {
          bestMatch = candidate.match;
          bestScore = score;
        }
      }
    }

    return bestMatch;
  }

  // Simple matching for common categories
  getQuickMatch(categories) {
    const quickMatches = {
      'de bebe': { key: 1691, title: 'Mama si copilul', path: 'Mama si copilul', pathDepth: 1 },
      'jucarii montessori': { key: 1798, title: 'Jucarii educative', path: 'Mama si copilul > Jucarii > Jucarii educative', pathDepth: 3 },
      'carti': { key: 144, title: 'Carti', path: 'Carti', pathDepth: 1 },
      'haine': { key: 1547, title: 'Apparel Woman', path: 'Apparel Woman', pathDepth: 1 }
    };

    for (const category of categories) {
      const normalized = this.normalizeText(category);
      if (quickMatches[normalized]) {
        return quickMatches[normalized];
      }
    }

    return null;
  }
}

module.exports = FastCategoryMatcher;