#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/jynx-installer-test.XXXXXX")"
SERVER_PID=""
REDIRECT_PID=""
cleanup() {
  [ -z "$SERVER_PID" ] || kill "$SERVER_PID" 2>/dev/null || true
  [ -z "$REDIRECT_PID" ] || kill "$REDIRECT_PID" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

FIXTURE="$WORK/release"
PAYLOAD="$WORK/payload"
TARGET="$WORK/bin"
TEST_HOME="$WORK/home"
mkdir -p "$FIXTURE" "$PAYLOAD" "$TARGET" "$TEST_HOME"
export HOME="$TEST_HOME"

make_fake_binary() {
  local path="$1" version="$2"
  cat > "$path" <<EOF
#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = "--version" ]; then
  echo "codebase-memory-mcp $version"
  exit 0
fi
if [ "\${1:-}" = "install" ]; then
  shift
  install_dir=""
  install_source="\$0"
  expected_sha256=""
  for arg in "\$@"; do
    case "\$arg" in
      --dir=*) install_dir="\${arg#--dir=}" ;;
      --candidate=*) install_source="\${arg#--candidate=}" ;;
      --candidate-sha256=*) expected_sha256="\${arg#--candidate-sha256=}" ;;
    esac
  done
  [ -n "\$install_dir" ]
  if [ -n "\${JYNX_TEST_SWAP_CANDIDATE_WITH:-}" ] && [ "\$install_source" != "\$0" ]; then
    cp "\$JYNX_TEST_SWAP_CANDIDATE_WITH" "\$install_source"
    chmod 755 "\$install_source"
  fi
  if [ -n "\$expected_sha256" ]; then
    if command -v sha256sum >/dev/null 2>&1; then
      actual_sha256=\$(sha256sum "\$install_source" | awk '{print \$1}')
    else
      actual_sha256=\$(shasum -a 256 "\$install_source" | awk '{print \$1}')
    fi
    [ "\$actual_sha256" = "\$expected_sha256" ]
  fi
  mkdir -p "\$install_dir"
  cp "\$install_source" "\$install_dir/codebase-memory-mcp"
  chmod 755 "\$install_dir/codebase-memory-mcp"
  exit 0
fi
echo '{}'
EOF
  chmod 755 "$path"
}

make_failing_binary() {
  local path="$1" version="$2"
  cat > "$path" <<EOF
#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = "--version" ]; then
  echo "codebase-memory-mcp $version"
  exit 0
fi
if [ "\${1:-}" = "install" ]; then
  exit 1
fi
echo '{}'
EOF
  chmod 755 "$path"
}

make_legacy_binary() {
  local path="$1" version="$2"
  cat > "$path" <<EOF
#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = "--version" ]; then
  echo "codebase-memory-mcp $version"
  exit 0
fi
if [ "\${1:-}" = "install" ]; then
  install_dir="\$HOME/.local/bin"
  mkdir -p "\$install_dir"
  cp "\$0" "\$install_dir/codebase-memory-mcp"
  chmod 755 "\$install_dir/codebase-memory-mcp"
  exit 0
fi
echo '{}'
EOF
  chmod 755 "$path"
}

make_legacy_binary "$TARGET/codebase-memory-mcp" "0.9.0-upstream"
make_fake_binary "$PAYLOAD/codebase-memory-mcp" "0.9.0-jynx.3"
printf 'test license\n' > "$PAYLOAD/LICENSE"
printf '#!/usr/bin/env bash\n' > "$PAYLOAD/install.sh"
printf 'test notices\n' > "$PAYLOAD/THIRD_PARTY_NOTICES.md"

tar -czf "$FIXTURE/codebase-memory-mcp-ui-darwin-arm64.tar.gz" \
  -C "$PAYLOAD" codebase-memory-mcp LICENSE install.sh THIRD_PARTY_NOTICES.md
cp "$ROOT/scripts/jynx-install.sh" "$FIXTURE/jynx-install.sh"
chmod 755 "$FIXTURE/jynx-install.sh"
(
  cd "$FIXTURE"
  shasum -a 256 codebase-memory-mcp-ui-darwin-arm64.tar.gz jynx-install.sh > checksums.txt
)

PORT_FILE="$WORK/port"
python3 "$ROOT/scripts/smoke-fixture-server.py" \
  --directory "$FIXTURE" --port-file "$PORT_FILE" >"$WORK/server.log" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 100); do
  [ -s "$PORT_FILE" ] && break
  sleep 0.05
