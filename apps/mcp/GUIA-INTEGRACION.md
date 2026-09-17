# Nisky + Tu asistente de IA

¿Te imaginas poder pedirle a tu asistente de IA cosas como *"¿qué tengo pendiente hoy?"* o *"crea un bloque de estudio para mañana"* y que lo haga con tus datos reales de Nisky?

Pues eso es exactamente lo que hace esta guía. Y lo mejor: **toma menos de 5 minutos** y solo necesitas hacerlo **una vez**. Vamos paso a paso, sin prisa.

---

## Qué vas a lograr

Con esto, tu asistente de IA (opencode, Claude Desktop u otro) podrá:

- Ver tus tareas, proyectos y bloques de tiempo
- Ver tu resumen diario y asignar tareas a bloques
- Capturar notas rápidas y archivarlas
- Buscar, crear y actualizar notas de knowledge
- Crear tareas y actualizarlas (ej: marcar una como hecha)
- Ver si tienes un bloque activo ahora mismo

> Tranquilo: el asistente **no puede borrar nada**. Solo lee y crea/edita cosas cuando tú se lo pidas.

---

## Paso 1: Elige cómo conectar

### ChatGPT: conexión OAuth

Si usas ChatGPT con Developer Mode, crea una conexión OAuth a la instancia pública de Nisky usando esta URL:

```text
https://mcp-nisky.las.do/mcp
```

ChatGPT detectará el challenge OAuth, abrirá el login de Nisky y mostrará la pantalla de consentimiento. No copies un PAT en ChatGPT.

OAuth concede acceso con scopes y permite revocar la conexión sin exponer una llave permanente al cliente.

### OpenCode, Claude y otros clientes: PAT

Para clientes que todavía requieren headers manuales, continúa con el siguiente paso.

## Paso 2: Obtén tu llave de acceso (solo si usas PAT)

> Si vas a usar OAuth con ChatGPT o Gemini Spark, no necesitas crear un PAT. Configura directamente `https://mcp-nisky.las.do/mcp` como servidor MCP.

Piensa en esto como una llave especial que le das a tu asistente para que entre a *tu* espacio de Nisky.

1. Entra a tu cuenta de Nisky en el navegador
2. Ve a **Ajustes** (el ícono de engranaje)
3. Entra a la pestaña **Seguridad**
4. Busca la sección **Tokens de acceso**
5. Pídele un nombre, por ejemplo: *"Mi asistente"*
6. Pulsa **Crear token**

Aparecerá una llave larga que empieza con `nisky_pat_...` — **cópiala y guárdala en un lugar seguro**, porque solo se muestra **una vez**. Es como una contraseña: no la compartas con nadie.

> **Tip:** Si algún día sientes que esa llave ya no la necesitas, vuelve a Ajustes → Seguridad y revócala. Simple.

---

## Paso 3: Conecta a tu asistente

Aquí depende de qué herramienta uses. Elige la tuya:

### Si usas opencode

1. Abre (o crea) el archivo `opencode.json` en tu carpeta de configuración
2. Pega esto adentro, reemplazando `TU_LLAVE_SECRETA` por la que copiaste en el paso 1:

```json
{
  "mcp": {
    "nisky": {
      "type": "remote",
      "url": "https://mcp-nisky.las.do/mcp",
      "headers": {
        "Authorization": "Bearer TU_LLAVE_SECRETA"
      }
    }
  }
}
```

3. Guarda el archivo y reinicia opencode

### Si usas Claude Desktop

1. Abre **Claude → Configuración → Desarrollador → Editar configuración**
2. En el archivo `claude_desktop_config.json` pega:

```json
{
  "mcpServers": {
    "nisky": {
      "url": "https://mcp-nisky.las.do/mcp",
      "headers": {
        "Authorization": "Bearer TU_LLAVE_SECRETA"
      }
    }
  }
}
```

3. Guarda y reinicia Claude

### Si usas Gemini CLI o Gemini Spark

Nisky usa el transporte HTTP estándar de MCP y publica el descubrimiento OAuth, por lo que Gemini puede completar la autorización automáticamente:

```bash
gemini mcp add --transport http nisky https://mcp-nisky.las.do/mcp/
```

Si tu instalación requiere un token manual, puedes configurar el header:

```bash
gemini mcp add --transport http --header "Authorization: Bearer TU_LLAVE_SECRETA" nisky https://mcp-nisky.las.do/mcp/
```

Para un cliente web de Gemini Spark, registra la misma URL como servidor MCP remoto. El servidor permite `gemini.google.com` y responde el preflight CORS; si tu despliegue reemplaza la lista de orígenes, conserva ese hostname en `MCP_ALLOWED_ORIGINS`. No guardes el PAT en el repositorio ni en el frontend.

### Si usas otra herramienta

Casi todas las que soportan "servidores MCP por HTTP" funcionan igual: solo necesitas darles la **URL** y el **encabezado de autorización**:

| Dato | Valor |
|---|---|
| **URL** | `https://mcp-nisky.las.do/mcp` |
| **Encabezado** | `Authorization: Bearer TU_LLAVE_SECRETA` |

---

## Paso 4: Pruébalo

Ya conectado, intenta pedirle algo así a tu asistente:

> *"¿Qué tareas tengo pendientes para hoy?"*

o

> *"Lista mis proyectos"*

Si responde con tus datos reales... ¡lo lograste!

---

## Preguntas frecuentes

**¿Es seguro? ¿Mi asistente verá mi contraseña?**
No. Solo usas una llave especial (token) que puedes revocar cuando quieras. Tu contraseña nunca viaja por aquí.

**¿Puede mi asistente borrar mis tareas?**
No, por diseño. Las herramientas de borrado no están disponibles.

**¿Y si me roban la llave?**
Revócala en Ajustes → Seguridad al instante y crea una nueva.

**¿Puedo tener varias llaves?**
Sí. Una para opencode, otra para Claude, etc. Así puedes dar de baja una sin afectar a las demás.

**¿La llave expira?**
Puedes elegir que expire (7, 30, 90 días o un año) o que no expire. Tú decides al crearla.

---

## Para usuarios técnicos

¿Eres desarrollador o quieres correr tu propio servidor MCP, desplegarlo tú mismo o ver las herramientas disponibles en detalle? La documentación técnica completa está en el [`README.md`](README.md), que incluye el despliegue con Docker, todas las herramientas disponibles, variables de entorno y la estructura del proyecto.

---

*¿Atascado en algún paso? Escríbenos y lo resolvemos juntos.*
