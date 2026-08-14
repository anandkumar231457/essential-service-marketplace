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
- [ ] **Step 2** — Database schema (Prisma + PostGIS + seed)
- [ ] **Step 3** — Auth (register/login, JWT, role middleware)
- [ ] **Step 4** — Core APIs (provider CRUD, nearby search, booking lifecycle, reviews)
- [ ] **Step 5** — Realtime layer (Socket.io + REST fallback)
- [ ] **Step 6** — Frontend (customer + provider flows)
- [ ] **Step 7** — Deployment readiness (rate limiting, CORS, health, logging, Docker)

## Deployment

Deployment steps will be documented here in **Step 7**. The app is structured so that environment variables are the only thing that changes between local and production.