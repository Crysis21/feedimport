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
- **Deployment**: Vercel serverless functions + Firebase Functions for long-running tasks
- **Scheduling**: Node-cron + Firebase Cloud Scheduler for background processing

### Core Components

**Legacy XML Transformation (`api/[uuid].js`)**
- Original Vercel serverless function for backward compatibility
- Fetches XML from `https://www.boribon.ro/feed/products/{uuid}`
- Transforms XML structure and adds eMAG-compatible fields

**Modern Platform Architecture**
- `pages/index.js`: Main dashboard with React components
- `lib/firebase.js`: Firebase client SDK configuration
- `lib/models.js`: Data models for feeds, products, and sync jobs
- `lib/batchFeedProcessor.js`: Resilient batch-based feed processing with resume capability
- `lib/categoryProcessor.js`: Independent AI-powered category processing system
- `lib/jobQueue.js`: Concurrent job queue manager with rate limiting
- `lib/scheduler.js`: Background job scheduler with decoupled processing
- `components/`: React components for dashboard UI (Dashboard, FeedsList, AddFeedForm, ActiveJobs)

**Category Matching Systems**
- `lib/fastCategoryMatcher.js`: Fast category matcher using pre-built indexes (legacy)
- `lib/geminiCategoryMatcher.js`: AI-powered category matching using Gemini API (Vercel fallback)
- `firebase/functions/index.js`: Firebase Functions for long-running Gemini processing (up to 60 minutes)
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

**Feed Processing Pipeline (Hybrid Architecture)**
1. User adds feed via dashboard → Firebase `feeds` collection
2. Scheduler discovers feeds due for sync every 5 minutes → adds to job queue
3. Job queue processes up to 5 concurrent sync jobs (one per feed max) on Vercel
4. BatchFeedProcessor processes feeds in 50-product batches with resume capability
5. **Firebase Functions handle long-running Gemini category processing (60 min timeout)**
6. Vercel triggers Firebase Functions for category processing every 2 minutes
7. Stalled job cleanup and resume system runs every 10 minutes
8. Webhooks triggered on sync completion

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

### Firebase Functions
```bash
cd firebase/functions
npm install           # Install Firebase Functions dependencies
firebase emulators:start --only functions  # Run Firebase Functions locally
firebase deploy --only functions           # Deploy Firebase Functions
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
vercel --prod         # Deploy Vercel app
firebase deploy --only functions  # Deploy Firebase Functions
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

# Firebase Functions URL (set after deploying functions)
FIREBASE_FUNCTIONS_URL=https://us-central1-your-project.cloudfunctions.net
```

**Firebase Functions Environment Variables:**
```bash
firebase functions:config:set gemini.api_key="your_gemini_api_key"
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

**Automated Jobs**

*Vercel Cron (Short Tasks):*
- `pages/api/cron/sync-feeds.js`: Discovers feeds due for sync and adds to queue (every 5 minutes)
- `pages/api/cron/process-queue.js`: Processes job queue with concurrent execution (every 2 minutes)
- `pages/api/cron/process-categories.js`: Triggers Firebase Functions for category processing (every 2 minutes)
- `pages/api/cron/resume-batches.js`: Cleanup and resume stalled jobs (every 10 minutes)

*Firebase Functions (Long-Running Tasks):*
- `processCategoriesWithAI`: AI category processing with 60-minute timeout (triggered by Vercel)
- `scheduledCategoryProcessing`: Scheduled category processing (every 5 minutes)
- `onSyncComplete`: Auto-trigger category processing when feed sync completes

**Hybrid Job Flow (Vercel + Firebase)**
1. Scheduler identifies feeds due for sync → creates job in `pending` status
2. JobQueue picks up pending jobs and starts up to 5 concurrent processors on Vercel
3. BatchFeedProcessor processes feeds in 50-product batches with progress tracking
4. Job progress stored in Firebase with resume capability for interruptions
5. **Firebase Functions handle Gemini category processing with 60-minute timeout**
6. Vercel triggers Firebase Functions for long-running AI categorization
7. Stalled jobs automatically detected and resumed or failed
8. Webhooks triggered on completion

## Security & Authentication

**Firebase Security Rules**
- Currently set to allow all access (development mode)
- Production deployment requires proper security rules implementation

**API Authentication**
- Dashboard uses Firebase ID tokens for user authentication
- External API access requires API keys generated per user
- API keys stored in user documents with expiration tracking

## Performance Considerations

**Scalability Improvements**
- Decoupled feed sync and category processing for independent scaling
- Concurrent job processing (max 10 sync jobs simultaneously)
- Batch-based processing (500 products per batch) with 15-minute Vercel timeouts
- Job queue system prevents feed conflicts while allowing parallel processing
- Resume capability for interrupted jobs eliminates wasted work

**Resource Optimization**
- Vercel functions: 1024MB memory, 30s timeout for regular APIs, 60s for cron/batch endpoints
- Firebase Functions: 2GB memory, 60-minute timeout for Gemini AI processing
- Firebase batch operations for efficient product updates
- Pre-built category indexes for O(1) lookups vs O(n) searches
- Gemini AI processing: 20 products per batch with 10s delays (Firebase Functions)
- Automatic cleanup of stalled jobs and temporary data

**Rate Limiting**
- Maximum 10 concurrent sync jobs across all feeds
- One active sync job per feed maximum
- 2-second delays between AI category processing batches
- Exponential backoff for failed operations

## API Endpoints

**Queue Management**
- `GET /api/queue/status`: Get current job queue status and statistics
- `POST /api/batch/continue`: Continue interrupted batch processing
- `POST /api/firebase/trigger-categories`: Manually trigger Firebase category processing

**Legacy Compatibility**

The original `/api/[uuid]` endpoint remains functional for existing integrations while new features use the modern API endpoints (`/api/feeds`, `/api/products`, etc.).

## Troubleshooting

**Common Issues**
- **Stalled Jobs**: Automatically detected and resumed/failed every 10 minutes
- **Large Feeds**: Processed in 50-product batches on Vercel (fast), category processing on Firebase (60min timeout)
- **Concurrent Syncs**: System prevents multiple syncs per feed while allowing up to 5 total
- **Category Processing**: Firebase Functions handle long Gemini requests with 60-minute timeout
- **Job Resume**: Interrupted jobs can resume from last completed batch
- **Timeout Issues**: Long-running Gemini requests moved to Firebase Functions (60min vs Vercel 15min max)