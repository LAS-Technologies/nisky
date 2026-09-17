# Nisky MCP Server

Servidor MCP (Model Context Protocol) que expone la agenda, proyectos, tareas, notas rápidas y knowledge de Nisky a asistentes de IA (opencode, Claude Desktop, etc.).

```
[ChatGPT] --OAuth 2.1 + PKCE--> [Nisky Authorization Server]
    |                                  |
    +--Bearer OAuth token--> [este servidor] --Bearer OAuth token--> [Nisky backend]
[OpenCode/Claude] --Bearer PAT--> [este servidor] --Bearer PAT--> [Nisky backend]
```

El servidor es stateless: no guarda tokens ni estado de sesión. Acepta PAT para clientes manuales y access tokens OAuth opacos para clientes con login, y reenvía la credencial al backend, que valida, aplica scopes y aísla los datos por `userId`.

## OAuth para ChatGPT

El endpoint publica `/.well-known/oauth-protected-resource` y devuelve un challenge OAuth cuando falta el bearer token. Configura el Authorization Server con `OAUTH_ISSUER_URL`; su discovery debe estar disponible en `/.well-known/oauth-authorization-server`. El flujo usa Authorization Code, PKCE `S256`, CIMD o Dynamic Client Registration, códigos de un solo uso y refresh-token rotation.

ChatGPT debe conectarse solamente a:

```text
https://<tu-host>/mcp
```

Para la instancia pública de Nisky, la URL de conexión OAuth es:

```text
https://mcp-nisky.las.do/mcp
```

No introduzcas un PAT en ChatGPT. Al detectar el challenge, ChatGPT abrirá el login y consentimiento de Nisky.

## Tools disponibles (22)

| Tool | Descripción |
|---|---|
| `get-home-overview` | Resumen del día y progreso semanal |
| `list-task-schedule` | Lista tareas asignadas a bloques en un intervalo |
| `schedule-task` | Asigna una tarea a un bloque y fecha |
| `list-projects` | Lista los proyectos del usuario |
| `create-project` | Crea un proyecto (máx. 20, nombre único) |
| `update-project` | Actualiza los datos del proyecto |
| `list-timeblocks` | Lista bloques de tiempo |
| `get-timeblock-active` | Bloque activo ahora |
| `get-timeblocks-today` | Bloques que aplican hoy |
| `create-timeblock` | Crea un bloque semanal o puntual (valida solapes) |
| `update-timeblock` | Actualiza un bloque |
| `list-tasks` | Lista tareas con filtros y paginación |
| `get-task` | Obtiene una tarea por id |
| `create-task` | Crea una tarea |
| `update-task` | Actualiza una tarea |
| `list-quick-notes` | Lista notas rápidas |
| `create-quick-note` | Captura una nota rápida |
| `update-quick-note` | Edita o archiva una nota rápida |
| `search-knowledge` | Busca notas de knowledge |
| `get-knowledge-note` | Obtiene una nota de knowledge |
| `create-knowledge-note` | Crea una nota de knowledge |
| `update-knowledge-note` | Actualiza una nota de knowledge |

Sin tools de borrado por diseño. Por ahora no se exponen diario, Pomodoro ni hábitos. Las notas rápidas se archivan en lugar de eliminarse.

## Despliegue

### Requisitos

- Docker (para el Dockerfile provisto)
- Una instancia desplegada del backend de Nisky

### Opción 1: Docker

```bash
docker build -f apps/mcp/Dockerfile -t nisky-mcp .
docker run -d -p 8787:8787 \
  -e NISKY_API_URL=https://api.tu-nisky.com/api/v1 \
  -e MCP_HOST=0.0.0.0 \
  -e MCP_ALLOWED_HOSTS=mcp.tu-dominio.com \
  -e MCP_ALLOWED_ORIGINS=mcp.tu-dominio.com,chatgpt.com,gemini.google.com \
  --name nisky-mcp nisky-mcp
```

### Opción 2: local (dev)

```bash
cd apps/mcp
bun install
NISKY_API_URL=http://localhost:4000/api/v1 bun run dev
```

### Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `NISKY_API_URL` | `http://localhost:4000/api/v1` | URL base del backend de Nisky |
| `MCP_PORT` | `8787` | Puerto HTTP del servidor |
| `MCP_HOST` | `0.0.0.0` | Interfaz donde escucha el servidor |
| `MCP_ALLOWED_HOSTS` | `localhost,127.0.0.1,[::1]` | Hostnames permitidos en `Host`, separados por comas |
| `MCP_ALLOWED_ORIGINS` | `localhost,127.0.0.1,[::1],gemini.google.com` | Hostnames permitidos en `Origin`, separados por comas; en producción incluye `chatgpt.com` y `gemini.google.com` |
| `MCP_UPSTREAM_TIMEOUT_MS` | `10000` | Tiempo máximo de espera del backend en milisegundos |
| `RATE_LIMIT_PER_MIN` | `60` | Máximo de peticiones por minuto por credencial en cada instancia |
| `MCP_PUBLIC_URL` | `http://localhost:8787` | URL pública del servidor MCP, sin `/mcp` |
| `OAUTH_ISSUER_URL` | `http://localhost:4000` | URL pública del Authorization Server |
| `OAUTH_SCOPES` | scopes de tareas/proyectos/notas/bloques | Scopes anunciados por el recurso protegido |

