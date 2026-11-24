# SF MOTOS — Guía de despliegue

Arquitectura en producción: **SPA (Vite/React) en Cloudflare Pages** → **API Express en Vercel** → **PostgreSQL (Neon)**.

> Estado verificado el 20/11/2026: infraestructura propia de SF MOTOS configurada y funcionando. **Este archivo no contiene secretos.**

---

## 1. Producción

| Capa | Plataforma | Proyecto | URL |
| --- | --- | --- | --- |
| Repositorio | GitHub | `juanagustinml10/sf-motos` (público) | https://github.com/juanagustinml10/sf-motos |
| Frontend | Cloudflare Pages | `sf-motos` (rama `main`) | https://sf-motos.pages.dev |
| Backend | Vercel | `sf-motos` (cuenta `agustinmolina17`) | https://sf-motos-livid.vercel.app |
| Base de datos | Neon | proyecto configurado en Vercel | (solo cadenas Secret) |

Cloudflare Pages y Vercel despliegan automáticamente cada push a `main`. El frontend apunta a la API de Vercel mediante el fallback productivo en `frontend/src/lib/api.ts`; no hace falta definir `VITE_API_BASE_URL` en Pages.

### Verificación actual

```text
GET  https://sf-motos-livid.vercel.app/health            -> 200 {"ok":true,"service":"sfmotos-backend","db":"ok"}
GET  https://sf-motos-livid.vercel.app/api/bikes         -> 200 {"data":[],"meta":{...}}
GET  https://sf-motos-livid.vercel.app/api/bikes/brands  -> 200 []
POST https://sf-motos-livid.vercel.app/api/auth/login    -> 200 { accessToken, refreshToken }
GET  https://sf-motos.pages.dev                          -> 200 SPA de SF MOTOS
```

Las listas están vacías porque **todavía no se cargaron motocicletas**. Eso es un estado de datos, no un error de API.

---

## 2. Backend (Vercel)

`vercel.json` en la raíz define los servicios `backend` y `frontend` y los rewrites de `/health`, `/api/(.*)` y el catch-all. `backend/src/index.ts` exporta el app y evita `app.listen()` cuando `VERCEL=1`.

Build del backend: `prisma generate && tsc --noEmit` (el runtime usa `tsx`, no compila a `dist/`).

### Variables de entorno (production)

| Variable | Estado / valor |
| --- | --- |
| `DATABASE_URL` | Secret de Neon (pooled, hostname `-pooler`) |
| `DATABASE_URL_UNPOOLED` | Secret de Neon (directo, sin `-pooler`) |
| `JWT_ACCESS_SECRET` | Secret aleatorio, propio de SF MOTOS |
| `JWT_REFRESH_SECRET` | Secret aleatorio, distinto del anterior |
| `JWT_ACCESS_TTL` | `900` |
| `JWT_REFRESH_TTL` | `604800` |
| `CORS_ORIGIN` | `https://sf-motos.pages.dev,https://sf-motos-livid.vercel.app` |
| `PUBLIC_BASE_URL` | `https://sf-motos-livid.vercel.app` |
| `STORAGE_DRIVER` | `db` (fotos en Neon; sin disco efímero) |
| `MAX_FILE_SIZE` | `4194304` |

Comandos útiles:

```bash
vercel env ls --project sf-motos
vercel env add NOMBRE --project sf-motos --environment production --value VALOR --yes --force
vercel logs --deployment <url-del-deploy>
vercel --prod --yes            # redeploy manual desde el working tree
```

### Almacenamiento de fotos

Con `STORAGE_DRIVER=db` los bytes se guardan en `BikeImage.data` (BYTEA) y se sirven por `GET /api/images/:key`. No requiere credenciales S3. `PUBLIC_BASE_URL` debe ser HTTPS y público: se usa para construir `BikeImage.url`.

#### Optimización con Sharp (21/11/2026)

- El original **nunca se guarda**: Multer lo recibe en memoria y Sharp lo convierte a WebP calidad 82 (`effort: 4`), con `.rotate()` para aplicar EXIF antes de redimensionar. El WebP resultante no conserva EXIF.
- Salida full `≤1600x1600` y miniatura `≤500x500`, ambas con `fit: inside` y `withoutEnlargement` (no agrandan fotos chicas).
- Se aceptan JPG, PNG y WebP de entrada; límite de 4 MB por archivo y guardia de 100 MP contra bombas de descompresión.
- Columnas nuevas en `BikeImage`: `thumbnailData`, `thumbnailMimeType`, `thumbnailSizeBytes`, `thumbnailChecksum`, `width`, `height` (todas nullable; las fotos antiguas siguen funcionando con fallback a la imagen completa).
- `GET /api/images/:key?variant=thumb` sirve la miniatura; si la fila es legacy, cae a la imagen full. Las respuestas siguen siendo `Cache-Control: public, max-age=31536000, immutable`.
- Máximo **10 fotos por publicación**, deduplicadas por checksum SHA-256 de la imagen optimizada. Los duplicados dentro de un lote se descartan sin error.
- La subida es **de a un archivo por request** (body limit de Vercel ~4.5 MB); el frontend itera en el servicio.
- Desde el celular (24/11/2026) el panel **comprime cada foto antes de enviarla** (`frontend/src/lib/image-upload.ts`): reescribe a JPG de hasta 1600 px / calidad 82, convierte HEIC/HEIF cuando el navegador puede decodificarlos y deja intactos los JPG/PNG/WebP de hasta 1,5 MB. Motivo: los 413 repetidos en `POST /api/bikes/:id/images` eran fotos de teléfono por encima del límite del body. El formulario muestra el error concreto (tamaño, validación, sesión vencida o conexión) en vez del genérico "Revisá los datos", y si falla una foto después de crear la moto se queda en edición para reintentar sin duplicarla. Además, una moto nueva con fotos pendientes se crea como borrador y recién pasa al estado elegido cuando todas las imágenes subieron, para que no quede visible en el catálogo sin fotos.
- Al borrar una foto o una moto se eliminan los binarios. En `db` los bytes van con la fila por `ON DELETE CASCADE`; en local/S3 se borran el full y el `-thumb.webp`.
- Nota: por el caché `immutable` del CDN, una URL ya visitada puede seguir respondiendo desde caché unos minutos tras borrar su fila. No afecta la BD ni a los listados.

