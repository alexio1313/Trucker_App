FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat curl

FROM base AS deps
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY services/social-publishing/package*.json ./services/social-publishing/
RUN npm install --legacy-peer-deps --workspace=@truck-platform/shared --workspace=@truck-platform/social-publishing

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared ./packages/shared
COPY services/social-publishing ./services/social-publishing
COPY tsconfig.base.json ./
RUN cd packages/shared && npx tsc
RUN cd services/social-publishing && npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodeapp
WORKDIR /app
COPY --from=build --chown=nodeapp:nodejs /app/services/social-publishing/dist ./dist
COPY --from=build --chown=nodeapp:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodeapp:nodejs /app/packages/shared ./packages/shared
USER nodeapp
EXPOSE 3005
HEALTHCHECK --interval=10s --timeout=5s --retries=5 CMD curl -f http://localhost:3005/health || exit 1
CMD ["node", "dist/app.js"]
