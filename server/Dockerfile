# ── Build stage ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package manifests first for better layer caching.
COPY package*.json ./
COPY server/package*.json ./server/

# Install server dependencies (includes devDeps for prisma CLI + tsc).
RUN npm ci --prefix server

# Copy the server source + Prisma schema.
COPY server/ ./server/

# Generate the Prisma client and compile TypeScript to dist/.
RUN cd server && npx prisma generate && npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy the built output, node_modules (with generated Prisma client),
# the Prisma schema/migrations (for `migrate deploy`), and package.json.
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/prisma ./server/prisma
COPY --from=builder /app/server/package.json ./server/package.json

WORKDIR /app/server

# The app listens on PORT (default 4000).
EXPOSE 4000

# Apply pending migrations, then start the compiled server.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]