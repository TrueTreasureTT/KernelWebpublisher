FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY prisma prisma

RUN pnpm install

COPY apps/api apps/api

RUN pnpm prisma generate
RUN pnpm --filter @kernel-publisher/api build

EXPOSE 4000

CMD ["pnpm", "--filter", "@kernel-publisher/api", "start"]
