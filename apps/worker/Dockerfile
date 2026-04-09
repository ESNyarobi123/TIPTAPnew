# docker build -f apps/worker/Dockerfile .
FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @tiptap/worker run build
WORKDIR /workspace/apps/worker
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
