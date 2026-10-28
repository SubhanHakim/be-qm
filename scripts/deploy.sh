#!/bin/bash
set -euo pipefail
IMAGE="$1"
REGISTRY="${IMAGE%%/*}"
ENV_FILE=/home/ubuntu/qm-backend.env

# simpan image yang sedang jalan, untuk rollback
PREV=$(docker inspect --format '{{.Config.Image}}' qm-backend 2>/dev/null || true)

/snap/bin/aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin "$REGISTRY"
docker pull "$IMAGE"

# migrasi dulu, kalau gagal deploy dibatalkan dan container lama tetap jalan
docker run --rm --network qm-net --env-file "$ENV_FILE" "$IMAGE" npx prisma migrate deploy

docker rm -f qm-backend || true
docker run -d --name qm-backend --network qm-net --restart unless-stopped -p 80:3000 --env-file "$ENV_FILE" "$IMAGE"

for i in $(seq 1 15); do
  if curl -fs http://localhost/api/health > /dev/null; then
    echo "Health check OK"
    docker image prune -a -f
    exit 0
  fi
  sleep 2
done

echo "Health check GAGAL, rollback ke: ${PREV:-tidak ada}"
docker logs --tail 30 qm-backend || true
docker rm -f qm-backend || true
if [ -n "$PREV" ]; then
  docker run -d --name qm-backend --network qm-net --restart unless-stopped -p 80:3000 --env-file "$ENV_FILE" "$PREV"
fi
exit 1