---

## 3. Frontend (Cloudflare Pages)

- Root directory: `frontend` · Framework: Vite · Build: `npm run build` · Output: `dist`.
- Proyecto: `sf-motos`, cuenta `38903a9d035a6f38fbf883173b296d6e`.
- Dominio: `https://sf-motos.pages.dev`.
- `frontend/public/_redirects` contiene `/* /index.html 200` para que las rutas profundas recarguen sin 404.
- No hay secretos en el bundle: la única URL inyectada es la pública de la API.

---

## 4. Base de datos y migraciones

Migraciones versionadas en `backend/prisma/migrations`, **ya aplicadas en Neon y registradas en `_prisma_migrations`**:

- `20261116000000_init`
- `20261117000000_add_usage_hours_draft`
- `20261119000000_add_image_blobs`
- `20261121000000_optimize_images`
- `20261121010000_add_bike_usage`
- `20261124190000_price_optional` (24/11/2026: `Bike.price` ahora es nullable; las publicaciones existentes conservan su precio)

Para una base nueva, ejecutar una sola vez con las cadenas directas disponibles:

```bash
cd backend
npx prisma migrate deploy   # usa DATABASE_URL_UNPOOLED
```

Nunca `db push` ni reiniciar el historial de migraciones.

### Usuario administrador

Existe un usuario `ADMIN` creado en Neon. Sus credenciales **no se versionan**; se entregaron fuera del repositorio. El panel está en `https://sf-motos.pages.dev/admin`. El registro público de administradores no existe (el alta es solo por seed/insercion controlada). Si se pierden las credenciales, crear otro admin con `backend/prisma/seed.ts` definiendo `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` localmente y ejecutando `npm run prisma:seed` **una sola vez**.

### Campos opcionales de una publicación

Desde el 24/11/2026 el precio, el kilometraje y las horas de uso son opcionales en el panel y en la API. `price = null` se muestra como **"Precio a consultar"** en tarjetas, ficha y comparador; `mileageKm = null` se muestra como **"Sin dato"** en motos usadas (las 0 km siguen mostrando "0 km"). Los filtros por rango de precio siguen aplicando solo a motos con precio cargado y el orden por precio las coloca al final.

### Marcas

El desplegable "Marca" del formulario de publicaciones se popula desde la tabla `Brand` de Neon (también alimenta el filtro del catálogo). Las 9 marcas originales que aparecen en la franja del home son `KTM`, `HUSQVARNA`, `GASGAS`, `BETA`, `SHERCO`, `HONDA`, `YAMAHA`, `KAWASAKI` y `SUZUKI`. El 24/11/2026 se agregó `MORINI` (id `cmwux4ssasnr991c98348a766`, slug `morini`) para el desplegable; la franja del home sigue mostrando las 9 marcas originales. Los IDs son `cuid` válidos para la validación del formulario. Para agregar otra marca hace falta insertarla en `Brand` (no hay alta pública ni endpoint de administración de marcas).

---

## 5. Seguridad y operación

- `.env`, `.env.*` (incluido `.env.production`) están ignorados; solo se versionan `.env.example`.
- El endpoint temporal `/__sql` usado para aplicar migraciones fue **eliminado del código y del runtime**, y su variable `MIGRATE_KEY` fue borrada de Vercel.
- Las sesiones usan JWT access + refresh con rotación y filas en `Session`. Los tokens viven en `localStorage`: migrarlos a cookies `HttpOnly`/`Secure` es una mejora pendiente.
- No hay rate limiting en `/api/auth/login`: recomendable antes de exponer demasiado el panel.
- Rotación de secretos JWT: generar valores nuevos, actualizarlos en Vercel y redesplegar. Esto invalida las sesiones activas.
- Antes de dar por terminado un cambio: `npm run build` en la raíz, `npx tsc --noEmit -p tsconfig.app.json` y `npm run lint` en `frontend`.
