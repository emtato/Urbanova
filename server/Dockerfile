FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server
COPY server/tsconfig.json ./server/
COPY server/src ./server/src
COPY frontend/src/lib/types.ts ./frontend/src/lib/types.ts
RUN npm run build --prefix server && npm prune --prefix server --omit=dev

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/server/package.json ./server/
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/node_modules ./server/node_modules
COPY server/db ./server/db
COPY data/contracts ./data/contracts
COPY data/fixtures ./data/fixtures
COPY data/reviewed ./data/reviewed
USER node
CMD ["node","server/dist/server/src/index.js"]
