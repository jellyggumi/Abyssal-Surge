#!/bin/sh
set -eu

usage() {
  cat <<'EOF'
Usage: ./dev.sh [--port NUMBER] [--verify] [--help]

Serve Abyssal Surge on 127.0.0.1:8000 by default.
  --port NUMBER  Serve on a loopback port from 1 through 65535.
  --verify       Execute the focused browser playtest without starting a server.
  --help         Show this help.
EOF
}

fail_usage() {
  printf '%s\n' "$1" >&2
  usage >&2
  exit 64
}

port=8000
verify=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --help)
      usage
      exit 0
      ;;
    --verify)
      [ "$verify" = false ] || fail_usage "--verify may only be given once"
      verify=true
      shift
      ;;
    --port)
      [ "$#" -ge 2 ] || fail_usage "--port requires NUMBER"
      case "$2" in
        ''|*[!0-9]*) fail_usage "--port requires a numeric NUMBER" ;;
      esac
      [ "$2" -ge 1 ] 2>/dev/null && [ "$2" -le 65535 ] 2>/dev/null || fail_usage "--port must be from 1 through 65535"
      port=$2
      shift 2
      ;;
    *)
      fail_usage "Unknown argument: $1"
      ;;
  esac
done

if [ "$verify" = true ]; then
  command -v node >/dev/null 2>&1 || {
    printf '%s\n' "node is required for --verify" >&2
    exit 69
  }
  exec node tests/playtest-browser-3stage.cjs
fi

command -v python3 >/dev/null 2>&1 || {
  printf '%s\n' "python3 is required to serve the local site" >&2
  exit 69
}

server_pid=
cleanup() {
  if [ -n "${server_pid:-}" ]; then
    kill "$server_pid" 2>/dev/null || :
    wait "$server_pid" 2>/dev/null || :
  fi
}
trap cleanup EXIT
trap 'exit 0' HUP INT TERM

python3 -m http.server "$port" --bind 127.0.0.1 &
server_pid=$!
printf 'Serving on http://127.0.0.1:%s/\n' "$port"
status=0
wait "$server_pid" || status=$?
exit "$status"
