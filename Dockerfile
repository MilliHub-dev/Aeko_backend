# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS runtime

ENV PORT=4101

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# This repository does not currently commit a package-lock.json, so npm ci is
# not available. The existing postinstall patches @aeko-chain/web3.js and
# generates the Prisma client, therefore the full source is copied first.
COPY . .
RUN npm install --include=dev

ENV NODE_ENV=production

EXPOSE 4101/tcp

# Apply committed Prisma migrations before accepting traffic. A failed database
# connection keeps the container from serving a half-started application.
CMD ["sh", "-c", "npm run migrate:deploy && node server.js"]