done
[ -s "$PORT_FILE" ] || { cat "$WORK/server.log" >&2; exit 1; }
PORT=$(cat "$PORT_FILE")
BASE_URL="http://127.0.0.1:$PORT"

for unsafe_url in \
  'http://localhost:8080@evil.example' \
  'http://127.0.0.1:8080@evil.example' \
  'http://localhost:abc/path'; do
  if CBM_JYNX_DOWNLOAD_URL="$unsafe_url" \
    bash "$ROOT/scripts/jynx-install.sh" --dir "$TARGET" \
      >"$WORK/unsafe-url.log" 2>&1; then
    echo "installer accepted unsafe loopback URL: $unsafe_url" >&2
    exit 1
  fi
  grep -q 'download URL must use HTTPS or exact loopback HTTP' "$WORK/unsafe-url.log"
done

REDIRECT_PORT_FILE="$WORK/redirect-port"
python3 -c '
import http.server, sys
target, port_file = sys.argv[1].rstrip("/"), sys.argv[2]
class Redirect(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(302)
        self.send_header("Location", target + self.path)
        self.end_headers()
    def log_message(self, *_):
        pass
server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Redirect)
with open(port_file, "w", encoding="ascii") as handle:
    handle.write(str(server.server_port))
server.serve_forever()
' "$BASE_URL" "$REDIRECT_PORT_FILE" &
REDIRECT_PID=$!
for _ in $(seq 1 100); do
  [ -s "$REDIRECT_PORT_FILE" ] && break
  sleep 0.05
done
[ -s "$REDIRECT_PORT_FILE" ] || exit 1
REDIRECT_PORT=$(cat "$REDIRECT_PORT_FILE")
if CBM_JYNX_DOWNLOAD_URL="http://127.0.0.1:$REDIRECT_PORT" \
  bash "$ROOT/scripts/jynx-install.sh" --dir "$TARGET" \
    >"$WORK/redirect.log" 2>&1; then
  echo "installer followed a loopback HTTP redirect" >&2
  exit 1
fi
[ "$("$TARGET/codebase-memory-mcp" --version)" = "codebase-memory-mcp 0.9.0-upstream" ]

LOCK_TARGET="$WORK/locked-bin"
mkdir -p "$LOCK_TARGET/.jynx-install.lock"
cp "$TARGET/codebase-memory-mcp" "$LOCK_TARGET/codebase-memory-mcp"
if CBM_JYNX_DOWNLOAD_URL="$BASE_URL" \
  bash "$ROOT/scripts/jynx-install.sh" --dir "$LOCK_TARGET" \
    >"$WORK/locked.log" 2>&1; then
  echo "installer ignored an active install lock" >&2
  exit 1
fi
grep -q 'another Jynx install or rollback is active' "$WORK/locked.log"
[ "$("$LOCK_TARGET/codebase-memory-mcp" --version)" = "codebase-memory-mcp 0.9.0-upstream" ]

UPDATER_TARGET="$WORK/nonregular-updater-bin"
mkdir -p "$UPDATER_TARGET/jynx-install.sh"
cp "$TARGET/codebase-memory-mcp" "$UPDATER_TARGET/codebase-memory-mcp"
if CBM_JYNX_DOWNLOAD_URL="$BASE_URL" \
  bash "$ROOT/scripts/jynx-install.sh" --dir "$UPDATER_TARGET" \
    >"$WORK/nonregular-updater.log" 2>&1; then
  echo "installer accepted a non-regular persisted updater path" >&2
  exit 1
fi
grep -q 'refusing to replace a non-regular updater' "$WORK/nonregular-updater.log"
[ "$("$UPDATER_TARGET/codebase-memory-mcp" --version)" = "codebase-memory-mcp 0.9.0-upstream" ]

CBM_JYNX_DOWNLOAD_URL="$BASE_URL" \
  bash "$ROOT/scripts/jynx-install.sh" --dir "$TARGET"

[ "$("$TARGET/codebase-memory-mcp" --version)" = "codebase-memory-mcp 0.9.0-jynx.3" ]
[ "$("$TARGET/codebase-memory-mcp.jynx-rollback" --version)" = "codebase-memory-mcp 0.9.0-upstream" ]
[ -s "$TARGET/codebase-memory-mcp.jynx-rollback.sha256" ]
[ -x "$TARGET/jynx-install.sh" ]
cmp "$FIXTURE/jynx-install.sh" "$TARGET/jynx-install.sh"

