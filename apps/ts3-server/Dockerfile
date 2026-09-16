# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

FROM base AS builder
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/ts3-server/package.json ./apps/ts3-server/
COPY packages/ui/package.json ./packages/ui/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/

RUN pnpm install --filter=ts3-server... --frozen-lockfile

COPY apps/ts3-server ./apps/ts3-server
COPY packages ./packages

WORKDIR /repo/apps/ts3-server
ENV NODE_ENV=production
RUN pnpm build

FROM base AS runner
WORKDIR /app

COPY --from=builder /repo/apps/ts3-server/build ./

RUN pnpm install --prod

EXPOSE 3333
ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=3333

CMD ["node", "bin/server.js"]
