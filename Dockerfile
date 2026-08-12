# ==============================================================================
# TECHNIKA BACKEND MULTI-STAGE DOCKERFILE
# Optimized for free-tier hosting (Alpine Node 20 LTS, < 150MB image size)
# ==============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source files and Prisma schema
COPY prisma ./prisma
COPY src ./src
COPY apps ./apps
COPY shared ./shared

# Generate Prisma client and compile TypeScript
RUN npx prisma generate
RUN npm run build

# ==============================================================================
# PRODUCTION RUNNER STAGE
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled JavaScript output and Prisma client from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY sql ./sql

# Run as non-root user for security
USER node

EXPOSE 4000

CMD ["node", "dist/src/index.js"]