# A later Jynx upgrade must preserve the durable pre-Jynx rollback generation.
ROLLBACK_HASH_BEFORE=$(shasum -a 256 "$TARGET/codebase-memory-mcp.jynx-rollback" | awk '{print $1}')
CBM_JYNX_DOWNLOAD_URL="$BASE_URL" \
  bash "$ROOT/scripts/jynx-install.sh" --dir "$TARGET"
[ "$(shasum -a 256 "$TARGET/codebase-memory-mcp.jynx-rollback" | awk '{print $1}')" = "$ROLLBACK_HASH_BEFORE" ]
[ "$("$TARGET/codebase-memory-mcp.jynx-rollback" --version)" = "codebase-memory-mcp 0.9.0-upstream" ]

bash "$TARGET/jynx-install.sh" --rollback --dir "$TARGET"
[ "$("$TARGET/codebase-memory-mcp" --version)" = "codebase-memory-mcp 0.9.0-upstream" ]

# Matching version text is not proof of a completed rollback: differing bytes
# must still be replaced by the checksum-pinned rollback generation.
make_fake_binary "$TARGET/codebase-memory-mcp" "0.9.0-upstream"
if cmp -s "$TARGET/codebase-memory-mcp" "$TARGET/codebase-memory-mcp.jynx-rollback"; then
  echo "same-version rollback fixture unexpectedly matched pinned backup bytes" >&2
  exit 1
fi
bash "$TARGET/jynx-install.sh" --rollback --dir "$TARGET"
cmp "$TARGET/codebase-memory-mcp" "$TARGET/codebase-memory-mcp.jynx-rollback"

# A destination symlink must never be accepted as an idempotently restored
# executable, even when it resolves to the checksum-valid rollback generation.
SYMLINK_ROLLBACK_TARGET="$WORK/symlink-rollback-bin"
mkdir -p "$SYMLINK_ROLLBACK_TARGET"
cp "$TARGET/codebase-memory-mcp.jynx-rollback" \
  "$SYMLINK_ROLLBACK_TARGET/codebase-memory-mcp.jynx-rollback"
cp "$TARGET/codebase-memory-mcp.jynx-rollback.sha256" \
  "$SYMLINK_ROLLBACK_TARGET/codebase-memory-mcp.jynx-rollback.sha256"
ln -s codebase-memory-mcp.jynx-rollback \
  "$SYMLINK_ROLLBACK_TARGET/codebase-memory-mcp"
if bash "$TARGET/jynx-install.sh" --rollback --dir "$SYMLINK_ROLLBACK_TARGET" \
    >"$WORK/symlink-rollback.log" 2>&1; then
  echo "rollback accepted a symlink destination" >&2
  exit 1
fi
[ -L "$SYMLINK_ROLLBACK_TARGET/codebase-memory-mcp" ]
grep -q "current executable cannot coordinate rollback" "$WORK/symlink-rollback.log"

# The manifest digest must stay bound to the bytes staged by the native
# activator. A deterministic swap after shell validation must fail closed.
RACE_ROLLBACK_TARGET="$WORK/race-rollback-bin"
mkdir -p "$RACE_ROLLBACK_TARGET"
make_fake_binary "$RACE_ROLLBACK_TARGET/codebase-memory-mcp" "0.9.0-jynx.3"
cp "$TARGET/codebase-memory-mcp.jynx-rollback" \
  "$RACE_ROLLBACK_TARGET/codebase-memory-mcp.jynx-rollback"
shasum -a 256 "$RACE_ROLLBACK_TARGET/codebase-memory-mcp.jynx-rollback" \
  > "$RACE_ROLLBACK_TARGET/codebase-memory-mcp.jynx-rollback.sha256"
make_fake_binary "$WORK/swapped-rollback-candidate" "0.9.0-upstream"
if JYNX_TEST_SWAP_CANDIDATE_WITH="$WORK/swapped-rollback-candidate" \
    bash "$TARGET/jynx-install.sh" --rollback --dir "$RACE_ROLLBACK_TARGET" \
      >"$WORK/race-rollback.log" 2>&1; then
  echo "rollback accepted bytes swapped after manifest validation" >&2
  exit 1
fi
[ "$("$RACE_ROLLBACK_TARGET/codebase-memory-mcp" --version)" = \
  "codebase-memory-mcp 0.9.0-jynx.3" ]
grep -q "rollback activation failed" "$WORK/race-rollback.log"

