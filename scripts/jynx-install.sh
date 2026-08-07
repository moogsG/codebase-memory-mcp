#!/usr/bin/env bash
# Safe Jynx Observatory upgrade/rollback for the UI-enabled macOS arm64 build.
set -euo pipefail

REPO="moogsG/codebase-memory-mcp"
INSTALL_DIR="$HOME/.local/bin"
ROLLBACK=false
BASE_URL="${CBM_JYNX_DOWNLOAD_URL:-https://github.com/${REPO}/releases/latest/download}"
ARCHIVE="codebase-memory-mcp-ui-darwin-arm64.tar.gz"
ROLLBACK_EXPECTED_SHA256=""

usage() {
  cat <<'EOF'
Usage: scripts/jynx-install.sh [--dir DIR] [--rollback]

Installs the latest checksum-verified Jynx Observatory build for Apple Silicon.
The previous executable is preserved as codebase-memory-mcp.jynx-rollback.

Options:
  --dir DIR     Install directory (default: ~/.local/bin)
  --rollback    Restore the previously preserved executable
  -h, --help    Show this help

Environment:
  CBM_JYNX_DOWNLOAD_URL  Override the release asset base URL. HTTPS is required;
                          exact loopback HTTP is accepted for local tests only.
EOF
}

expect_dir=false
for arg in "$@"; do
  if $expect_dir; then
    INSTALL_DIR="$arg"
    expect_dir=false
    continue
  fi
  case "$arg" in
    --dir) expect_dir=true ;;
    --dir=*) INSTALL_DIR="${arg#--dir=}" ;;
    --rollback) ROLLBACK=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "jynx-install: unknown argument '$arg'" >&2; usage >&2; exit 2 ;;
  esac
done
$expect_dir && { echo "jynx-install: --dir needs a value" >&2; exit 2; }
[ -n "$INSTALL_DIR" ] || { echo "jynx-install: install directory cannot be empty" >&2; exit 2; }

DEST="$INSTALL_DIR/codebase-memory-mcp"
BACKUP="$INSTALL_DIR/codebase-memory-mcp.jynx-rollback"
BACKUP_SUM="$BACKUP.sha256"
PERSISTED_INSTALLER="$INSTALL_DIR/jynx-install.sh"
LOCK_DIR="$INSTALL_DIR/.jynx-install.lock"
LOCK_HELD=false
WORK=""
STAGE_DIR=""

cleanup() {
  [ -z "$WORK" ] || rm -rf -- "$WORK"
  [ -z "$STAGE_DIR" ] || rm -rf -- "$STAGE_DIR"
  if $LOCK_HELD && ! rmdir "$LOCK_DIR" 2>/dev/null; then
    echo "jynx-install: warning: could not release install lock at $LOCK_DIR" >&2
  fi
}
trap cleanup EXIT

acquire_lock() {
  mkdir -p "$INSTALL_DIR"
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "jynx-install: another Jynx install or rollback is active at $LOCK_DIR" >&2
    return 1
  fi
  LOCK_HELD=true
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    echo "jynx-install: sha256sum or shasum is required" >&2
    return 1
  fi
}

single_link_regular_file() {
  local path="$1" links
  [ -f "$path" ] && [ ! -L "$path" ] || return 1
  links=$(stat -f '%l' "$path" 2>/dev/null || stat -c '%h' "$path" 2>/dev/null) || return 1
  [ "$links" = 1 ]
}

activate() {
  local installer="$1" candidate="$2" expected_sha256="${3:-}" expected_version installed_version
  local -a install_args=(install -y --force "--dir=$INSTALL_DIR" --skip-config --skip-path)
  expected_version=$("$candidate" --version 2>/dev/null) || return 1
  if [ "$installer" != "$candidate" ]; then
    [ -n "$expected_sha256" ] || return 1
    install_args+=("--candidate=$candidate" "--candidate-sha256=$expected_sha256")
  fi
  "$installer" "${install_args[@]}" || return 1
  single_link_regular_file "$DEST" && [ -x "$DEST" ] || return 1
  if [ -n "$expected_sha256" ]; then
    [ "$(sha256_file "$DEST")" = "$expected_sha256" ] || return 1
  fi
  installed_version=$("$DEST" --version 2>/dev/null) || return 1
  [ "$installed_version" = "$expected_version" ]
}

