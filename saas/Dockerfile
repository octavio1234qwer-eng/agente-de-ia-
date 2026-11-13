# Imagen de producción. Requiere PostgreSQL (DATABASE_URL).
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY src ./src
COPY public ./public
COPY migrations ./migrations
COPY scripts ./scripts

# No ejecutar como root.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health" || exit 1
CMD ["node", "src/server.js"]