# Rollback state and an idempotently restored destination must each be a
# single-link regular file; hardlinks cannot bypass the native transaction.
for hardlink_case in backup manifest destination; do
  HARDLINK_ROLLBACK_TARGET="$WORK/hardlink-$hardlink_case-bin"
  mkdir -p "$HARDLINK_ROLLBACK_TARGET"
  cp "$TARGET/codebase-memory-mcp.jynx-rollback" \
    "$HARDLINK_ROLLBACK_TARGET/codebase-memory-mcp.jynx-rollback"
  shasum -a 256 "$HARDLINK_ROLLBACK_TARGET/codebase-memory-mcp.jynx-rollback" \
    > "$HARDLINK_ROLLBACK_TARGET/codebase-memory-mcp.jynx-rollback.sha256"
  if [ "$hardlink_case" = destination ]; then
    cp "$HARDLINK_ROLLBACK_TARGET/codebase-memory-mcp.jynx-rollback" \
      "$HARDLINK_ROLLBACK_TARGET/codebase-memory-mcp"
    ln "$HARDLINK_ROLLBACK_TARGET/codebase-memory-mcp" \
      "$HARDLINK_ROLLBACK_TARGET/destination-peer"
  else
    make_fake_binary "$HARDLINK_ROLLBACK_TARGET/codebase-memory-mcp" "0.9.0-jynx.3"
    if [ "$hardlink_case" = backup ]; then
      ln "$HARDLINK_ROLLBACK_TARGET/codebase-memory-mcp.jynx-rollback" \
        "$HARDLINK_ROLLBACK_TARGET/backup-peer"
    else
      ln "$HARDLINK_ROLLBACK_TARGET/codebase-memory-mcp.jynx-rollback.sha256" \
        "$HARDLINK_ROLLBACK_TARGET/manifest-peer"
    fi
  fi
  if bash "$TARGET/jynx-install.sh" --rollback --dir "$HARDLINK_ROLLBACK_TARGET" \
      >"$WORK/hardlink-$hardlink_case.log" 2>&1; then
    echo "rollback accepted hardlinked $hardlink_case" >&2
    exit 1
  fi
done

# A destination-free install must not inherit an unrelated stale rollback pair.
FRESH_TARGET="$WORK/fresh-bin"
mkdir -p "$FRESH_TARGET"
cp "$TARGET/codebase-memory-mcp" "$FRESH_TARGET/codebase-memory-mcp.jynx-rollback"
shasum -a 256 "$FRESH_TARGET/codebase-memory-mcp.jynx-rollback" \
  > "$FRESH_TARGET/codebase-memory-mcp.jynx-rollback.sha256"
CBM_JYNX_DOWNLOAD_URL="$BASE_URL" \
  bash "$ROOT/scripts/jynx-install.sh" --dir "$FRESH_TARGET"
[ "$("$FRESH_TARGET/codebase-memory-mcp" --version)" = "codebase-memory-mcp 0.9.0-jynx.3" ]
[ ! -e "$FRESH_TARGET/codebase-memory-mcp.jynx-rollback" ]
[ ! -e "$FRESH_TARGET/codebase-memory-mcp.jynx-rollback.sha256" ]
if bash "$FRESH_TARGET/jynx-install.sh" --rollback --dir "$FRESH_TARGET" >/dev/null 2>&1; then
  echo "fresh install retained an unrelated stale rollback generation" >&2
  exit 1
fi

# Refusal paths must not leave a staged updater in the install directory.
mv "$TARGET/codebase-memory-mcp" "$TARGET/original-codebase-memory-mcp"
mkdir "$TARGET/codebase-memory-mcp"
if CBM_JYNX_DOWNLOAD_URL="$BASE_URL" \
  bash "$ROOT/scripts/jynx-install.sh" --dir "$TARGET" >/dev/null 2>&1; then
  echo "installer accepted a non-regular destination" >&2
  exit 1
fi
if compgen -G "$TARGET/.jynx-install-stage.*" >/dev/null; then
  echo "installer left a staged updater after refusing the destination" >&2
  exit 1
fi
[ ! -e "$TARGET/.jynx-install.lock" ]
rmdir "$TARGET/codebase-memory-mcp"
mv "$TARGET/original-codebase-memory-mcp" "$TARGET/codebase-memory-mcp"