restore_backup() {
  local activator="${1:-}" backup_version current_version expected_sha256
  rollback_pair_is_valid || {
    echo "jynx-install: no verified rollback executable found at $BACKUP" >&2
    return 1
  }
  expected_sha256="$ROLLBACK_EXPECTED_SHA256"
  backup_version=$("$BACKUP" --version 2>/dev/null) || return 1
  current_version=$("$DEST" --version 2>/dev/null || true)
  if single_link_regular_file "$DEST" && [ -x "$DEST" ] &&
     [ "$current_version" = "$backup_version" ] &&
     [ "$(sha256_file "$DEST" 2>/dev/null || true)" = "$(sha256_file "$BACKUP")" ]; then
    echo "Restored: $current_version"
    return 0
  fi
  if [ -z "$activator" ]; then
    single_link_regular_file "$DEST" && [ -x "$DEST" ] || {
      echo "jynx-install: current executable cannot coordinate rollback" >&2
      return 1
    }
    activator="$DEST"
  fi
  activate "$activator" "$BACKUP" "$expected_sha256" || {
    echo "jynx-install: rollback activation failed" >&2
    return 1
  }
  echo "Restored: $("$DEST" --version 2>&1)"
}

rollback_pair_is_valid() {
  single_link_regular_file "$BACKUP" &&
    single_link_regular_file "$BACKUP_SUM" || return 1
  local expected actual
  expected=$(awk 'NR == 1 { print $1 }' "$BACKUP_SUM")
  case "$expected" in ''|*[!0-9A-Fa-f]*) return 1 ;; esac
  [ "${#expected}" -eq 64 ] || return 1
  actual=$(sha256_file "$BACKUP")
  expected=$(printf '%s' "$expected" | tr 'A-F' 'a-f')
  [ "$expected" = "$(printf '%s' "$actual" | tr 'A-F' 'a-f')" ] || return 1
  "$BACKUP" --version >/dev/null 2>&1 || return 1
  ROLLBACK_EXPECTED_SHA256="$expected"
}

remove_regular_file() {
  local path="$1"
  if [ -e "$path" ] || [ -L "$path" ]; then
    [ -f "$path" ] && [ ! -L "$path" ] || {
      echo "jynx-install: refusing unsafe rollback state at $path" >&2
      return 1
    }
    rm -f "$path"
  fi
}

recover_failed_activation() {
  if $HAD_DEST; then
    restore_backup "$CANDIDATE" || {
      echo "jynx-install: CRITICAL: automatic rollback failed; destination requires manual recovery" >&2
      return 1
    }
  elif [ -e "$DEST" ] || [ -L "$DEST" ]; then
    remove_regular_file "$DEST" || {
      echo "jynx-install: CRITICAL: failed fresh activation left an unsafe destination" >&2
      return 1
    }
  fi
}

if $ROLLBACK; then
  acquire_lock
  restore_backup
  exit $?
fi

[ "$(uname -s)" = "Darwin" ] && [ "$(uname -m)" = "arm64" ] || {
  echo "jynx-install: this Jynx Edition installer currently supports Apple Silicon macOS only" >&2
  exit 1
}

