# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A comprehensive feed import management platform built on Next.js with Firebase backend. The system evolved from a simple XML transformation service into a full-featured product feed management platform with AI-powered category matching, automated synchronization, and a React-based dashboard.

## Architecture

### Application Stack
- **Frontend**: Next.js with React 19 and server-side rendering
- **Backend**: Firebase Firestore database with Admin SDK
- **Authentication**: Firebase Auth with Google OAuth integration
- **AI Integration**: Google Gemini API for intelligent category matching
- **Deployment**: Vercel serverless functions with 1024MB memory allocation
- **Scheduling**: Node-cron for background job processing

### Core Components

**Legacy XML Transformation (`api/[uuid].js`)**
- Original Vercel serverless function for backward compatibility
- Fetches XML from `https://www.boribon.ro/feed/products/{uuid}`
- Transforms XML structure and adds eMAG-compatible fields

**Modern Platform Architecture**
- `pages/index.js`: Main dashboard with React components
- `lib/firebase.js`: Firebase client SDK configuration
- `lib/models.js`: Data models for feeds, products, and sync jobs
- `lib/feedProcessor.js`: Core feed processing logic with Firebase integration
- `lib/scheduler.js`: Background job scheduler with cron-based processing
- `components/`: React components for dashboard UI (Dashboard, FeedsList, AddFeedForm, ActiveJobs)

**Category Matching Systems**
- `lib/fastCategoryMatcher.js`: Fast category matcher using pre-built indexes (legacy)
- `lib/geminiCategoryMatcher.js`: AI-powered category matching using Gemini API
- `lib/categoryIndex.json`: Pre-built search index for fast lookups
- `emag_mapping.json`: eMAG category database (2,575 categories)

**API Layer**
- `pages/api/feeds.js`: CRUD operations for feed management
- `pages/api/products.js`: Product data access with API key authentication
- `pages/api/sync.js`: Manual sync triggers and job management
- `pages/api/webhooks.js`: Webhook management for external integrations
- `pages/api/auth.js`: Authentication and API key management
- `pages/api/cron/`: Scheduled task endpoints for Vercel Cron

### Data Flow

**Feed Processing Pipeline**
1. User adds feed via dashboard → Firebase `feeds` collection
2. Scheduler checks every 5 minutes for feeds due for sync
3. FeedProcessor fetches data and creates/updates products in Firebase
4. Background job processes products without categories using Gemini AI
5. Webhooks triggered on sync completion

**Authentication Flow**
1. User signs in with Google → Firebase Auth
2. Frontend receives ID token → validates with Firebase
3. Server-side operations use Firebase Admin SDK
4. API access requires generated API keys stored in user documents

## Commands

### Development
```bash
npm run dev           # Start Next.js development server
npm run vercel-dev    # Start with Vercel dev (includes serverless functions)
npm run build         # Build production bundle
npm run start         # Start production server
```

### Category Index Management
```bash
node scripts/buildIndex.js    # Rebuild category search index after emag_mapping.json changes
```

### Scheduler (for local testing)
```bash
npm run scheduler     # Run background scheduler locally
```

### Deployment
```bash
vercel --prod         # Deploy to production
```

## Environment Configuration

Required environment variables in `.env.local`:

```bash
# Firebase Configuration
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=

# Gemini AI
GEMINI_API_KEY=
```

## Database Schema

### Firebase Collections
- `feeds`: User feed configurations with sync settings
- `products`: Processed product data with eMAG category mappings
- `sync_jobs`: Background job tracking and status
- `webhooks`: User-defined webhook configurations
- `users`: User profiles with API keys

### Key Data Models
- **FeedModel**: Manages feed CRUD operations and status updates
- **ProductModel**: Handles product data with batch operations
- **SyncJobModel**: Tracks processing jobs with progress monitoring

## Background Processing

**Automated Jobs (Vercel Cron)**
- `pages/api/cron/sync-feeds.js`: Processes scheduled feed synchronization (every 5 minutes)
- `pages/api/cron/process-categories.js`: AI category processing for unprocessed products (every 2 minutes)

**Job Flow**
1. Scheduler identifies feeds due for sync based on `syncInterval`
2. Creates sync job in `pending` status
3. FeedProcessor handles data fetching and product updates
4. Updates job status to `completed` or `failed`
5. Triggers registered webhooks with job results

## Security & Authentication

**Firebase Security Rules**
- Currently set to allow all access (development mode)
- Production deployment requires proper security rules implementation

**API Authentication**
- Dashboard uses Firebase ID tokens for user authentication
- External API access requires API keys generated per user
- API keys stored in user documents with expiration tracking

## Performance Considerations

- Vercel functions configured with 1024MB memory for large category processing
- Firebase batch operations for efficient product updates
- Pre-built category indexes for O(1) lookups vs O(n) searches
- Gemini AI processing limited to 100 products per batch to avoid rate limits

## Legacy Compatibility

The original `/api/[uuid]` endpoint remains functional for existing integrations while new features use the modern API endpoints (`/api/feeds`, `/api/products`, etc.)