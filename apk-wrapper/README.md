# MisFinanzas — APK (wrapper Capacitor)

Empaqueta la PWA **MisFinanzas** (desplegada en Vercel) como un APK Android
mediante un WebView de Capacitor que carga la URL en vivo. Cada vez que abres
la app cargas la última versión desplegada.

- **appId:** `app.misfinanzas.wrapper`
- **URL que carga:** `https://appfinanzaspersonales.vercel.app` (ver `capacitor.config.ts`)
- **Android mínimo:** 6.0 (API 23)

---

## 🔑 DATOS CRÍTICOS — NO PERDER

| Archivo | Qué es | ¿En git? | ¿Por qué es crítico? |
|---|---|---|---|
| `misfinanzas.keystore` | Clave de firma del APK | ❌ NO | **Irrecuperable.** Sin la *misma* clave no puedes publicar actualizaciones: Android las rechaza por firma distinta y el usuario tendría que desinstalar/reinstalar (perdiendo el estado local de la app). |
| `keystore.properties` | Contraseñas y alias de la clave | ❌ NO | Necesario para firmar. |

**Datos de la firma actual:**

- Alias: `misfinanzas`
- Contraseña (store y key): `MisFinanzas2026`
- Validez: 10.000 días
- Huella SHA-256: `91:FE:8C:D5:0D:A2:80:B5:26:0B:D1:21:FD:74:8B:9F:5E:D5:97:7B:23:7A:E2:97:3F:80:10:B7:A4:19:2E:9C`

> ⚠️ **Haz copia de seguridad de `misfinanzas.keystore` y `keystore.properties`
> en un lugar seguro fuera de este equipo** (gestor de contraseñas, Drive privado, etc.).
> Si pierdes el keystore, pierdes la capacidad de actualizar esta app con la misma identidad.

La huella SHA-256 también sirve si algún día migras a un **TWA** (Trusted Web
Activity): se pone en `/.well-known/assetlinks.json` del sitio para que la app
abra a pantalla completa sin barra de URL.

---

## Requisitos del entorno de build

Instalados a nivel de usuario (sin sudo) en este equipo:

| Herramienta | Versión | Ruta por defecto |
|---|---|---|
| Node.js | 24.x (vía nvm) | `~/.nvm` |
| JDK | **21** (obligatorio para Capacitor 7) | `~/android-build/jdk21` |
| Android SDK | platform 35, build-tools 35.0.0, platform-tools | `~/android-build/sdk` |

Si reinstalas en otra máquina, exporta `JDK_HOME` y `ANDROID_SDK` apuntando a
tus rutas y el script de build los usará.

---

## Compilar (un solo comando)

```bash
./build-apk.sh
```

Genera `dist/MisFinanzas-<versionName>.apk` ya **firmado y verificado**.

El script: carga node/JDK/SDK → `npm install` (si falta) → `cap sync` →
`gradlew assembleRelease` (firma con `keystore.properties`) → copia a `dist/` →
verifica la firma.

---

## Publicar una nueva versión

1. (Opcional) Cambia la URL o ajustes en `capacitor.config.ts`.
2. Sube `versionCode` (entero, +1) y `versionName` en `version.properties`:
   ```properties
   versionCode=2
   versionName=1.1
   ```
3. `./build-apk.sh`
4. Instala el nuevo APK encima del anterior (misma firma → actualiza sin desinstalar).

> Como la app es un WebView que carga Vercel, para cambios de la **app web** NO
> necesitas un APK nuevo: basta con desplegar en Vercel. Solo necesitas recompilar
> el APK si cambias el icono, el nombre, la URL o la configuración nativa.

---

## Regenerar iconos / splash

Las imágenes fuente están en `assets/`. Para regenerarlas:

```bash
npx @capacitor/assets generate --android \
  --iconBackgroundColor '#6d28d9' --splashBackgroundColor '#6d28d9'
```

---

## Estructura

```
apk-wrapper/
  capacitor.config.ts     # appId, nombre, URL en vivo
  version.properties      # versionCode / versionName (editar para releases)
  keystore.properties     # SECRETO (no git) — firma
  misfinanzas.keystore    # SECRETO (no git) — clave
  build-apk.sh            # build reproducible y firmado
  assets/                 # iconos/splash fuente
  www/                    # fallback mínimo (la app real vive en Vercel)
  android/                # proyecto nativo (Gradle)
  dist/                   # APKs generados (no git)
```
