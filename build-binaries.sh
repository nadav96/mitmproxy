#!/bin/bash
set -e

# Build mitmproxy standalone binaries for macOS
# Usage: ./build-binaries.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Building frontend assets..."
cd web
npm install
npm run ci-build-release
cd ..

echo "==> Creating build virtualenv..."
rm -rf .pyinstaller-venv
python3.12 -m venv .pyinstaller-venv
source .pyinstaller-venv/bin/activate
pip install --upgrade pip
pip install -e .
pip install pyinstaller click

echo "==> Running PyInstaller..."
cd release/specs
PATH="$SCRIPT_DIR/.pyinstaller-venv/bin:$PATH" \
PYTHONPATH="$SCRIPT_DIR" \
pyinstaller --clean \
    --workpath ../build/pyinstaller/temp/onedir \
    --distpath ../build/pyinstaller/out \
    onedir-local.spec
cd ../..

echo "==> Packaging binaries..."
mkdir -p release/dist
ARCH=$(uname -m)
TARBALL="release/dist/mitmproxy-custom-macos-${ARCH}.tar.gz"
tar -czvf "$TARBALL" -C release/build/pyinstaller/out/onedir .

echo "==> Cleaning up virtualenv..."
deactivate
rm -rf .pyinstaller-venv

echo ""
echo "Done! Binary archive: $TARBALL"
echo ""
echo "To share with friends:"
echo "  1. Send them the .tar.gz file"
echo "  2. They extract: tar -xzf $(basename "$TARBALL")"
echo "  3. Remove quarantine: xattr -dr com.apple.quarantine mitmproxy mitmdump mitmweb"
echo "  4. Run: ./mitmweb"
