#!/bin/bash
# ============================================================
# FIX SCRIPT: Build Error - Property 'sub_kelas' missing on User type
# Target: src/lib/db.ts  |  Error: src/lib/auth.tsx:90
# ============================================================

set -e

DB_FILE="src/lib/db.ts"
AUTH_FILE="src/lib/auth.tsx"

echo "[FIX] Checking files..."

if [ ! -f "$DB_FILE" ]; then
    echo "[ERROR] $DB_FILE not found! Run this script from project root."
    exit 1
fi

if [ ! -f "$AUTH_FILE" ]; then
    echo "[ERROR] $AUTH_FILE not found! Run this script from project root."
    exit 1
fi

# --------------------------------------------------------
# FIX 1: Add sub_kelas?: string; to User interface in db.ts
# --------------------------------------------------------
if grep -q "sub_kelas" "$DB_FILE"; then
    echo "[SKIP] sub_kelas already exists in $DB_FILE"
else
    echo "[PATCH] Adding sub_kelas?: string; to User interface..."
    # Insert after the kelas line in User interface
    sed -i '/kelas: "teknik" | "nonteknik" | "keduanya";/a\  sub_kelas?: string;' "$DB_FILE"
    echo "[OK]    User interface patched."
fi

# --------------------------------------------------------
# FIX 2: Ensure AuthUser.sub_kelas is optional (defensive)
# --------------------------------------------------------
if grep -q "sub_kelas?" "$AUTH_FILE"; then
    echo "[SKIP] sub_kelas already optional in $AUTH_FILE"
else
    echo "[PATCH] Making sub_kelas optional in AuthUser..."
    sed -i 's/sub_kelas: string;/sub_kelas?: string;/' "$AUTH_FILE"
    echo "[OK]    AuthUser interface patched."
fi

# --------------------------------------------------------
# VERIFY
# --------------------------------------------------------
echo ""
echo "[VERIFY] Running TypeScript check..."
if command -v npx &> /dev/null; then
    npx tsc --noEmit 2>&1 | head -20 || true
else
    echo "[WARN] npx not found. Skipping tsc verify. Run 'npm run build' manually."
fi

echo ""
echo "============================================================"
echo "  FIX COMPLETE"
echo "  Next step: git add . && git commit -m 'fix: add sub_kelas to User type' && git push"
echo "============================================================"