case "$BASE_URL" in
  https://*)
    CURL_PROTOCOL_ARGS=(--proto '=https' --proto-redir '=https')
    CURL_REDIRECT_ARGS=(--location --max-redirs 5)
    ;;
  http://*)
    if [[ "$BASE_URL" =~ ^http://(127[.]0[.]0[.]1|localhost):([0-9]{1,5})(/[-A-Za-z0-9._~/]*)?$ ]]; then
      LOOPBACK_PORT=$((10#${BASH_REMATCH[2]}))
      [ "$LOOPBACK_PORT" -ge 1 ] && [ "$LOOPBACK_PORT" -le 65535 ] || {
        echo "jynx-install: download URL must use HTTPS or exact loopback HTTP" >&2
        exit 1
      }
      CURL_PROTOCOL_ARGS=(--proto '=http' --proto-redir '=http')
      CURL_REDIRECT_ARGS=(--location --max-redirs 0)
    else
      echo "jynx-install: download URL must use HTTPS or exact loopback HTTP" >&2
      exit 1
    fi
    ;;
  *) echo "jynx-install: download URL must use HTTPS or exact loopback HTTP" >&2; exit 1 ;;
esac
BASE_URL="${BASE_URL%/}"

acquire_lock
WORK=$(mktemp -d "${TMPDIR:-/tmp}/jynx-install.XXXXXX")
STAGE_DIR=$(mktemp -d "$INSTALL_DIR/.jynx-install-stage.XXXXXX")

download_asset() {
  local asset="$1" max_bytes="$2"
  curl "${CURL_PROTOCOL_ARGS[@]}" "${CURL_REDIRECT_ARGS[@]}" \
    --fail --silent --show-error --connect-timeout 15 --max-time 600 \
    --max-filesize "$max_bytes" "$BASE_URL/$asset" --output "$WORK/$asset"
}

download_asset "$ARCHIVE" 262144000
download_asset checksums.txt 1048576
download_asset jynx-install.sh 1048576

CHECKSUM_BYTES=$(wc -c < "$WORK/checksums.txt" | tr -d '[:space:]')
case "$CHECKSUM_BYTES" in ''|*[!0-9]*) echo "jynx-install: invalid checksum manifest" >&2; exit 1 ;; esac
[ "$CHECKSUM_BYTES" -le 1048576 ] || { echo "jynx-install: checksums.txt exceeds 1 MiB" >&2; exit 1; }

verify_release_asset() {
  local asset="$1" expected actual count
  expected=$(awk -v asset="$asset" '$2 == asset || $2 == "*" asset { print $1 }' \
    "$WORK/checksums.txt" | sort -u)
  count=$(printf '%s\n' "$expected" | awk 'NF { count++ } END { print count + 0 }')
  [ "$count" = "1" ] || {
    echo "jynx-install: expected exactly one checksum for $asset" >&2
    return 1
  }
  case "$expected" in ''|*[!0-9A-Fa-f]*) echo "jynx-install: invalid release checksum" >&2; return 1 ;; esac
  [ "${#expected}" -eq 64 ] || { echo "jynx-install: invalid release checksum" >&2; return 1; }
  actual=$(sha256_file "$WORK/$asset")
  if [ "$(printf '%s' "$expected" | tr 'A-F' 'a-f')" != "$(printf '%s' "$actual" | tr 'A-F' 'a-f')" ]; then
    echo "jynx-install: CHECKSUM MISMATCH — refusing release" >&2
    return 1
  fi
}

verify_release_asset "$ARCHIVE"
verify_release_asset "jynx-install.sh"
INSTALLER_EXPECTED_HASH=$(sha256_file "$WORK/jynx-install.sh")

tar -tzf "$WORK/$ARCHIVE" | LC_ALL=C sort > "$WORK/archive-names"
printf '%s\n' LICENSE THIRD_PARTY_NOTICES.md codebase-memory-mcp install.sh | LC_ALL=C sort > "$WORK/expected-names"
cmp -s "$WORK/archive-names" "$WORK/expected-names" || {
  echo "jynx-install: release archive has an unsafe or unexpected layout" >&2
  exit 1
}
tar -tvzf "$WORK/$ARCHIVE" > "$WORK/archive-details"
if ! awk 'substr($1, 1, 1) != "-" { exit 1 }' "$WORK/archive-details"; then
  echo "jynx-install: release archive has an unsafe or unexpected layout" >&2
  exit 1
fi
if grep -Eq ' link to | -> ' "$WORK/archive-details"; then
  echo "jynx-install: release archive has an unsafe or unexpected layout" >&2
  exit 1
fi
mkdir "$WORK/extract"
tar -xzf "$WORK/$ARCHIVE" -C "$WORK/extract"
CANDIDATE="$WORK/extract/codebase-memory-mcp"
[ -f "$CANDIDATE" ] && [ ! -L "$CANDIDATE" ] || {
  echo "jynx-install: release candidate is not a regular executable" >&2
  exit 1
}
chmod 755 "$CANDIDATE"
CANDIDATE_VERSION=$("$CANDIDATE" --version 2>&1) || {
  echo "jynx-install: release candidate failed its version check" >&2
  exit 1
}
case "$CANDIDATE_VERSION" in *-jynx.*) ;; *) echo "jynx-install: candidate is not a Jynx Edition build" >&2; exit 1 ;; esac