# Exact filenames are not enough: hardlink/symlink archive entry types must fail.
cp "$FIXTURE/codebase-memory-mcp-ui-darwin-arm64.tar.gz" "$WORK/original-archive.tar.gz"
cp "$FIXTURE/checksums.txt" "$WORK/original-checksums.txt"
HARDLINK_PAYLOAD="$WORK/hardlink-payload"
mkdir "$HARDLINK_PAYLOAD"
cp "$PAYLOAD/codebase-memory-mcp" "$HARDLINK_PAYLOAD/codebase-memory-mcp"
ln "$HARDLINK_PAYLOAD/codebase-memory-mcp" "$HARDLINK_PAYLOAD/LICENSE"
cp "$PAYLOAD/install.sh" "$PAYLOAD/THIRD_PARTY_NOTICES.md" "$HARDLINK_PAYLOAD/"
tar -czf "$FIXTURE/codebase-memory-mcp-ui-darwin-arm64.tar.gz" \
  -C "$HARDLINK_PAYLOAD" codebase-memory-mcp LICENSE install.sh THIRD_PARTY_NOTICES.md
(
  cd "$FIXTURE"
  shasum -a 256 codebase-memory-mcp-ui-darwin-arm64.tar.gz jynx-install.sh > checksums.txt
)
if CBM_JYNX_DOWNLOAD_URL="$BASE_URL" \
  bash "$ROOT/scripts/jynx-install.sh" --dir "$TARGET" >"$WORK/hardlink.log" 2>&1; then
  echo "installer accepted an archive containing a hardlink entry" >&2
  exit 1
fi
grep -q "unsafe or unexpected layout" "$WORK/hardlink.log"
[ "$("$TARGET/codebase-memory-mcp" --version)" = "codebase-memory-mcp 0.9.0-upstream" ]
mv "$WORK/original-archive.tar.gz" "$FIXTURE/codebase-memory-mcp-ui-darwin-arm64.tar.gz"
mv "$WORK/original-checksums.txt" "$FIXTURE/checksums.txt"

# A candidate that fails activation must leave the verified prior version active.
cp "$FIXTURE/codebase-memory-mcp-ui-darwin-arm64.tar.gz" "$WORK/good-archive.tar.gz"
cp "$FIXTURE/checksums.txt" "$WORK/good-checksums.txt"
FAIL_PAYLOAD="$WORK/fail-payload"
mkdir "$FAIL_PAYLOAD"
make_failing_binary "$FAIL_PAYLOAD/codebase-memory-mcp" "0.9.0-jynx.3"
cp "$PAYLOAD/LICENSE" "$PAYLOAD/install.sh" "$PAYLOAD/THIRD_PARTY_NOTICES.md" "$FAIL_PAYLOAD/"
tar -czf "$FIXTURE/codebase-memory-mcp-ui-darwin-arm64.tar.gz" \
  -C "$FAIL_PAYLOAD" codebase-memory-mcp LICENSE install.sh THIRD_PARTY_NOTICES.md
(
  cd "$FIXTURE"
  shasum -a 256 codebase-memory-mcp-ui-darwin-arm64.tar.gz jynx-install.sh > checksums.txt
)
if CBM_JYNX_DOWNLOAD_URL="$BASE_URL" \
  bash "$ROOT/scripts/jynx-install.sh" --dir "$TARGET" >"$WORK/activation-fail.log" 2>&1; then
  echo "installer accepted a candidate whose activation failed" >&2
  exit 1
fi
grep -q "activation health check failed; attempting rollback" "$WORK/activation-fail.log"
grep -q "Restored: codebase-memory-mcp 0.9.0-upstream" "$WORK/activation-fail.log"
[ "$("$TARGET/codebase-memory-mcp" --version)" = "codebase-memory-mcp 0.9.0-upstream" ]
mv "$WORK/good-archive.tar.gz" "$FIXTURE/codebase-memory-mcp-ui-darwin-arm64.tar.gz"
mv "$WORK/good-checksums.txt" "$FIXTURE/checksums.txt"

printf 'tamper\n' >> "$FIXTURE/codebase-memory-mcp-ui-darwin-arm64.tar.gz"
if CBM_JYNX_DOWNLOAD_URL="$BASE_URL" \
  bash "$ROOT/scripts/jynx-install.sh" --dir "$TARGET" >"$WORK/tamper.log" 2>&1; then
  echo "expected checksum mismatch to fail" >&2
  exit 1
fi
grep -q "CHECKSUM MISMATCH" "$WORK/tamper.log"
[ "$("$TARGET/codebase-memory-mcp" --version)" = "codebase-memory-mcp 0.9.0-upstream" ]

echo "Jynx installer test passed"
