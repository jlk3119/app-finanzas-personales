#!/usr/bin/env bash
#
# build-apk.sh — Compila y firma MisFinanzas.apk de forma reproducible.
#
# Uso:
#   ./build-apk.sh
#
# Variables de entorno opcionales (si tus herramientas están en otra ruta):
#   JDK_HOME       -> JDK 21 (por defecto: $HOME/android-build/jdk21)
#   ANDROID_SDK    -> Android SDK (por defecto: $HOME/android-build/sdk)
#   BUILD_TOOLS    -> versión de build-tools (por defecto: 35.0.0)
#
set -euo pipefail
cd "$(dirname "$0")"
WRAPPER_DIR="$(pwd)"

JDK_HOME="${JDK_HOME:-$HOME/android-build/jdk21}"
ANDROID_SDK="${ANDROID_SDK:-$HOME/android-build/sdk}"
BUILD_TOOLS="${BUILD_TOOLS:-35.0.0}"

# --- Comprobaciones ---
[ -x "$JDK_HOME/bin/java" ] || { echo "ERROR: JDK 21 no encontrado en $JDK_HOME (define JDK_HOME)"; exit 1; }
[ -d "$ANDROID_SDK/platforms" ] || { echo "ERROR: Android SDK no encontrado en $ANDROID_SDK (define ANDROID_SDK)"; exit 1; }
[ -f keystore.properties ] || { echo "ERROR: falta keystore.properties (restáuralo desde tu backup; ver README)"; exit 1; }
[ -f misfinanzas.keystore ] || { echo "ERROR: falta misfinanzas.keystore (restáuralo desde tu backup; ver README)"; exit 1; }

export JAVA_HOME="$JDK_HOME"
export ANDROID_HOME="$ANDROID_SDK"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

# --- Node/npm vía nvm si está disponible ---
if ! command -v npm >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use default >/dev/null 2>&1 || true
fi
command -v npm >/dev/null 2>&1 || { echo "ERROR: npm no disponible"; exit 1; }

VERSION_NAME="$(grep '^versionName=' version.properties | cut -d= -f2)"
echo "==> Compilando MisFinanzas v${VERSION_NAME}"

# --- SDK path para Gradle (machine-specific) ---
echo "sdk.dir=$ANDROID_SDK" > android/local.properties

# --- Dependencias y sincronización web -> nativo ---
[ -d node_modules ] || npm install
npx cap sync android

# --- Build firmado (la firma sale de keystore.properties via build.gradle) ---
( cd android && ./gradlew assembleRelease --no-daemon )

# --- Salida ---
mkdir -p dist
SRC="android/app/build/outputs/apk/release/app-release.apk"
[ -f "$SRC" ] || SRC="android/app/build/outputs/apk/release/app-release-unsigned.apk"
OUT="dist/MisFinanzas-${VERSION_NAME}.apk"
cp "$SRC" "$OUT"

# --- Verificación de firma ---
"$ANDROID_SDK/build-tools/$BUILD_TOOLS/apksigner" verify --print-certs "$OUT" >/dev/null 2>&1 \
  && echo "==> Firma verificada OK" \
  || echo "==> ADVERTENCIA: el APK no quedó firmado (revisa keystore.properties)"

echo "==> Listo: $WRAPPER_DIR/$OUT"
