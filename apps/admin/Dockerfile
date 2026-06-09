FROM node:22-alpine AS builder

WORKDIR /app

# Build args pour injecter l'API URL au build
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ---- Runtime: nginx qui serve les fichiers statiques ----
FROM nginx:alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
# Garantit la présence des fichiers de deep linking à la racine (Vite peut
# ignorer les dossiers cachés selon la version) — copie explicite.
COPY --from=builder /app/public/.well-known /usr/share/nginx/html/.well-known
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