INSTALLER_TMP="$STAGE_DIR/jynx-install.sh"
cp "$WORK/jynx-install.sh" "$INSTALLER_TMP"
chmod 755 "$INSTALLER_TMP"
STAGED_INSTALLER_HASH=$(sha256_file "$INSTALLER_TMP")
[ "$STAGED_INSTALLER_HASH" = "$INSTALLER_EXPECTED_HASH" ] || {
  echo "jynx-install: staged updater checksum mismatch" >&2
  exit 1
}
if [ -e "$PERSISTED_INSTALLER" ] || [ -L "$PERSISTED_INSTALLER" ]; then
  [ -f "$PERSISTED_INSTALLER" ] && [ ! -L "$PERSISTED_INSTALLER" ] || {
    echo "jynx-install: refusing to replace a non-regular updater at $PERSISTED_INSTALLER" >&2
    exit 1
  }
fi
HAD_DEST=false
if [ -e "$DEST" ]; then
  HAD_DEST=true
  [ -f "$DEST" ] && [ ! -L "$DEST" ] && [ -x "$DEST" ] || {
    echo "jynx-install: refusing to replace a non-regular target at $DEST" >&2
    exit 1
  }
  "$DEST" --version >/dev/null 2>&1 || {
    echo "jynx-install: current executable failed its version check; refusing to overwrite it" >&2
    exit 1
  }
  if ! rollback_pair_is_valid; then
    if { [ -e "$BACKUP" ] || [ -L "$BACKUP" ]; } &&
       { [ -e "$BACKUP_SUM" ] || [ -L "$BACKUP_SUM" ]; }; then
      echo "jynx-install: existing rollback pair is invalid; refusing to replace it" >&2
      exit 1
    fi
    remove_regular_file "$BACKUP"
    remove_regular_file "$BACKUP_SUM"
    BACKUP_TMP="$STAGE_DIR/codebase-memory-mcp.jynx-rollback"
    BACKUP_SUM_TMP="$STAGE_DIR/codebase-memory-mcp.jynx-rollback.sha256"
    cp -p "$DEST" "$BACKUP_TMP"
    chmod 755 "$BACKUP_TMP"
    printf '%s  %s\n' "$(sha256_file "$BACKUP_TMP")" "$(basename "$BACKUP")" > "$BACKUP_SUM_TMP"
    mv -f "$BACKUP_TMP" "$BACKUP"
    mv -f "$BACKUP_SUM_TMP" "$BACKUP_SUM"
    rollback_pair_is_valid || {
      echo "jynx-install: failed to publish a verified rollback pair" >&2
      exit 1
    }
  fi
else
  # No current destination means any surviving rollback files are unrelated
  # stale state and must not be advertised or restored by this fresh install.
  remove_regular_file "$BACKUP"
  remove_regular_file "$BACKUP_SUM"
fi

if ! activate "$CANDIDATE" "$CANDIDATE"; then
  rm -f "$INSTALLER_TMP"
  echo "jynx-install: activation health check failed; attempting rollback" >&2
  recover_failed_activation
  exit 1
fi

if ! mv -f "$INSTALLER_TMP" "$PERSISTED_INSTALLER"; then
  rm -f "$INSTALLER_TMP"
  echo "jynx-install: could not persist the verified updater; attempting rollback" >&2
  recover_failed_activation
  exit 1
fi
if [ ! -f "$PERSISTED_INSTALLER" ] || [ -L "$PERSISTED_INSTALLER" ] ||
   [ "$(sha256_file "$PERSISTED_INSTALLER")" != "$INSTALLER_EXPECTED_HASH" ]; then
  remove_regular_file "$PERSISTED_INSTALLER" || true
  echo "jynx-install: persisted updater checksum mismatch; attempting rollback" >&2
  recover_failed_activation
  exit 1
fi

echo "Installed: $("$DEST" --version 2>&1)"
if rollback_pair_is_valid; then
  echo "Rollback: $PERSISTED_INSTALLER --rollback --dir '$INSTALL_DIR'"
fi
