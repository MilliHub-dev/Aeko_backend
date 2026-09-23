# Aeko backend — Express + Socket.IO + Prisma (Neon Postgres).
#
# One image for any Docker host (Scaleway Instance, Serverless Containers,
# Railway, Render). Build context is the repo root; see deploy/scaleway/.
#
# Debian rather than Alpine: Prisma's query engine, sharp and bcrypt ship
# glibc prebuilds, and fluent-ffmpeg needs a real ffmpeg on PATH.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
# postinstall runs `prisma generate` (prisma is a devDependency) and the
# @aeko-chain import patch, so dev dependencies are needed at install time.
COPY package.json package-lock.json* ./
COPY scripts/fix-aeko-chain.cjs scripts/
COPY prisma ./prisma
# A checkout without the lockfile still builds; with it, installs are reproducible.
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=9876
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Chat voice notes and the photo/video editors write here; mount a volume.
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
EXPOSE 9876
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||9876)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
