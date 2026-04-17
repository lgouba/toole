FROM node:22-alpine AS builder

WORKDIR /app

# Install deps (cache layer)
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# ---- Runtime image ----
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Copy only production deps
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate

# Copy built JS
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Run migrations then start
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/index.js"]
