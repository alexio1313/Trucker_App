FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/api-client/package*.json ./packages/api-client/
COPY packages/state/package*.json ./packages/state/
COPY packages/ui-kit/package*.json ./packages/ui-kit/
COPY apps/admin/package*.json ./apps/admin/
RUN npm install --legacy-peer-deps
# npm workspaces installs react in apps/admin/node_modules (workspace-local), not root.
# Next.js needs react at /app/node_modules/react (resolves from /app/node_modules/next/...).
# Move react to root and remove workspace-local copy to ensure a single React instance.
RUN cp -r /app/apps/admin/node_modules/react /app/node_modules/react && \
    rm -rf /app/apps/admin/node_modules/react && \
    cp -r /app/apps/admin/node_modules/react-dom /app/node_modules/react-dom 2>/dev/null || true && \
    rm -rf /app/apps/admin/node_modules/react-dom 2>/dev/null || true

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/api-client ./packages/api-client
COPY packages/state ./packages/state
COPY packages/ui-kit ./packages/ui-kit
COPY apps/admin ./apps/admin
ARG NEXT_PUBLIC_API_URL=http://192.168.8.101:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd packages/shared && npx tsc
RUN cd packages/api-client && npx tsc
RUN cd packages/state && npx tsc
RUN cd packages/ui-kit && npx tsc || true
RUN cd apps/admin && npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache curl
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

WORKDIR /app
COPY --from=build --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static

USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
WORKDIR /app/apps/admin
CMD ["node", "server.js"]
