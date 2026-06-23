FROM node:22-slim AS builder

# OpenSSL requis par Prisma
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# ---- Runtime ----
FROM node:22-slim AS runtime

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 3000

# db push SANS --accept-data-loss : applique les changements additifs, mais
# REFUSE (échoue au boot) tout changement destructif (DROP colonne/table) au
# lieu de détruire des données en silence. Un changement destructif légitime se
# fait alors manuellement, après backup.
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
