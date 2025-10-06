# Elysian Trading System - Backend Dockerfile
FROM node:18-alpine AS base

# Install dependencies
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production image
FROM node:18-alpine AS runner
WORKDIR /app

# Create app user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 elysian

# Copy built application
COPY --from=base --chown=elysian:nodejs /app/dist ./dist
COPY --from=base --chown=elysian:nodejs /app/node_modules ./node_modules
COPY --from=base --chown=elysian:nodejs /app/package.json ./package.json

# Create logs directory
RUN mkdir -p logs && chown elysian:nodejs logs
RUN mkdir -p reports && chown elysian:nodejs reports

USER elysian

EXPOSE 4000

ENV NODE_ENV=production
ENV PORT=4000

CMD ["node", "dist/server.js"]
