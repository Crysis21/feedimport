#!/bin/bash

echo "🔥 Setting up Firebase Functions for feedimport"

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Login to Firebase (if not already logged in)
echo "🔐 Checking Firebase authentication..."
firebase login --no-localhost

# Initialize Firebase project (if not already initialized)
if [ ! -f "firebase.json" ]; then
    echo "📝 Initializing Firebase project..."
    firebase init firestore functions
fi

# Set up Functions dependencies
echo "📦 Installing Firebase Functions dependencies..."
cd firebase/functions
npm install

# Set Gemini API key
echo "🔑 Setting up Gemini API key for Firebase Functions..."
echo "Please enter your Gemini API key:"
read -s GEMINI_API_KEY
firebase functions:config:set gemini.api_key="$GEMINI_API_KEY"

# Deploy Firestore indexes
echo "📄 Deploying Firestore indexes..."
cd ../..
firebase deploy --only firestore:indexes

# Deploy Functions
echo "🚀 Deploying Firebase Functions..."
firebase deploy --only functions

# Get Functions URL
PROJECT_ID=$(firebase projects:list --json | jq -r '.[0].projectId')
FUNCTIONS_URL="https://us-central1-${PROJECT_ID}.cloudfunctions.net"

echo ""
echo "✅ Firebase Functions deployed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Add this to your Vercel environment variables:"
echo "   FIREBASE_FUNCTIONS_URL=${FUNCTIONS_URL}"
echo ""
echo "2. Redeploy your Vercel app:"
echo "   vercel --prod"
echo ""
echo "3. Test the setup:"
echo "   curl -X POST ${FUNCTIONS_URL}/processCategoriesWithAI -H 'Content-Type: application/json' -d '{\"limit\": 10}'"
echo ""
echo "🎉 Setup complete!"