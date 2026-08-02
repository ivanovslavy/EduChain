#!/usr/bin/env bash
# Static analysis layer — Slither over the 7 production contracts only.
# Install once:  pipx install slither-analyzer   (needs solc 0.8.28 via solc-select)
# Run:          ./slither.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "== Slither — production contracts only (test/ + mocks excluded) =="
slither . \
  --filter-paths "node_modules|contracts/test|lib|test-forge" \
  --exclude-dependencies \
  --checklist \
  --markdown-root . \
  2>&1 | tee slither-report.md || true

echo
echo "Focus detectors for THIS codebase (grep the report):"
echo "  reentrancy-eth · arbitrary-send-eth · unchecked-transfer · calls-loop · tx-origin · locked-ether"
