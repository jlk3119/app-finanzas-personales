# Mantenimiento y automatización

Este documento resume qué tareas de mantenimiento están automatizadas y cómo
operarlas. Pensado para no requerir conocimientos profundos de software.

---

## 1. CI — verificación automática en cada cambio

Archivo: `.github/workflows/ci.yml`

Cada vez que se sube un cambio a `main` o se abre un Pull Request, GitHub ejecuta
automáticamente, en este orden:

1. `npm run type-check` — verifica que no haya errores de tipos.
2. `npm run lint` — verifica el estilo y reglas de código.
3. `npm test` — corre los 209 tests unitarios.
4. `npm run build` — confirma que la app compila para producción.

Si algo falla, el PR queda marcado en rojo ❌ y **no deberías mergearlo** hasta
arreglarlo. Si todo pasa, aparece en verde ✅.

> Las claves reales de Supabase/IA **no** están en el CI: el build usa valores
> ficticios porque no se conecta a servicios. Las claves reales viven en Vercel.

---

## 2. Pre-commit — revisión antes de cada commit

Archivos: `.husky/pre-commit` + config `lint-staged` en `package.json`

Antes de cada `git commit`, se corre `eslint --fix` **solo sobre los archivos que
modificaste**. Corrige automáticamente lo que pueda y bloquea el commit si queda
algún error. Es rápido porque no revisa todo el proyecto, solo lo tocado.

Para saltarlo en un caso puntual (no recomendado): `git commit --no-verify`.

---

## 3. Dependabot — actualización de dependencias

Archivo: `.github/dependabot.yml`

Cada lunes, Dependabot revisa si hay versiones nuevas de las librerías y abre
Pull Requests automáticos:

- Las actualizaciones menores y parches se agrupan en un solo PR.
- Las GitHub Actions también se mantienen al día.

Tu flujo: revisar que el CI del PR esté en verde y mergear. Si algo se rompe, el
CI lo detecta antes de llegar a producción.

---

## 4. Despliegue (ya existía)

Vercel despliega automáticamente:

- Cada push a `main` → producción (`appfinanzaspersonales.vercel.app`).
- Cada PR → una URL de vista previa para probar antes de mergear.

---

## Siguiente paso pendiente: E2E nocturno

Los tests E2E (Playwright, carpeta `e2e/`) necesitan un servidor corriendo y una
base de datos Supabase **de pruebas** (no la de producción, para no ensuciar datos
reales). Para automatizarlos haría falta:

1. Crear un proyecto Supabase aparte solo para pruebas.
2. Guardar sus credenciales como *secrets* en GitHub.
3. Añadir un workflow programado (`schedule: cron`) que los corra una vez al día.

Mientras tanto, se pueden correr a mano antes de un cambio grande:

```bash
npm run test:e2e
```
