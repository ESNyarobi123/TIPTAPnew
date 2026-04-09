# docker build -f apps/api/Dockerfile .
FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @tiptap/api exec prisma generate
RUN pnpm --filter @tiptap/api run build
COPY apps/api/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
WORKDIR /workspace/apps/api
ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
