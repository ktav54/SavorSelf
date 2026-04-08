# SavorSelf

SavorSelf is a mood-first food and wellness journal built with Expo, Supabase, Zustand, and OpenAI-backed coaching via Supabase Edge Functions.

## What is included

- Expo Router app scaffold for auth, onboarding, tabs, and settings
- Warm design system aligned to the provided brand palette
- Log, Food-Mood, Coach, Journal, and Settings MVP screen structure
- Zustand app store with demo data so the app can render before backend setup
- Supabase PostgreSQL schema with RLS policies
- Supabase Edge Function templates for AI coach and weekly insight generation
- Service wrappers for USDA FoodData Central and Open Food Facts
- Subscription architecture helpers with RevenueCat-ready gating seams

## Before running

1. Install Node.js and npm.
2. Install project dependencies with `npm install`.
3. Add Expo public env vars for Supabase and USDA.
4. Configure Supabase Edge Function secrets for `OPENAI_API_KEY`.
5. Run `npx expo start`.
