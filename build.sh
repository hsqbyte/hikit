#!/usr/bin/env bash
# =============================================================
#  HiKit — build.sh
#  在 macOS 上打包所有平台的发行版
#  用法：
#    ./build.sh           # 构建全部平台
#    ./build.sh darwin    # 只构建 macOS
#    ./build.sh linux     # 只构建 Linux (需要 Docker)
#    ./build.sh windows   # 只构建 Windows (需要 Docker)
# =============================================================
set -euo pipefail

APP_NAME="HiKit"
VERSION="${VERSION:-$(git describe --tags --always --dirty 2>/dev/null || echo 'dev')}"
DIST="dist"

mkdir -p "$DIST"

log()  { echo "▶  $*"; }
ok()   { echo "✅ $*"; }
warn() { echo "⚠️  $*"; }

# ── 检查依赖 ────────────────────────────────────────────────
check_deps() {
    local missing=()
    command -v wails  &>/dev/null || missing+=("wails  (go install github.com/wailsapp/wails/v2/cmd/wails@latest)")
    command -v go     &>/dev/null || missing+=("go")
    command -v node   &>/dev/null || missing+=("node")
    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "❌ 缺少依赖:"
        for m in "${missing[@]}"; do echo "   - $m"; done
        exit 1
    fi
}

# ── macOS amd64 ─────────────────────────────────────────────
build_darwin_amd64() {
    log "构建 macOS (amd64)..."
    wails build \
        -platform darwin/amd64 \
        -clean \
        -o "${APP_NAME}-macos-amd64"
    local out="build/bin/${APP_NAME}-macos-amd64"
    if [[ -d "${out}.app" ]]; then
        cd build/bin && zip -r "../../${DIST}/${APP_NAME}-${VERSION}-macos-amd64.zip" "${APP_NAME}-macos-amd64.app" && cd ../..
    else
        cd build/bin && zip -r "../../${DIST}/${APP_NAME}-${VERSION}-macos-amd64.zip" "${APP_NAME}-macos-amd64" && cd ../..
    fi
    ok "macOS amd64 → ${DIST}/${APP_NAME}-${VERSION}-macos-amd64.zip"
}

# ── macOS arm64 (Apple Silicon) ────────────────────────────
build_darwin_arm64() {
    log "构建 macOS (arm64)..."
    wails build \
        -platform darwin/arm64 \
        -clean \
        -o "${APP_NAME}-macos-arm64"
    local out="build/bin/${APP_NAME}-macos-arm64"
    if [[ -d "${out}.app" ]]; then
        cd build/bin && zip -r "../../${DIST}/${APP_NAME}-${VERSION}-macos-arm64.zip" "${APP_NAME}-macos-arm64.app" && cd ../..
    else
        cd build/bin && zip -r "../../${DIST}/${APP_NAME}-${VERSION}-macos-arm64.zip" "${APP_NAME}-macos-arm64" && cd ../..
    fi
    ok "macOS arm64 → ${DIST}/${APP_NAME}-${VERSION}-macos-arm64.zip"
}

# ── Linux (via Docker) ──────────────────────────────────────
build_linux() {
    if ! command -v docker &>/dev/null; then
        warn "未找到 Docker，跳过 Linux 构建"
        return
    fi
    log "构建 Linux (amd64/arm64) via Docker..."

    # 使用官方 Wails Linux 构建镜像
    docker run --rm \
        -v "$(pwd):/app" \
        -w /app \
        -e GOPROXY="${GOPROXY:-direct}" \
        ghcr.io/wailsapp/wails-linux-builder:latest \
        bash -c '
            set -e
            # amd64
            echo "▶  Linux amd64..."
            wails build -platform linux/amd64 -clean -o HiKit-linux-amd64
            cd build/bin
            tar -czf ../../dist/'"${APP_NAME}-${VERSION}"'-linux-amd64.tar.gz HiKit-linux-amd64
            cd ../..

            # arm64
            echo "▶  Linux arm64..."
            wails build -platform linux/arm64 -clean -o HiKit-linux-arm64
            cd build/bin
            tar -czf ../../dist/'"${APP_NAME}-${VERSION}"'-linux-arm64.tar.gz HiKit-linux-arm64
            cd ../..
        '
    ok "Linux → ${DIST}/${APP_NAME}-${VERSION}-linux-*.tar.gz"
}

# ── Windows (via Docker + mingw) ───────────────────────────
build_windows() {
    if ! command -v docker &>/dev/null; then
        warn "未找到 Docker，跳过 Windows 构建"
        return
    fi
    log "构建 Windows (amd64) via Docker..."

    docker run --rm \
        -v "$(pwd):/app" \
        -w /app \
        -e GOPROXY="${GOPROXY:-direct}" \
        ghcr.io/wailsapp/wails-cross-windows:latest \
        bash -c '
            set -e
            echo "▶  Windows amd64..."
            wails build -platform windows/amd64 -clean -o HiKit-windows-amd64.exe
            cd build/bin
            zip -r ../../dist/'"${APP_NAME}-${VERSION}"'-windows-amd64.zip HiKit-windows-amd64.exe
            cd ../..
        '
    ok "Windows → ${DIST}/${APP_NAME}-${VERSION}-windows-amd64.zip"
}

# ── 主流程 ──────────────────────────────────────────────────
TARGET="${1:-all}"

check_deps

echo ""
echo "================================================"
echo "  HiKit 构建  版本: ${VERSION}"
echo "================================================"
echo ""

case "$TARGET" in
    darwin|macos)
        build_darwin_amd64
        build_darwin_arm64
        ;;
    linux)
        build_linux
        ;;
    windows|win)
        build_windows
        ;;
    all|*)
        build_darwin_amd64
        build_darwin_arm64
        build_linux
        build_windows
        ;;
esac

echo ""
echo "================================================"
echo "  构建完成，输出目录: ${DIST}/"
ls -lh "${DIST}/" 2>/dev/null || true
echo "================================================"