Después del despliegue el endpoint MCP queda en `https://<tu-host>/mcp`.

## Uso

### 1. Crear un token de acceso (PAT) para OpenCode o Claude

En la aplicación web de Nisky: **Ajustes → Seguridad → Tokens de acceso → Crear token**.

Copia el token (`nisky_pat_...`). Solo se muestra una vez. Puedes revocarlo en cualquier momento desde esa misma pantalla.

### 2. Configurar el cliente MCP

#### opencode (`opencode.json`)

```json
{
  "mcp": {
    "nisky": {
      "type": "remote",
      "url": "https://<tu-host>/mcp",
      "headers": {
        "Authorization": "Bearer nisky_pat_XXXX"
      }
    }
  }
}
```

#### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "nisky": {
      "url": "https://<tu-host>/mcp",
      "headers": {
        "Authorization": "Bearer nisky_pat_XXXX"
      }
    }
  }
}
```

#### Gemini CLI / Gemini Spark

Gemini CLI puede conectarse con el transporte HTTP de MCP y descubrir OAuth automáticamente:

```bash
gemini mcp add --transport http nisky https://<tu-host>/mcp/
```

Para una conexión con PAT:

```bash
gemini mcp add --transport http --header "Authorization: Bearer nisky_pat_XXXX" nisky https://<tu-host>/mcp/
```

El servidor permite `Origin: https://gemini.google.com` y responde el preflight CORS de MCP. Si tu despliegue reemplaza la configuración de orígenes permitidos, conserva `gemini.google.com` en `MCP_ALLOWED_ORIGINS`.

#### Otros clientes con soporte HTTP (Streamable HTTP)

Configurar la URL del endpoint y el header `Authorization: Bearer <PAT>` como credencial/personalización de cada servidor.

### 3. Conectar ChatGPT (OAuth)

En ChatGPT activa Developer Mode, crea una conexión a `https://mcp-nisky.las.do/mcp` y completa el login/consentimiento en Nisky. Para una instalación propia, sustituye la URL por el host de tu despliegue. La URL del Authorization Server debe coincidir con `OAUTH_ISSUER_URL` del backend y el frontend.

### 4. Probar (opcional)

```bash
curl -X POST https://<tu-host>/mcp \
  -H "Authorization: Bearer nisky_pat_XXXX" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

También puedes listar las tools:

```bash
curl -X POST https://<tu-host>/mcp \
  -H "Authorization: Bearer nisky_pat_XXXX" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

## Seguridad

- El servidor no almacena ningún token ni dato de usuario: la credencial viaja de cliente → servidor → backend y se descarta.
- Cada usuario usa su propio PAT u OAuth token; el backend solo devuelve sus datos (`userId` isolation).
- Rate limit por credencial y proceso: `RATE_LIMIT_PER_MIN` (default 60) con respuesta `429` y header `Retry-After`.
- El endpoint requiere `Authorization: Bearer <PAT|OAuth access token>` en cada petición; la validez y los scopes los confirma el backend.
- Validación de `Host` y `Origin` para reducir ataques de DNS rebinding y CSRF; en producción configura los hostnames públicos permitidos.
- Revocar el PAT en la web invalida el acceso de inmediato, sin tocar el servidor MCP.
- Cambiar la contraseña revoca todos los PATs del usuario.

## Desarrollo

```bash
cd apps/mcp
bun install
bun run typecheck   # tsc --noEmit
bun run test        # bun test
bun run build       # bundle para producción
bun run dev         # bun --watch src/index.ts
```

Estructura:

```
apps/mcp/
├── Dockerfile          # multi-stage: deps → build → runtime
├── src/
│   ├── index.ts        # entrypoint HTTP + transporte Streamable HTTP
│   ├── client.ts       # forwarding y comprobación de scopes OAuth
│   ├── oauth.ts        # metadata del recurso protegido y challenge OAuth
│   ├── ratelimit.ts    # rate limiting in-memory por huella de credencial
│   └── tools/
│       ├── index.ts    # registro de todas las tools
│       ├── agenda.ts
│       ├── knowledge.ts
│       ├── projects.ts
│       ├── quicknotes.ts
│       ├── timeblocks.ts
│       └── tasks.ts
```
