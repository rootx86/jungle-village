# Backend API: build context is the repository root.
FROM node:22-alpine AS build
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/dist dist
COPY --from=build /app/migrations migrations
COPY --from=build /app/package.json package.json
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=4s --start-period=20s --retries=5 CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
CMD ["node", "dist/index.js"]
