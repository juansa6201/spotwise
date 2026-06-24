# Frontend (Vite dev server) para docker compose en desarrollo.
FROM node:20-alpine

WORKDIR /app

# Instala dependencias primero para aprovechar la caché de capas.
COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# server.host=true en vite.config.js hace que escuche en 0.0.0.0.
CMD ["npm", "run", "dev"]
