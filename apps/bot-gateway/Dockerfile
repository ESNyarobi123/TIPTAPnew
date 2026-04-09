# docker build -f apps/bot-gateway/Dockerfile .
FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @tiptap/bot-gateway run build
WORKDIR /workspace/apps/bot-gateway
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/main.js"]
