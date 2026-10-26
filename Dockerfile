# emilIA — imagem de produção (API + frontend compilado servidos na mesma origem)
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev -w apps/api && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/web/dist apps/web/dist
# Banco SQLite, chave de desenvolvimento e uploads ficam em /data (monte um volume persistente)
ENV DATABASE_PATH=/data/emiliia.db
ENV PORT=3001
VOLUME ["/data"]
EXPOSE 3001
USER node
CMD ["node", "apps/api/dist/server.js"]
