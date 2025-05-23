FROM node:22-alpine AS builder

COPY . /code
WORKDIR /code

RUN \
  corepack enable && corepack prepare pnpm@latest --activate\
  && pnpm install \
  && pnpm package

FROM node:22-alpine

COPY --from=builder /code/dist /app
WORKDIR /app

CMD ["node", "index.js"]
