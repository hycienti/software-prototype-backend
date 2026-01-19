FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3333
CMD ["pnpm", "dev"]

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS dev
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
EXPOSE 3333
CMD ["pnpm", "dev"]

FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/build ./
COPY --from=build /app/docs ./docs
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3333
CMD ["node", "bin/server.js"]
