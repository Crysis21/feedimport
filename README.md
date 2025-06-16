# Feed Import Management Platform

A comprehensive product import management platform built on top of the XML feed transformation service. Features Firebase database storage, Google authentication, AI-powered category matching, and automated stock synchronization.

## Features

### Core Functionality
- **Multi-Feed Support**: Add and manage multiple product feeds (Boribon, custom XML)
- **Firebase Integration**: Secure data storage and real-time sync capabilities  
- **Google Authentication**: User management with Google OAuth
- **AI Category Matching**: Intelligent eMAG category assignment using Gemini AI
- **Scheduled Synchronization**: Automated feed processing with configurable intervals
- **Stock Management**: Real-time inventory tracking and updates
- **Webhook Support**: API callbacks for external system integration

### Dashboard Features
- **Web Interface**: React-based management dashboard
- **Feed Management**: Add, edit, pause/resume, and delete feeds
- **Job Monitoring**: Real-time sync job status and progress tracking
- **API Access**: RESTful APIs with authentication for external integration

## Setup Instructions

### 1. Firebase Configuration

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable Authentication with Google provider
3. Create a Firestore database
4. Deploy the security rules: `firebase deploy --only firestore:rules`
5. Copy `.env.example` to `.env.local` and fill in your Firebase credentials:

```bash
cp .env.example .env.local
```

### 2. Gemini AI Setup

1. Get a Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add the API key to your `.env.local` file

### 3. Install Dependencies

```bash
npm install
```

### 4. Development

```bash
# Start the development server
npm run dev

# Start with Vercel dev (includes serverless functions)
npm run vercel-dev
```

### 5. Production Deployment

```bash
# Deploy to Vercel
vercel --prod
```

## API Endpoints

### Authentication
- `POST /api/auth/verify` - Verify Firebase ID token
- `POST /api/auth/api-key` - Generate API key for external access

### Feed Management
- `GET /api/feeds` - List user feeds
- `POST /api/feeds` - Create new feed
- `PUT /api/feeds?feedId=<id>` - Update feed
- `DELETE /api/feeds?feedId=<id>` - Delete feed

### Synchronization
- `POST /api/sync` - Trigger manual sync
- `PUT /api/sync` - Pause/resume feed
- `GET /api/sync` - Get active sync jobs

### Products API
- `GET /api/products` - Get synchronized products with filtering
  - Query params: `feedId`, `brand`, `format` (json/xml), `limit`, `offset`
  - Requires API key: `x-api-key` header or `apiKey` query param

### Webhooks
- `GET /api/webhooks` - List user webhooks
- `POST /api/webhooks` - Create webhook
- `PUT /api/webhooks?webhookId=<id>` - Update webhook
- `DELETE /api/webhooks?webhookId=<id>` - Delete webhook

## Database Schema

### Collections

**feeds**
```javascript
{
  id: string,
  userId: string,
  name: string,
  type: 'boribon' | 'custom',
  uuid?: string, // for boribon feeds
  url?: string,  // for custom feeds
  syncInterval: number, // milliseconds
  status: 'active' | 'inactive',
  isPaused: boolean,
  lastSyncAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**products**
```javascript
{
  id: string, // feedId_sku
  feedId: string,
  title: string,
  description: string,
  sku: string,
  price: string,
  brand: string,
  stockQuantity: number,
  originalCategories: string[],
  emagCategory?: string,
  emagCategoryId?: number,
  emagCategoryPath?: string,
  categoryProcessed: boolean,
  createdAt: timestamp,
  lastUpdated: timestamp
}
```

**sync_jobs**
```javascript
{
  id: string,
  feedId: string,
  type: 'scheduled' | 'manual',
  status: 'pending' | 'running' | 'completed' | 'failed',
  itemsProcessed: number,
  itemsTotal: number,
  error?: string,
  createdAt: timestamp,
  startedAt?: timestamp,
  completedAt?: timestamp
}
```

**webhooks**
```javascript
{
  id: string,
  userId: string,
  name: string,
  url: string,
  headers?: object,
  events: string[],
  isActive: boolean,
  lastTriggered?: timestamp,
  createdAt: timestamp
}
```

## Environment Variables

```env
# Firebase Configuration (required)
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id

# Gemini AI Configuration (required)
GEMINI_API_KEY=your_gemini_api_key_here
```

**That's it!** Only 8 environment variables needed.

## Usage Examples

### Adding a Feed
```javascript
const response = await fetch('/api/feeds', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`
  },
  body: JSON.stringify({
    name: 'My Boribon Feed',
    type: 'boribon',
    uuid: 'your-uuid-here',
    syncInterval: 3600000 // 1 hour
  })
});
```

### Getting Products via API
```bash
curl -H "x-api-key: your-api-key" \
  "https://your-domain.vercel.app/api/products?brand=Nike&format=xml"
```

### Setting up Webhooks
```javascript
await fetch('/api/webhooks', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`
  },
  body: JSON.stringify({
    name: 'Stock Update Webhook',
    url: 'https://your-system.com/webhook/stock-update',
    events: ['sync_completed']
  })
});
```

## Background Processing

The platform runs automated background jobs:

1. **Feed Synchronization**: Every 5 minutes, checks for feeds due for sync
2. **Category Processing**: Every 2 minutes, processes products without eMAG categories using Gemini AI
3. **Webhook Triggers**: Automatically calls registered webhooks when sync jobs complete

## Migration from Original Service

The original `/api/[uuid]` endpoint remains functional for backward compatibility. New installs should use the full platform features through the dashboard and new API endpoints.

## Development Notes

- Uses Next.js for the web interface
- Firebase Admin SDK for server-side operations
- Firebase Client SDK for frontend authentication
- Vercel serverless functions for API endpoints
- Vercel Cron for scheduled tasks