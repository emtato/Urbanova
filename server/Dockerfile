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
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv && rm -rf /var/lib/apt/lists/*
COPY backend/integration/requirements.txt /tmp/b11-requirements.txt
RUN python3 -m venv /opt/b11 && /opt/b11/bin/pip install --no-cache-dir -r /tmp/b11-requirements.txt
ENV PYTHON_EXECUTABLE=/opt/b11/bin/python
WORKDIR /app
COPY --from=build /app/server/package.json ./server/
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/node_modules ./server/node_modules
COPY server/db ./server/db
COPY data/contracts ./data/contracts
COPY data/fixtures ./data/fixtures
COPY data/reviewed ./data/reviewed
COPY backend/__init__.py backend/config.py ./backend/
COPY backend/simulation ./backend/simulation
COPY backend/schemas ./backend/schemas
COPY backend/integration ./backend/integration
COPY data/__init__.py data/simulation_input.py ./data/
COPY docs/lane-c.md ./docs/lane-c.md
USER node
CMD ["node","server/dist/server/src/index.js"]
