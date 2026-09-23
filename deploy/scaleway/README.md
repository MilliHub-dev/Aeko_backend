# Deploying the Aeko backend on Scaleway

The API is one Node process: Express + Socket.IO (rooms held in memory), in-process cron jobs (`jobs/`), Prisma against Neon Postgres, media on Cloudinary, and a few things written to local disk (chat voice notes, photo/video edits under `uploads/`). That shape wants **one always-on container with a persistent disk**, so the recommended target is a single Scaleway Instance running Docker Compose behind Caddy. Serverless Containers are covered at the end for when the disk writes have been moved to Cloudinary.

Cost: a `PLAY2-NANO` (2 vCPU / 4 GB) or `DEV1-S` is enough for the current traffic; add a 20 GB block volume only if voice notes grow.

## 1. Pick the hostname

`api.aeko.online` is already the chain explorer. Use something else for the app API, e.g. `backend.aeko.online`, and point an `A` record at the Instance's public IP before starting Caddy (it needs DNS to issue the certificate).

## 2. Create the Instance

Console → Compute → Instances → Create: Ubuntu 24.04, `PLAY2-NANO`, Paris or Amsterdam, attach your SSH key, enable IPv4. Security group: allow inbound TCP 22, 80, 443 (and UDP 443 for HTTP/3 if you like).

Or with the CLI:

```bash
scw instance server create type=PLAY2-NANO image=ubuntu_noble name=aeko-backend ip=new zone=fr-par-2
```

## 3. Install Docker and get the code

```bash
ssh root@<instance-ip>
curl -fsSL https://get.docker.com | sh
git clone https://github.com/MilliHub-dev/Aeko_backend.git /opt/aeko-backend
cd /opt/aeko-backend/deploy/scaleway
cp ../../.env.example .env
nano .env        # fill every value the Render service has, plus:
                 #   DATABASE_URL=postgres://...neon...
                 #   NODE_ENV=production
                 #   BACKEND_DOMAIN=backend.aeko.online
                 #   FRONTEND_URL=https://aeko.online
                 #   TWO_FACTOR_SECRET_KEY, AEKO_CUSTODY_MASTER_SEED, AEKO_SERVICE_KEYPAIR ...
chmod 600 .env
```

`.env` is read by Compose for `BACKEND_DOMAIN` and passed whole to the container, so one file holds everything. Copy the values from Render → Environment; never commit it.

## 4. First start (with migrations)

```bash
RUN_MIGRATIONS=1 docker compose up -d --build
docker compose logs -f backend     # wait for "Local: http://localhost:9876"
curl -s https://backend.aeko.online/health
```

`RUN_MIGRATIONS=1` makes the container run `prisma migrate deploy` before starting. Leave it unset for normal restarts.

## 5. Updating

```bash
cd /opt/aeko-backend && git pull
cd deploy/scaleway
docker compose up -d --build               # add RUN_MIGRATIONS=1 when the pull brought migrations
docker image prune -f
```

Downtime is the container restart (a few seconds). Socket.IO clients reconnect on their own.

## 6. Point the clients at it

| Where | Change |
| --- | --- |
| `aeko-mobile/eas.json` | `EXPO_PUBLIC_API_BASE_URL` in every build profile |
| `aeko-mobile/lib/http.ts`, `lib/upload.ts` | the hard-coded fallback URL |
| `aeko_web` (Vercel env) | the API base URL |
| Google Cloud OAuth client | authorized redirect `https://backend.aeko.online/api/auth/google/callback` (whatever `GOOGLE_CALLBACK_URL` is) |
| Whop / Stripe / Paystack dashboards | webhook URLs → the new host |
| Apple Sign in | nothing (the backend verifies the identity token, no callback) |

Mobile clients ship the URL at build time; publish an EAS Update (`npm run update:production`) or a new build after changing it. Keep the Render service alive until that update has reached users, then delete it.

## 7. Operating

```bash
docker compose ps                      # health column comes from the image HEALTHCHECK
docker compose logs --tail 200 backend
docker compose exec backend npx prisma migrate status
docker compose run --rm backend npx prisma migrate deploy    # migrations by hand
```

Back up `/var/lib/docker/volumes/scaleway_uploads` if voice notes matter; the database lives on Neon and is not on this box.

Set a Scaleway alert on the Instance (CPU/RAM) and an external uptime check on `https://backend.aeko.online/health` — the container restarts itself on failure, but nothing tells you unless you ask.

## Alternative: Serverless Containers

Works once nothing is written to local disk (move `uploads/voice` and the edit outputs to Cloudinary first; the filesystem there is ephemeral and reset on every deploy). Then:

```bash
# build & push
scw registry namespace create name=aeko region=fr-par
docker build -t rg.fr-par.scw.cloud/aeko/aeko-backend:$(git rev-parse --short HEAD) .
docker login rg.fr-par.scw.cloud -u nologin --password-stdin <<< "$SCW_SECRET_KEY"
docker push rg.fr-par.scw.cloud/aeko/aeko-backend:$(git rev-parse --short HEAD)

# container: one replica, always on, websockets need no extra config
scw container namespace create name=aeko region=fr-par
scw container container create namespace-id=<ns-id> name=aeko-backend \
  registry-image=rg.fr-par.scw.cloud/aeko/aeko-backend:<tag> port=9876 \
  min-scale=1 max-scale=1 memory-limit=2048 cpu-limit=1000 timeout=900s \
  protocol=http1 privacy=public \
  environment-variables.NODE_ENV=production \
  secret-environment-variables.0.key=DATABASE_URL secret-environment-variables.0.value='postgres://...'
scw container container deploy container-id=<id>
scw container domain create container-id=<id> hostname=backend.aeko.online   # then CNAME to the container endpoint
```

Keep `min-scale=max-scale=1`: with more replicas Socket.IO rooms and the cron jobs split across instances (fixing that needs the Socket.IO Redis adapter and a job leader lock — not done). WebSocket connections are capped at the container `timeout`; clients reconnect.
