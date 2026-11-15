FROM node:22.20.0-bookworm-slim AS web
WORKDIR /srv/softgraph
RUN npm install --global pnpm@10.32.1
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY app ./app
COPY components ./components
COPY data ./data
COPY hooks ./hooks
COPY lib ./lib
COPY public ./public
COPY services ./services
COPY next.config.ts tsconfig.json vite.config.ts ./
ARG RENDER_EXTERNAL_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SERVICE_MODE=api NEXT_PUBLIC_API_BASE_URL=/api/backend
RUN NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-${RENDER_EXTERNAL_URL:-http://localhost:3000}}" pnpm build

FROM python:3.12-slim-bookworm
COPY --from=web /usr/local/bin/node /usr/local/bin/node
RUN apt-get update && apt-get install -y --no-install-recommends gosu tini \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10001 --create-home softgraph

WORKDIR /srv/softgraph
COPY backend/requirements.lock ./backend/
RUN pip install --no-cache-dir -r backend/requirements.lock
COPY backend/app ./backend/app
COPY backend/evaluation/runs ./backend/evaluation/runs
COPY --from=web /srv/softgraph/node_modules ./node_modules
COPY --from=web /srv/softgraph/dist ./dist
COPY --from=web /srv/softgraph/public ./public
COPY package.json ./
COPY scripts/start-hosted.py scripts/hosted-entrypoint.sh ./scripts/

ENV NODE_ENV=production NEXT_PUBLIC_SERVICE_MODE=api NEXT_PUBLIC_API_BASE_URL=/api/backend \
    SOFTGRAPH_ENV=production SOFTGRAPH_INGESTION_DB=/var/data/softgraph/course.sqlite3 \
    PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=10000
EXPOSE 10000
ENTRYPOINT ["/usr/bin/tini", "--", "/bin/sh", "/srv/softgraph/scripts/hosted-entrypoint.sh"]
