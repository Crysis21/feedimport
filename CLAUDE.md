# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Vercel-deployed XML feed transformation service that fetches product feeds from boribon.ro and transforms them for eMAG marketplace compatibility. The service adds intelligent category matching using a pre-built eMAG category database.

## Architecture

### Core Components

**API Layer (`api/[uuid].js`)**
- Vercel serverless function handling UUID-based requests
- Fetches XML from `https://www.boribon.ro/feed/products/{uuid}`
- Transforms XML structure and adds eMAG-compatible fields
- Returns modified XML with category mappings

**Category Matching System**
- `lib/fastCategoryMatcher.js`: Fast category matcher using pre-built indexes
- `lib/categoryIndex.json`: Pre-built search index (4,803 direct lookups + 3,926 keywords)
- `emag_mapping.json`: Raw eMAG category database (2,575 categories)
- `scripts/buildIndex.js`: Script to regenerate the optimized category index

### Data Flow

1. Client requests `/api/{uuid}`
2. Service fetches XML from boribon.ro
3. XML parsed and product categories extracted
4. FastCategoryMatcher finds best eMAG category matches
5. XML rebuilt with additional fields:
   - `<category>` - Filtered and sorted original categories
   - `<emag_category>` - Matched eMAG category title
   - `<emag_category_key>` - eMAG category ID
   - `<emag_category_path>` - Full hierarchical path

## Commands

### Development
```bash
npm run dev          # Start Vercel development server
vercel dev           # Alternative development command
```

### Deployment
```bash
vercel --prod        # Deploy to production
```

### Category Index Management
```bash
node scripts/buildIndex.js    # Rebuild category search index after emag_mapping.json changes
```

## Category Matching Logic

The category matcher uses a multi-tier approach:

1. **Quick Match**: Instant lookup for common categories (de bebe → Mama si copilul)
2. **Exact Match**: Direct title/nomenclature matches from search index
3. **Keyword Match**: Fuzzy matching based on individual words with scoring
4. **Filtering**: Excludes generic categories ('Jucarii', 'Jocuri', 'Toate')

### Performance Optimizations

- Pre-built JSON index eliminates runtime processing of 2,575 categories
- O(1) lookups instead of O(n) linear searches
- Quick match cache for common categories
- Keyword scoring with confidence thresholds (30% minimum)

## File Structure Context

- `emag_mapping.json`: Never modify directly - this is the source of truth for eMAG categories
- `lib/categoryIndex.json`: Auto-generated - rebuild using the script when mapping changes
- `vercel.json`: Configured for 1024MB memory allocation due to large category database
- No build step required - pure Node.js serverless functions

## Key Dependencies

- `xml2js`: XML parsing and building
- Vercel serverless functions runtime
- Node.js 18+ required for fetch API support