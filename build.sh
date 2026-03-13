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
# 去掉 -dirty 后缀，保持版本号干净
VERSION="${VERSION:-$(git describe --tags --always 2>/dev/null | sed 's/-dirty//' || echo 'dev')}"
DIST="dist"
MUSIC_DL_REPO="github.com/guohuiyuan/go-music-dl/cmd/music-dl"
MUSIC_DL_BUILD="${DIST}/.music-dl-cache"

mkdir -p "$DIST" "$MUSIC_DL_BUILD"

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

# ── 交叉编译 go-music-dl ────────────────────────────────────
# 用法: bundle_music_dl <GOOS> <GOARCH> <output_path>
bundle_music_dl() {
    local target_os="$1" target_arch="$2" output="$3"
    local bin_name="go-music-dl"
    [[ "$target_os" == "windows" ]] && bin_name="go-music-dl.exe"

    local cache_bin="${MUSIC_DL_BUILD}/${target_os}-${target_arch}/${bin_name}"

    if [[ -f "$cache_bin" ]]; then
        log "使用缓存的 go-music-dl (${target_os}/${target_arch})"
    else
        log "交叉编译 go-music-dl (${target_os}/${target_arch})..."
        mkdir -p "$(dirname "$cache_bin")"
        GOOS="$target_os" GOARCH="$target_arch" CGO_ENABLED=0 \
            go build -trimpath -ldflags="-s -w" \
            -o "$cache_bin" "${MUSIC_DL_REPO}@latest" 2>/dev/null \
        || GOOS="$target_os" GOARCH="$target_arch" CGO_ENABLED=0 \
            go install -trimpath -ldflags="-s -w" "${MUSIC_DL_REPO}@latest" 2>/dev/null

        # go install puts binary named 'music-dl' in GOPATH/bin/GOOS_GOARCH/
        if [[ ! -f "$cache_bin" ]]; then
            local gopath
            gopath=$(go env GOPATH)
            # Try cross-compile path first, then native path
            local src_name="music-dl"
            [[ "$target_os" == "windows" ]] && src_name="music-dl.exe"
            local installed="${gopath}/bin/${target_os}_${target_arch}/${src_name}"
            [[ ! -f "$installed" ]] && installed="${gopath}/bin/${src_name}"
            if [[ -f "$installed" ]]; then
                cp "$installed" "$cache_bin"
            else
                warn "go-music-dl 编译失败 (${target_os}/${target_arch})，跳过打包"
                return 1
            fi
        fi
    fi

    cp "$cache_bin" "$output"
    chmod +x "$output"
    ok "go-music-dl 已打包 → $output"
}

# ── macOS amd64 ─────────────────────────────────────────────
build_darwin_amd64() {
    log "构建 macOS (amd64)..."
    # 不用 -clean，避免删除 wails.json；手动清理 bin
    rm -rf build/bin && mkdir -p build/bin
    wails build -platform darwin/amd64
    # wails 在 macOS 下输出 <appname>.app（小写 wails.json name 字段）
    local app_file
    app_file=$(ls -d build/bin/*.app 2>/dev/null | head -1)
    # Bundle go-music-dl into .app
    if [[ -n "$app_file" ]]; then
        bundle_music_dl darwin amd64 "${app_file}/Contents/MacOS/go-music-dl" || true
    fi
    if [[ -z "$app_file" ]]; then
        # fallback: 找第一个文件
        app_file=$(ls build/bin/ | head -1)
        cd build/bin && zip -r "../../${DIST}/${APP_NAME}-${VERSION}-macos-amd64.zip" "$app_file" && cd ../..
    else
        local app_name
        app_name=$(basename "$app_file")
        cd build/bin && zip -r "../../${DIST}/${APP_NAME}-${VERSION}-macos-amd64.zip" "$app_name" && cd ../..
    fi
    ok "macOS amd64 → ${DIST}/${APP_NAME}-${VERSION}-macos-amd64.zip"
}

# ── macOS arm64 (Apple Silicon) ────────────────────────────
build_darwin_arm64() {
    log "构建 macOS (arm64)..."
    rm -rf build/bin && mkdir -p build/bin
    wails build -platform darwin/arm64
    local app_file
    app_file=$(ls -d build/bin/*.app 2>/dev/null | head -1)
    # Bundle go-music-dl into .app
    if [[ -n "$app_file" ]]; then
        bundle_music_dl darwin arm64 "${app_file}/Contents/MacOS/go-music-dl" || true
    fi
    if [[ -z "$app_file" ]]; then
        local f
        f=$(ls build/bin/ | head -1)
        cd build/bin && zip -r "../../${DIST}/${APP_NAME}-${VERSION}-macos-arm64.zip" "$f" && cd ../..
    else
        local app_name
        app_name=$(basename "$app_file")
        cd build/bin && zip -r "../../${DIST}/${APP_NAME}-${VERSION}-macos-arm64.zip" "$app_name" && cd ../..
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

    docker run --rm \
        -v "$(pwd):/app" \
        -w /app \
        -e GOPROXY="${GOPROXY:-direct}" \
        ghcr.io/wailsapp/wails-linux-builder:latest \
        bash -c '
            set -e
            echo "▶  Linux amd64..."
            wails build -platform linux/amd64 -o HiKit-linux-amd64
            cd build/bin
            tar -czf ../../dist/'"${APP_NAME}-${VERSION}"'-linux-amd64.tar.gz HiKit-linux-amd64
            cd ../..

            echo "▶  Linux arm64..."
            wails build -platform linux/arm64 -o HiKit-linux-arm64
            cd build/bin
            tar -czf ../../dist/'"${APP_NAME}-${VERSION}"'-linux-arm64.tar.gz HiKit-linux-arm64
            cd ../..
        '
    # Bundle go-music-dl into Linux archives (post-build on host)
    for arch in amd64 arm64; do
        local archive="${DIST}/${APP_NAME}-${VERSION}-linux-${arch}.tar.gz"
        if [[ -f "$archive" ]]; then
            local tmp_dir="${MUSIC_DL_BUILD}/linux-${arch}-repack"
            rm -rf "$tmp_dir" && mkdir -p "$tmp_dir"
            if bundle_music_dl linux "$arch" "${tmp_dir}/go-music-dl"; then
                # Append go-music-dl into existing tar.gz
                tar -czf "$archive" -C "$tmp_dir" go-music-dl --append 2>/dev/null \
                || {
                    # fallback: repack
                    tar -xzf "$archive" -C "$tmp_dir"
                    tar -czf "$archive" -C "$tmp_dir" .
                }
            fi
            rm -rf "$tmp_dir"
        fi
    done
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
            wails build -platform windows/amd64 -o HiKit-windows-amd64.exe
            cd build/bin
            zip -r ../../dist/'"${APP_NAME}-${VERSION}"'-windows-amd64.zip HiKit-windows-amd64.exe
            cd ../..
        '
    # Bundle go-music-dl into Windows zip (post-build on host)
    local win_zip="${DIST}/${APP_NAME}-${VERSION}-windows-amd64.zip"
    if [[ -f "$win_zip" ]]; then
        local tmp_dir="${MUSIC_DL_BUILD}/windows-amd64-repack"
        rm -rf "$tmp_dir" && mkdir -p "$tmp_dir"
        if bundle_music_dl windows amd64 "${tmp_dir}/go-music-dl.exe"; then
            # Add go-music-dl.exe into existing zip
            cd "$tmp_dir" && zip -g "$(cd - >/dev/null && pwd)/${win_zip}" go-music-dl.exe && cd - >/dev/null
        fi
        rm -rf "$tmp_dir"
    fi
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
