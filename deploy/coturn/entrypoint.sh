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
TURN_TLS_CERT="${TURN_TLS_CERT:-}"
TURN_TLS_KEY="${TURN_TLS_KEY:-}"

if [ "$TURN_MIN_PORT" -ge "$TURN_MAX_PORT" ]; then
  echo "coturn: TURN_MIN_PORT must be below TURN_MAX_PORT" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# TLS policy.
#
# Explicit, and it fails closed. TURN-over-TLS is opt-in: it is enabled only
# when a real certificate and key are both provided and readable. Otherwise the
# TLS and DTLS listeners are switched off outright.
#
# Declaring tls-listening-port without a certificate is strictly worse than no
# TLS at all: coturn would advertise a TLS endpoint that cannot complete a
# handshake, so clients configured with a turns: URI would fail to connect while
# appearing to be correctly configured.
#
# Turning TLS off does not weaken call confidentiality. WebRTC media is already
# end-to-end encrypted with DTLS-SRTP regardless of how it is relayed. TURN-over-
# TLS buys traversal of firewalls that only permit 443, plus concealment that
# the traffic is TURN at all — useful, but not a media-secrecy control.
# ---------------------------------------------------------------------------
if [ -n "$TURN_TLS_CERT" ] || [ -n "$TURN_TLS_KEY" ]; then
  if [ -z "$TURN_TLS_CERT" ] || [ -z "$TURN_TLS_KEY" ]; then
    echo "coturn: TURN_TLS_CERT and TURN_TLS_KEY must be set together" >&2
    exit 1
  fi
  if [ ! -r "$TURN_TLS_CERT" ] || [ ! -r "$TURN_TLS_KEY" ]; then
    echo "coturn: TLS certificate or key is not readable; refusing to start with a broken TLS listener" >&2
    exit 1
  fi
  TLS_SECTION="tls-listening-port=${TURN_TLS_PORT}
cert=${TURN_TLS_CERT}
pkey=${TURN_TLS_KEY}
# Modern ciphers only; legacy suites are refused.
cipher-list=\"ECDHE+AESGCM:ECDHE+CHACHA20:!aNULL:!MD5:!DSS\"
no-tlsv1
no-tlsv1_1"
  TLS_MODE="enabled on ${TURN_TLS_PORT}"
else
  TLS_SECTION="# No certificate supplied: TLS and DTLS listeners are explicitly disabled
# rather than advertised without a usable certificate.
no-tls
no-dtls"
  TLS_MODE="disabled (no certificate supplied)"
fi

# awk rather than sed for the multi-line TLS block, and a non-slash delimiter on
# the scalar substitutions so credentials containing '/' still render.
awk -v tls="$TLS_SECTION" '{ if ($0 == "__TLS_SECTION__") print tls; else print }' "$TEMPLATE" \
  | sed \
    -e "s|__TURN_PORT__|${TURN_PORT}|g" \
    -e "s|__TURN_EXTERNAL_IP__|${TURN_EXTERNAL_IP}|g" \
    -e "s|__TURN_REALM__|${TURN_REALM}|g" \
    -e "s|__TURN_USERNAME__|${TURN_USERNAME}|g" \
    -e "s|__TURN_CREDENTIAL__|${TURN_CREDENTIAL}|g" \
    -e "s|__TURN_MIN_PORT__|${TURN_MIN_PORT}|g" \
    -e "s|__TURN_MAX_PORT__|${TURN_MAX_PORT}|g" \
    > "$RENDERED"

chmod 600 "$RENDERED"

# Nothing may be left unsubstituted: an unrendered placeholder would silently
# become an invalid directive or, worse, a literal value.
if grep -q "__[A-Z_]*__" "$RENDERED"; then
  echo "coturn: unsubstituted placeholder remains in rendered configuration" >&2
  grep -n "__[A-Z_]*__" "$RENDERED" >&2
  exit 1
fi

echo "coturn: starting relay realm=${TURN_REALM} listener=${TURN_PORT} relay=${TURN_MIN_PORT}-${TURN_MAX_PORT} tls=${TLS_MODE}"
exec turnserver -c "$RENDERED" --no-cli
