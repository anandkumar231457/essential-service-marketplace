# ── Build stage ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package manifests first for better layer caching.
COPY package*.json ./

# Install server dependencies (includes devDeps for prisma CLI + tsc).
RUN npm install

# Copy the server source + Prisma schema.
COPY . ./

# Generate the Prisma client and compile TypeScript to dist/.
RUN npx prisma generate && npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy the built output, node_modules (with generated Prisma client),
# the Prisma schema/migrations (for `migrate deploy`), and package.json.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# The app listens on PORT (default 4000).
EXPOSE 4000

# Apply pending schema changes, then start the compiled server.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]