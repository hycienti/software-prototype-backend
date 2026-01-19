FROM node:22.12.0-alpine@sha256:51eff88af6dff26f59316b6e356188ffa2c422bd3c3b76f2556a2e7e89d080bd AS base
RUN npm i -g pnpm@9.15.5

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

FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/build ./
COPY --from=build /app/build/config ./config
COPY --from=build /app/docs ./docs
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3333
CMD ["node", "bin/server.js"]
