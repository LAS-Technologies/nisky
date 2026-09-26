# AGENTS.md - Nisky

Lee este archivo antes de modificar el proyecto.

## Stack y reglas fijas

- Backend: Bun 1.3.x, Express 5, TypeScript estricto, Prisma 7, PostgreSQL.
- Frontend: Next.js 16 App Router, React 19, Tailwind CSS 4, shadcn/ui.
- Prisma usa `@prisma/adapter-pg`; el cliente se importa desde el output generado.
- Next.js 16 usa `proxy.ts`; no crear `middleware.ts`.
- Zod 4 usa `z.email(...)`.
- No guardar access tokens en `localStorage` ni `sessionStorage`.
- Access token en memoria; refresh token en cookie `httpOnly` y hash en base de datos.
- Todo dato de negocio debe estar aislado por `userId`.
- Design system Serene Cadence: superficies claras azuladas, tipografía Plus Jakarta Sans + Inter, radios suaves y sombras sutiles.
- Referencia visual oficial: Propuesta 04 de Figma, página «Diseño oficial · Nisky». Seguir el plan por módulos y el estado de implementación en `docs/design-official.md`; conservar la firma LAS abajo a la izquierda.
- No añadir secretos a Git.

## Comandos

```bash
docker compose up -d
cd apps/backend && bun install
bun run db:migrate -- --name init
bun run db:seed
bun run dev
```

El fallback de Moodle usa un venv Python local al repo (portable):

```bash
cd apps/backend && scripts/setup_moodle.sh
```

Crea `scripts/.venv` e instala `curl_cffi`. El cliente primario es `wreq-js`; si falla el transporte o su módulo nativo no carga, el backend usa este fallback. Se puede sobreescribir con `MOODLE_PYTHON_BIN` / `MOODLE_PYTHON_SCRIPT`.

En otra terminal:

```bash
cd apps/frontend
bun install
bun run dev
```

Verificación:

```bash
cd apps/backend && bun run typecheck
cd ../frontend && bun run build
```

## Arquitectura backend

Cada módulo vive en `src/modules/<module>/` y separa `routes`, `controller`, `service` y `validator`. Las rutas validan entrada y aplican middleware de autorización. Los servicios contienen las reglas de negocio y siempre reciben el `userId` autenticado cuando manipulan datos scoped.

## Auth

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register` cuando `PUBLIC_SIGNUP=true`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

El access JWT dura 15 minutos. El refresh dura 7 días, rota en cada uso, se revoca al cerrar sesión y se limita a cinco sesiones activas por usuario. La cookie usa `Path=/` para que el `proxy.ts` de Next.js pueda detectar la sesión antes de renderizar.

## Cambios y verificación

Usa `apply_patch` para editar. No reviertas cambios ajenos. Después de modificar código, ejecuta typecheck/build relevantes. Antes de considerar Fase 0 terminada, prueba health, login, refresh, `/me`, logout y registro.
