FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.34.9
WORKDIR /app
FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch --frozen-lockfile
COPY . .
RUN pnpm install --offline --frozen-lockfile && pnpm db:generate && pnpm exec turbo run build --filter=@billing/api... --filter=@billing/gateway...
FROM builder AS deps
RUN rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install --offline --prod --frozen-lockfile --filter=@billing/api... --filter=@billing/gateway... && rm -rf apps/web
RUN rm -rf dev_docs tests test-results .git .turbo
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps --chown=node:node /app /app
USER node
ENTRYPOINT ["sh", "scripts/entrypoint.sh"]
HEALTHCHECK CMD node -e "fetch('http://127.0.0.1:'+(process.env.GATEWAY_PORT && !process.env.API_PORT ? process.env.GATEWAY_PORT : process.env.API_PORT || 3001)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]
