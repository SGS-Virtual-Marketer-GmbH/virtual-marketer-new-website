#!/bin/sh
#
# Renders docker/nginx.conf.template and starts nginx.
#
# Two values differ between the supported deployments and nothing else does,
# so they are the only things substituted:
#
#   PORT          Cloud Run tells the ingress container which port to listen
#                 on via $PORT. It is 8080 today and the platform is entitled
#                 to change that, so honouring it is not optional.
#   API_UPSTREAM  Where the booking/contact API lives — 127.0.0.1:4000 when it
#                 runs as a Cloud Run sidecar in the same instance, api:4000
#                 when docker-compose runs it as a separate service.
#
# envsubst is given an explicit variable list. Without it, envsubst would
# happily replace every $name in the file, and an nginx config is full of
# them ($uri, $host, $vm_client_ip, ...) — the rendered config would be
# silently gutted. The explicit list makes that impossible.
#
# The output goes to /tmp rather than over /etc/nginx/nginx.conf because the
# container runs as a non-root user against a read-only root filesystem (see
# Dockerfile and docker-compose.yml); /tmp is the tmpfs it can actually write.
set -eu

: "${PORT:=8080}"
: "${API_UPSTREAM:=127.0.0.1:4000}"
export PORT API_UPSTREAM

envsubst '${PORT} ${API_UPSTREAM}' \
  < /etc/nginx/nginx.conf.template \
  > /tmp/nginx.conf

# Fail loudly at startup on a bad config rather than serving 500s later.
nginx -c /tmp/nginx.conf -t

exec nginx -c /tmp/nginx.conf -g 'daemon off;'
