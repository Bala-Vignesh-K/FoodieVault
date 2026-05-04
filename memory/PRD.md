# FoodieVault - Product Requirements Document

## Overview
FoodieVault is a React Native Expo mobile app (iOS + Android) that lets users save places, recipes, and food items from social media shares (Instagram, YouTube, TikTok). Users can then navigate to places via Google Maps or order food/ingredients via Swiggy (mocked for MVP).

## Problem
Users often watch food/cooking content on social media and want to try those places or recipes later — but lose track of the content. FoodieVault solves this by being a single vault for all food-related saves.

## Core Features (MVP shipped)

### 1. Authentication
- Email + 6-digit OTP flow (custom backend)
- JWT session (30 day expiry) stored in AsyncStorage
- First-time onboarding: collect user name
- **MVP mode**: OTP returned in API response as `dev_otp` for testing (email delivery not wired)
- Firebase credentials stored in `.env` for future push notifications / real email OTP

### 2. Share Intent / URL Extraction
- Native share extension configured via `expo-share-intent` plugin (works in production builds)
- Fallback: "Paste URL" flow accessible via floating + button and home hero CTA (works in Expo Go)
- AI extraction via Emergent LLM Key → Gemini 2.5 Pro
  - Fetches page OG metadata (title, description, thumbnail)
  - Extracts: content type (place/recipe/item), name, description, location, cuisine, dishes, ingredients, tags

### 3. Save & Organize
- 3 content types: Place, Recipe, Item (to order)
- Each save has: name, description, location, cuisine, ingredients, dishes, tags, source platform, source URL, thumbnail, notes, favorite flag
- Tabs: Home, Places, Recipes, Order (items), Profile
- Search within each list
- Confirm screen: user can edit AI-extracted data before saving

### 4. Detail View
- Parallax hero image with platform badge
- Full details: description, dishes/ingredients, tags, notes
- Favorite toggle, delete, open original post
- Floating action bar:
  - Navigate (Google Maps deep link, if location exists)
  - Order on Swiggy (MOCKED — realistic order flow with ETA, amount, order ID)
  - For recipes: "Order Ingredients" routes to Instamart flow

### 5. Home Dashboard
- Personal greeting with first name
- Hero CTA: "Paste a link to save"
- Bento grid stats: Places, Recipes, To Order, Favorites
- Recently Added horizontal scroll
- Pull-to-refresh

### 6. Profile
- Name, email, avatar (initial)
- Stats card (totals by type + favorites)
- Settings: How to share guide, Support, About
- Sign out

## Technical Stack
- **Frontend:** React Native Expo SDK 54, expo-router (file-based routing), TypeScript
- **Backend:** FastAPI, MongoDB (motor), JWT auth
- **AI:** Emergent LLM Key → Gemini 2.5 Pro via `emergentintegrations`
- **HTTP:** axios, BeautifulSoup for metadata scraping
- **Share:** `expo-share-intent` (production builds only)

## API Endpoints
- `POST /api/auth/request-otp` - email → returns dev_otp
- `POST /api/auth/verify-otp` - email + otp → returns JWT + user
- `GET /api/auth/me` - current user
- `POST /api/auth/update-profile` - set name
- `POST /api/extract` - URL → AI-extracted structured data
- `GET /api/items?type=place|recipe|item&favorite=true` - list
- `GET /api/items/stats` - aggregate counts
- `GET/POST/PATCH/DELETE /api/items[/:id]` - CRUD
- `POST /api/swiggy/order` - MOCKED order

## Design System
Warm terracotta aesthetic (Organic & Earthy archetype from design_guidelines.json):
- Primary: #E05D3A (terracotta)
- Secondary: #7A8B76 (sage)
- BG: #FDFBF7 (warm off-white)
- Cards: white with soft shadows, rounded-3xl

## Future (Not in MVP)
- Real Swiggy MCP integration (after user gets approval at mcp.swiggy.com/builders)
- Native Google Maps MapView (requires user's API key)
- Email-based OTP delivery (SendGrid or Firebase Cloud Function)
- Firebase Cloud Messaging push notifications
- Video transcription for deeper extraction (Whisper + Gemini multimodal)
- Share extension tested in production build (works out-of-box via app.json plugin config)
