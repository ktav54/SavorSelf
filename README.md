# SavorSelf
### Food · Mood · You

SavorSelf discovers how your diet affects your mood — personally, not generically. Most apps track what you eat. SavorSelf connects what you eat to how you feel, surfacing your own gut-brain patterns over time through a personal gut-brain correlation engine.

## The Problem
Most people know food affects mood. Nobody knows how it affects THEIR mood. SavorSelf solves that by building a personal dataset from your daily logs and surfacing real patterns over time.

## What it does
- **AI Food Logging** — describe meals conversationally, GPT-4.1 Mini parses and logs them instantly
- **Mood Tracking** — daily check-ins with 5-point mood scale tied to food logs
- **Food-Mood Engine** — personal correlation insights that emerge from your own data over time
- **Barcode Scanner** — scan any packaged food via Open Food Facts
- **AI Coach** — gut-brain axis wellness coach powered by GPT-4.1 Mini
- **Streak & Pattern Tracking** — 28-day history with analytics and daily gut read

## Tech Stack
- React Native + Expo SDK 54
- Supabase (auth, PostgreSQL database, edge functions)
- GPT-4.1 Mini via OpenAI
- Open Food Facts + USDA FoodData Central
- Zustand for state management
- Built feature by feature with OpenAI Codex

## How it was built
Every feature was scoped and built using OpenAI Codex — from the auth flow and Supabase schema to the AI food parser, mood correlation engine, and Coach conversation system. 
## Live Preview
Web UI: https://savor-self.vercel.app
Note: The web version is a UI preview only. Full AI features including conversational food logging, Coach, and Food-Mood insights run on the native iOS build.
