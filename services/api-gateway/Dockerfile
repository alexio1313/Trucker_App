FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat curl

FROM base AS deps
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY services/api-gateway/package*.json ./services/api-gateway/
RUN npm install --legacy-peer-deps --workspace=@truck-platform/shared --workspace=@truck-platform/api-gateway

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared ./packages/shared
COPY services/api-gateway ./services/api-gateway
COPY tsconfig.base.json ./
RUN cd packages/shared && npx tsc
RUN cd services/api-gateway && npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodeapp
WORKDIR /app
COPY --from=build --chown=nodeapp:nodejs /app/services/api-gateway/dist ./dist
COPY --from=build --chown=nodeapp:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodeapp:nodejs /app/packages/shared ./packages/shared
USER nodeapp
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=5 CMD curl -f http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
