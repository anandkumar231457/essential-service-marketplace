# Essential Service Marketplace

An Uber/Urban-Company-style platform connecting customers with essential service providers (electricians, plumbers, mechanics, cleaners, carpenters, AC technicians, appliance repair, maintenance workers). Customers can find an available nearby provider, book them, track them live, and pay — instead of relying on word-of-mouth or cold-calling.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React + Vite + TypeScript, Tailwind CSS, TanStack Query, Zustand, React Router |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL with PostGIS extension (Neon / Supabase) |
| Realtime | Socket.io (live provider location + booking status updates) |
| Auth | JWT (access + refresh tokens), bcrypt, role-based middleware |
| Validation | Zod (client + server) |
| Maps | Leaflet + OpenStreetMap (no paid API keys) |
| Testing | Jest (backend: booking state machine + geospatial queries) |
| Deployment | Backend: Render/Railway · Frontend: Vercel · DB: Neon |

## Monorepo Layout

```
/
├── client/   # React + Vite + TypeScript frontend
├── server/   # Node.js + Express + TypeScript backend
├── .github/workflows/ci.yml   # Lint + build on push
├── eslint.config.base.js      # Shared ESLint flat-config base
├── .prettierrc.json           # Shared Prettier config
└── README.md
```

## Prerequisites

- **Node.js 20 LTS** (or newer)
- **npm** (v9+)
- A **PostgreSQL** database with the **PostGIS** extension enabled (local, or Neon/Supabase for hosted)

## Getting Started

### 1. Install dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 2. Configure environment variables

Copy the example env files and fill in real values. **Never commit real secrets.**

```bash
# Backend
cd server
cp .env.example .env

# Frontend
cd ../client
cp .env.example .env
```

See `server/.env.example` and `client/.env.example` for the full list of required variables.

### 3. Run locally

```bash
# Backend (dev, hot reload) — http://localhost:4000
cd server
npm run dev

# Frontend (dev) — http://localhost:5173
cd client
npm run dev
```

### 4. Lint & build

```bash
# Backend
cd server
npm run lint
npm run build

# Frontend
cd client
npm run lint
npm run build
```

## Environment Variables

| File | Purpose |
| --- | --- |
| `server/.env.example` | DB URL, JWT secrets, port, CORS origin, etc. |
| `client/.env.example` | Vite API base URL, etc. |

## Roadmap

- [x] **Step 1** — Project scaffolding (monorepo, TS, ESLint/Prettier, CI)
- [x] **Step 2** — Database schema (Prisma + PostGIS + seed)
- [x] **Step 3** — Auth (register/login, JWT, role middleware)
- [x] **Step 4** — Core APIs (provider CRUD, nearby search, booking lifecycle, reviews)
- [x] **Step 5** — Realtime layer (Socket.io + REST fallback)
- [x] **Step 6** — Frontend (customer + provider flows)
- [x] **Step 7** — Deployment readiness (rate limiting, CORS, health, logging, Docker)

## Deployment

The app is structured so that environment variables are the only thing that changes between local and production. The backend is a Dockerized Express + Prisma service, the frontend is a static Vite build, and the database is PostgreSQL with PostGIS.

### Architecture

| Piece | Where it runs | Notes |
| --- | --- | --- |
| Backend API + Socket.io | Render or Railway (Docker) | `server/Dockerfile`, listens on `PORT` |
| Frontend (React + Vite) | Vercel | Static build from `client/` |
| Database (PostgreSQL + PostGIS) | Neon | Connection string via `DATABASE_URL` |

### 1. Database — Neon (PostgreSQL + PostGIS)

1. Create a free project at [neon.tech](https://neon.tech).
2. In the Neon console, open **SQL Editor** and enable PostGIS:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
3. Copy the **connection string** (the `pooled` one is fine for serverless/HTTP, the `direct` one is best for migrations). It looks like:
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
4. Keep this string — you'll paste it into the backend's `DATABASE_URL` on Render/Railway.

### 2. Backend — Render (Docker) or Railway

**Option A — Render**

1. Push the repo to GitHub.
2. In Render, create a **New Web Service** and connect the repo.
3. Set **Root Directory** to `server` (Render will find `Dockerfile` there).
4. Set **Runtime** to `Docker`.
5. Add the environment variables (see table below).
6. Deploy. Render builds the Docker image and runs `prisma migrate deploy && node dist/index.js` on start.

**Option B — Railway**

1. Push the repo to GitHub.
2. In Railway, create a new project → **Deploy from GitHub repo**.
3. Set the **Root Directory** to `server` (Railway uses the `Dockerfile` there).
4. Add the environment variables (see table below).
5. Deploy. Railway builds the Docker image and runs the same start command.

**Backend environment variables (set on Render/Railway):**

| Variable | Value |
| --- | --- |
| `PORT` | `4000` (Render/Railway may override with their own) |
| `DATABASE_URL` | Your Neon connection string |
| `JWT_ACCESS_SECRET` | Long random string (e.g. `openssl rand -base64 48`) |
| `JWT_REFRESH_SECRET` | A different long random string |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `CORS_ORIGIN` | Your Vercel frontend URL, e.g. `https://your-app.vercel.app` (comma-separate multiple origins if needed) |
| `NODE_ENV` | `production` |

> **Note:** The backend runs `prisma migrate deploy` on startup, so the Neon schema is created/updated automatically on first deploy.

### 3. Frontend — Vercel

1. Push the repo to GitHub.
2. In Vercel, **Add New Project** and import the repo.
3. Set **Root Directory** to `client`.
4. Set the **Build Command** to `npm run build` and the **Output Directory** to `dist` (Vercel detects Vite automatically).
5. Add the environment variables:

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | Your deployed backend URL + `/api`, e.g. `https://your-backend.onrender.com/api` |
| `VITE_SOCKET_URL` | Your deployed backend URL, e.g. `https://your-backend.onrender.com` |

6. Deploy. Vercel builds the static site and serves it.

### 4. Verify the deployment

- **Health check:** `curl https://your-backend.onrender.com/health` → `{"status":"ok",...}`
- **Categories:** `curl https://your-backend.onrender.com/api/categories` → list of service categories
- **Frontend:** open your Vercel URL, log in, and browse providers.

### 5. Local Docker (optional)

To run the backend locally in Docker:

```bash
cd server
docker build -t job-service-server .
docker run --rm -p 4000:4000 --env-file .env job-service-server
```

### Production checklist

- [ ] `CORS_ORIGIN` is set to the exact Vercel frontend origin (not `*`).
- [ ] `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` are long, unique, random strings.
- [ ] `NODE_ENV=production` (enables `info`-level pino logging).
- [ ] Rate limiting is active (100 req/15 min per IP on `/api`, 20 req/15 min on auth).
- [ ] `/health` returns `200` from the deployed backend.
