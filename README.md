# Aegis Risk - AI-Powered Loan Default Prediction System

## Overview
Aegis Risk is a system that predicts loan defaults using a trained XGBoost ML model. The application features a Next.js dashboard, Supabase backend, and robust analytics.

## Local Setup

### 1. Prerequisites
- Node.js 18+
- pnpm
- Supabase CLI (`npm i -g supabase`)

### 2. Environment Setup
Copy the `.env.example` file to `.env.local`:
```bash
cp .env.example .env.local
```

### 3. Supabase Setup
Initialize and start the local Supabase instance:
```bash
npx supabase start
```
This will apply all database migrations located in `supabase/migrations`.

### 4. Seed Data
To populate the database with mock or generated data:
```bash
npm run seed
```
(Assumes a seed script is configured)

### 5. Start Development Server
```bash
pnpm install
pnpm run dev
```

## Branch Conventions
- `feature/ml-*` - Machine Learning tasks
- `feature/backend-*` - Backend & Infrastructure tasks
- `feature/frontend-*` - Frontend tasks

## Vercel Deployment
1. Import the project into Vercel.
2. Ensure you have a cloud Supabase project provisioned.
3. Add the `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` variables to the Vercel project settings.
4. Deploy the main branch.
