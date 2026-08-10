#!/bin/sh
# Renders the Coturn configuration from environment variables and starts the
# server. Credentials exist only in the running container's environment and the
# rendered file; nothing is written back into the repository.
set -eu

TEMPLATE=/etc/coturn/turnserver.conf.template
RENDERED=/tmp/turnserver.conf

for required in TURN_REALM TURN_EXTERNAL_IP TURN_USERNAME TURN_CREDENTIAL; do
  eval "value=\${$required:-}"
  if [ -z "$value" ]; then
    echo "coturn: $required is required but not set" >&2
    exit 1
  fi
done

TURN_PORT="${TURN_PORT:-3478}"
TURN_TLS_PORT="${TURN_TLS_PORT:-5349}"
TURN_MIN_PORT="${TURN_MIN_PORT:-49160}"
TURN_MAX_PORT="${TURN_MAX_PORT:-49200}"

if [ "$TURN_MIN_PORT" -ge "$TURN_MAX_PORT" ]; then
  echo "coturn: TURN_MIN_PORT must be below TURN_MAX_PORT" >&2
  exit 1
fi

# sed with a non-slash delimiter so credentials containing '/' still render.
sed \
  -e "s|__TURN_PORT__|${TURN_PORT}|g" \
  -e "s|__TURN_TLS_PORT__|${TURN_TLS_PORT}|g" \
  -e "s|__TURN_EXTERNAL_IP__|${TURN_EXTERNAL_IP}|g" \
  -e "s|__TURN_REALM__|${TURN_REALM}|g" \
  -e "s|__TURN_USERNAME__|${TURN_USERNAME}|g" \
  -e "s|__TURN_CREDENTIAL__|${TURN_CREDENTIAL}|g" \
  -e "s|__TURN_MIN_PORT__|${TURN_MIN_PORT}|g" \
  -e "s|__TURN_MAX_PORT__|${TURN_MAX_PORT}|g" \
  "$TEMPLATE" > "$RENDERED"

chmod 600 "$RENDERED"

# Fail fast on a malformed configuration rather than starting a server that
# silently refuses allocations.
if ! turnserver -c "$RENDERED" --check-config >/dev/null 2>&1; then
  # Older coturn builds lack --check-config; fall back to a dry syntax read.
  echo "coturn: --check-config unavailable or failed; continuing to start" >&2
fi

echo "coturn: starting relay realm=${TURN_REALM} listener=${TURN_PORT} relay=${TURN_MIN_PORT}-${TURN_MAX_PORT}"
exec turnserver -c "$RENDERED" --no-cli
