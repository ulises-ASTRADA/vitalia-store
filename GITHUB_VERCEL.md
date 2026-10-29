# GitHub y Vercel para Vitalia

Cuenta de proyectos personales: `ulises-ASTRADA`.
Repositorio creado: https://github.com/ulises-ASTRADA/vitalia-store, privado.
Proyecto Vercel existente: `vitalia-store`, del equipo `ulisesastrada1-9233s-projects`.

## Estado actual

El workflow `.github/workflows/ci.yml` está preparado localmente. Ejecuta pruebas, compilación y verificación HTTP con Node.js 24 en pushes y PRs. CI utiliza el catálogo local de prueba y no necesita credenciales de Google o Vercel.

La API de GitHub confirmó la cuenta `ulises-ASTRADA` y creó el repositorio privado el 8 de octubre de 2026. Git local está inicializado en `main`, sin commits ni remoto. La subida sigue pendiente: `git add` falla con `Unable to create .git/index.lock: Operation not permitted` dentro de esta sesión. Se verificó que `.env.local`, `.vercel/`, `node_modules/` y `.next/` estén excluidos.

No se ha conectado el repositorio con Vercel. El conector devuelve 403 al consultar el proyecto existente bajo el equipo `ulisesastrada1-9233s-projects`; la CLI también falla al acceder a la API. No se publicó en producción, no se cambió la protección y no hay una URL de preview nueva.

### Completar la subida desde la Terminal de Mac

Estos comandos corresponden al estado actual: repositorio local sin commits ni remoto y repositorio remoto vacío. No usar `--force`.

```bash
cd /Users/ulises/Desktop/projects/ecom-mily/vitalia-store
gh api user --jq .login
git remote add origin https://github.com/ulises-ASTRADA/vitalia-store.git
git add .
git diff --cached --check
git diff --cached --stat
git commit -m "feat: checkout actualizado y boxes Vitalia con CI"
gh auth setup-git --hostname github.com
git push -u origin main
```

Antes de confirmar, revisar el resumen de archivos y comprobar que no incluya secretos ni carpetas generadas. Si falla un comando, detenerse y revisar el error. Subir a GitHub no publica en Vercel mientras el proyecto siga sin esa conexión.

## Configuración única

1. Autenticar la cuenta `ulises-ASTRADA` en la conexión de GitHub usada por el agente. Si se usa la CLI local, seleccionar esa cuenta y verificar que `gh api user --jq .login` devuelva exactamente `ulises-ASTRADA`. No compartir tokens en el chat.
2. Inicializar Git en esta carpeta y conectar el repositorio existente o crear el repositorio privado si no existe. Antes del primer commit, comprobar que `.env*`, `.vercel/`, `node_modules/` y `.next/` estén excluidos. Revisar los archivos preparados antes de subir.
3. Desde Settings → Git del proyecto Vercel **existente**, conectar `ulises-ASTRADA/vitalia-store`. No importar un segundo proyecto ni cambiar dominios.
4. Configurar las variables siguientes para **Preview** en Vercel, porque los parámetros del script `deploy:prueba` no se aplican automáticamente a los despliegues desde Git:

| Variable | Valor público |
| --- | --- |
| PREVIEW_MODE | false |
| ALLOW_TEST_CHECKOUT | true |
| WHATSAPP_NUMBER | 5493513947394 |
| STORE_NAME | Vitalia |
| STORE_CURRENCY | ARS |
| GOOGLE_SHEETS_ID | 1A91ud3m6bhslJ8EA8yIOSob62Sri2I9UOXZxtcBzi84 |
| GOOGLE_SHEETS_PUBLIC | true |
| GOOGLE_SHEETS_TAB | Productos |

Framework: Next.js. Node.js: 24.x. Build Command: `npm run build`. Root Directory: raíz del repositorio si contiene esta carpeta completa. Sin override de Output Directory.

5. Mantener la protección de acceso. La conexión debe verificarse sin desplegar a la rama configurada como Production Branch. No habilitar publicaciones automáticas de producción ni hacer merge a esa rama sin autorización.
6. Configurar el check «Pruebas y compilación» como requisito antes de mergear, cuando el plan y las reglas del repositorio lo permitan. Vercel puede construir la preview en paralelo a las pruebas; un workflow aprobado no bloquea por sí solo un despliegue de producción.

## Trabajo habitual

Crear una rama de trabajo → realizar cambios → commit → push → abrir PR → revisar pruebas y URL de preview.

Un commit solo local no dispara el despliegue. La integración de Vercel despliega los pushes a las ramas conectadas y muestra la URL en el PR. Los pushes/merges a la Production Branch publican en producción, por lo que se deben mantener fuera del flujo actual de previews.

Esta integración evita depender de la CLI de Vercel local. No cambia el sandbox del agente ni elimina el bloqueo local `listen EPERM`; los servidores de GitHub y Vercel realizan las verificaciones y builds remotos. Tampoco elimina la necesidad de acceso del agente al repositorio para subir los commits.

Documentación oficial: https://vercel.com/docs/git/vercel-for-github y https://vercel.com/docs/environment-variables.
