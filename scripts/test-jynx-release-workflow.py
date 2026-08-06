#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
workflow_path = root / ".github" / "workflows" / "jynx-release.yml"
text = workflow_path.read_text(encoding="utf-8")
sync_text = (root / ".github" / "workflows" / "upstream-sync.yml").read_text(encoding="utf-8")
readme = (root / "README.md").read_text(encoding="utf-8")

required = {
    "manual release trigger": "workflow_dispatch:",
    "Apple Silicon runner": "runs-on: macos-14",
    "strict Jynx version validation": "-jynx\\.[0-9]+$",
    "frontend tests": "npm test -- --run",
    "UI-enabled native build": "scripts/build.sh --with-ui --version",
    "canonical UI packaging": "scripts/package-release.sh darwin arm64 --variant ui",
    "fork-safe bundled installer": "--installer scripts/jynx-install.sh",
    "Jynx installer release asset": "scripts/jynx-install.sh",
    "SHA-256 manifest": "shasum -a 256",
    "binary identity smoke": "Jynx Observatory",
    "build provenance": "actions/attest-build-provenance@",
    "GitHub release": "gh release create",
    "release write permission": "contents: write",
    "attestation permission": "attestations: write",
    "OIDC permission": "id-token: write",
    "unprivileged build job": "  build:\n",
    "isolated publish job": "  publish:\n",
    "isolated attestation job": "  attest:\n",
    "credential-free checkout": "persist-credentials: false",
    "artifact upload handoff": "actions/upload-artifact@",
    "artifact download handoff": "actions/download-artifact@",
    "publish dependency": "needs: attest",
    "main ref gate": "github.ref == 'refs/heads/main'",
    "installer security fixture": "bash scripts/test-jynx-installer.sh",
    "workflow contract fixture": "python3 scripts/test-jynx-release-workflow.py",
}

missing = [name for name, needle in required.items() if needle not in text]
if missing:
    raise SystemExit("missing Jynx release contracts: " + ", ".join(missing))

build_block = text.split("  build:\n", 1)[1].split("  attest:\n", 1)[0]
for forbidden in ("contents: write", "id-token: write", "attestations: write"):
    if forbidden in build_block:
        raise SystemExit(f"build job must not hold release permission: {forbidden}")

publish_block = text.split("  publish:\n", 1)[1]
for forbidden in ("id-token: write", "attestations: write"):
    if forbidden in publish_block:
        raise SystemExit(f"publish job must not hold attestation permission: {forbidden}")

package_script = (root / "scripts" / "package-release.sh").read_text(encoding="utf-8")
if "--installer" not in package_script:
    raise SystemExit("canonical packaging does not support the Jynx installer override")
if 'if [ "$GOOS" != "windows" ]; then' not in package_script:
    raise SystemExit("canonical packaging must not validate a Unix installer for Windows")
if 'chmod 755 "$BUILD_DIR/install.sh"' not in package_script:
    raise SystemExit("Unix release installer mode is not made explicitly executable")

for forbidden in ("npm publish", "twine upload", "mcp-publisher publish", "VIRUS_TOTAL"):
    if forbidden in text:
        raise SystemExit(f"fork release must not use upstream publishing secret: {forbidden}")

for documented in (
    "Jynx Observatory",
    "releases/latest/download/jynx-install.sh",
    "--rollback",
    "Apple Silicon",
    "not notarized",
):
    if documented not in readme:
        raise SystemExit(f"README is missing Jynx release guidance: {documented}")

sync_required = {
    "scheduled sync": "schedule:",
    "canonical upstream": "DeusData/codebase-memory-mcp.git",
    "review branch": "automation/upstream-sync",
    "refresh-safe force lease": "refs/remotes/origin/$BRANCH",
    "recursive CI warning": "close and reopen this PR",
    "reviewable pull request": "gh pr create",
    "conflict fail-closed": "git merge --abort",
}
missing_sync = [name for name, needle in sync_required.items() if needle not in sync_text]
if missing_sync:
    raise SystemExit("missing upstream sync contracts: " + ", ".join(missing_sync))
if "gh pr merge" in sync_text:
    raise SystemExit("upstream sync must never auto-merge")

print("Jynx release workflow contract passed")
