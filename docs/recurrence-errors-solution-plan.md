# Plan de solucion: fechas y recurrencias

## Alcance

La solucion se implementara en este orden:

1. Backend y contrato de fechas.
2. Anclas de recurrencia y solapamientos.
3. Excepciones y expansion de eventos.
4. Frontend desktop, mobile y disponibilidad.
5. Pruebas de regresion y verificacion de despliegue.

La implementacion no debe borrar datos existentes ni ignorar conflictos reales.

## Decisiones explicitas

- Todas las fechas de calendario usan `YYYY-MM-DD` y la zona `America/Santo_Domingo`.
- Una conversion de bloque unico a recurrente empieza en la fecha original del bloque (`current.date`).
- Un bloque o evento terminado antes de la fecha efectiva no bloquea una nueva serie.
- Un bloque activo que realmente se solapa sigue bloqueando la operacion.
- Los bloques pausados siguen reservando horario, para conservar el comportamiento actual.
- `skip` elimina la ocurrencia original.
- `move` elimina la ocurrencia original y crea una ocurrencia en `targetDate`.
- Un evento horario movido sin horas explicitas conserva sus horas originales.
- Una excepcion `move` no puede apuntar a otra ocurrencia de la misma serie ni duplicar otro `targetDate` de esa serie.
- La fecha origen de una excepcion debe tener una ocurrencia real.
- Los conflictos devuelven el `id`, nombre, fecha, horario y origen de la ocurrencia que bloquea.
- Los eventos de todo el dia no bloquean eventos con horario, como ocurre actualmente.
- Las validaciones recurrentes comparan ocurrencias reales y se detienen mediante un ciclo de estado determinista, no mediante un horizonte arbitrario.
- No se hara una migracion destructiva de datos legacy.

## Fase 1: contrato de fechas

### Archivos

- `apps/backend/src/utils/calendar-date.ts`
- `apps/backend/src/modules/timeblocks/timeblocks.validator.ts`
- `apps/backend/src/modules/events/events.validator.ts`
- `apps/backend/src/modules/events/events.util.ts`
- `apps/backend/src/modules/timeblocks/timeblocks.controller.ts`
- `apps/backend/src/modules/timeblocks/timeblocks.routes.ts`

### Cambios

- Crear helpers para validar estrictamente `YYYY-MM-DD`.
- Crear helpers para convertir una fecha de calendario a `DateTime` y `Date` en `America/Santo_Domingo`.
- Crear helpers de inicio local y siguiente dia para rangos inclusivos.
- Reemplazar `new Date("YYYY-MM-DD")` para fechas de calendario.
- Usar el helper en `date`, `effectiveFrom`, `repeatEndsAt`, `recurrenceEndsAt`, fechas de excepcion y consultas `from/to`.
- Anadir un schema de rango para `GET /timeblocks/exceptions`.
- Aplicar `validateQuery` en esa ruta.
- Consultar el limite superior como `targetDate < siguienteDia(to)`.
- Rechazar timestamps completos en campos cuyo contrato es una fecha sin hora.

### Criterios

- `repeatEndsAt: "2026-09-14"` ocurre el 14 y no termina el 13.
- Una excepcion del ultimo dia del rango, incluido domingo, se devuelve.
- Eventos y bloques guardan la misma representacion de fecha local.

## Fase 2: anclas de recurrencia

### Archivos

- `apps/backend/src/modules/timeblocks/timeblocks.service.ts`
- `apps/backend/src/modules/events/events.service.ts`
- `apps/backend/src/modules/timeblocks/timeblocks.util.ts`
- `apps/backend/src/modules/events/events.util.ts`

### Cambios

- Al crear un bloque recurrente, guardar `recurrenceStartsAt` en el inicio del dia local de creacion.
- Al crear un evento recurrente, guardar `recurrenceStartsAt` en su fecha inicial.
- Al convertir un bloque unico a recurrente:
  - Poner `date` en `null`.
  - Poner `recurrenceStartsAt` en el `current.date` anterior.
  - Conservar dias, horario e intervalo enviados.
  - Validar desde `current.date`.
- Al convertir una recurrencia a bloque unico:
  - Guardar `date`.
  - Limpiar `recurrenceStartsAt`.
  - Poner `repeatEveryWeeks` en `1`.
  - Limpiar `repeatEndsAt`.
- Mantener los fallbacks para datos legacy:
  - Bloques: `recurrenceStartsAt ?? createdAt`.
  - Eventos: `recurrenceStartsAt ?? date`.
- Si una actualizacion completa cambia la fecha base de una serie, actualizar tambien su ancla.
- Normalizar o rechazar un bloque unico cuyo `daysOfWeek` no contiene el dia de `date`.

## Fase 3: ocurrencias y solapamientos

### Archivo nuevo

- `apps/backend/src/utils/calendar/recurrence-overlap.ts`

### Entrada del helper

- Serie candidata.
- Fecha inicial efectiva.
- Fecha final opcional.
- `excludeId` opcional.
- Excepciones de la serie existente.
- Tipo de serie: bloque o evento.

### Algoritmo

- Generar fechas de ocurrencia reales, no solo comparar `daysOfWeek`.
- Aplicar siempre inicio, final, intervalo, dias y excepciones.
- Comparar horarios con intervalos semiabiertos:
  - `candidate.startMin < existing.endMin`.
  - `existing.startMin < candidate.endMin`.
- Ordenar resultados por fecha, inicio, tipo e `id`.
- Para series con final, detenerse en el menor final de ambas series.
- Para series sin final, detenerse cuando se repita el estado combinado de las dos recurrencias.
- El estado debe incluir fecha dentro del ciclo gregoriano de 400 anos y fase del intervalo de cada serie.
- Generar solo fechas candidatas, no cada minuto ni cada dia cuando la recurrencia permite saltos.
- Usar SQL solo para prefiltrar por `userId`, `excludeId` y un intervalo horario amplio; la decision final debe ser del helper.
- Cargar los campos completos de recurrencia y excepciones antes de comparar.

### Casos de bloques

- Usar `repeatEveryWeeks` y los dias reales de cada semana.
- Excluir bloques de una fecha unica anterior a la fecha candidata.
- Excluir series terminadas antes de la fecha candidata.
- Excluir excepciones de series terminadas fuera de la ventana.

### Casos de eventos

- Aplicar `DAILY`, `WEEKLY`, `MONTHLY` y `YEARLY`.
- Aplicar `recurrenceInterval`.
- Aplicar `recurrenceDaysOfWeek` y el fallback legacy del dia base.
- Aplicar `recurrenceDayOfMonth` y la regla actual de clamp al ultimo dia del mes.
- Anclar todos los calculos a `recurrenceStartsAt ?? event.date`.
- Aplicar excepciones skip y move.

### Eliminaciones de logica incorrecta

- No usar `daysOfWeek: { hasSome: daysOfWeek }` como decision final.
- No usar solo el dia base de un evento recurrente.
- No consultar excepciones sin filtrar por `blockId` o `eventId`.
- No incluir automaticamente todo el historial.

## Fase 4: PATCH unico a recurrente

### Archivo

- `apps/backend/src/modules/timeblocks/timeblocks.service.ts`

### Flujo esperado

1. Leer el bloque actual y comprobar que es unico.
2. Obtener `current.date` como fecha de inicio de la nueva serie.
3. Resolver dias, horario, intervalo y fecha final.
4. Validar que la fecha final no sea anterior al inicio.
5. Ejecutar el helper de solapamiento desde esa fecha.
6. Excluir el propio bloque por `id`.
7. Guardar `date: null` y `recurrenceStartsAt: current.date`.
8. Mantener el error si existe un bloque activo que realmente se solapa.

Para el caso del HAR, el bloque historico terminado queda fuera. Si `dfddaaca-f4b7-4721-ae3f-be48f9b84c05` sigue guardado y se solapa lunes/miércoles, el `409` permanece y debe identificar esa fila.

### Detalles de conflicto

Usar `AppError("CONFLICT", message, details)` con esta forma:

```json
{
  "kind": "TIME_BLOCK",
  "id": "uuid",
  "label": "Estudio ITLA",
  "date": "2026-09-16",
  "startMin": 480,
  "endMin": 600,
  "source": "base"
}
```

Actualizar `apps/frontend/src/types/api.types.ts` para aceptar detalles de conflicto ademas de detalles de validacion.

## Fase 5: excepciones

### Archivos

- `apps/backend/src/modules/timeblocks/timeblocks.service.ts`
- `apps/backend/src/modules/events/events.service.ts`
- `apps/backend/src/modules/timeblocks/timeblocks.util.ts`
- `apps/backend/src/modules/events/events.util.ts`

### Cambios

- Comprobar que la fecha origen tiene una ocurrencia real antes de crear la excepcion.
- Comprobar que `targetDate` es diferente de la fecha origen.
- Comprobar que una serie no tenga otro move hacia el mismo `targetDate`.
- Comprobar que el destino no tenga otra ocurrencia de la misma serie.
- Filtrar siempre excepciones por la serie que se esta evaluando.
- Para bloques move, exigir siempre `startMin` y `endMin`.
- Para eventos horarios move, copiar las horas originales cuando falten.
- Validar conflictos en el destino con las horas resueltas.
- Guardar en la excepcion las horas resueltas.
- Mantener el filtrado de bloque/evento por `blockId`/`eventId`.

## Fase 6: expansion de eventos

### Archivo

- `apps/backend/src/modules/events/events.util.ts`

### Cambios

- Corregir el bucle inclusivo de `expandEventOccurrences`.
- Nunca devolver una fecha posterior a `to`.
- Usar `recurrenceStartsAt ?? event.date` para fases y diferencias.
- Mantener el fallback de eventos semanales legacy sin dias guardados.
- Mantener excepciones movidas dentro del rango solicitado.
- No permitir que una excepcion de otro evento modifique la ocurrencia actual.

## Fase 7: frontend

### Archivo nuevo

- `apps/frontend/src/features/timeblocks/lib/occurrences.ts`

### Archivos consumidores

- `apps/frontend/src/features/timeblocks/components/TimeBlockWeekGrid.tsx`
- `apps/frontend/src/features/timeblocks/components/MobileAgenda.tsx`
- `apps/frontend/src/features/timeblocks/lib/availability.ts`
- `apps/frontend/src/features/timeblocks/components/TimeBlockPreviewModal.tsx`
- `apps/frontend/src/app/(app)/timeblocks/page.tsx`
- `apps/frontend/src/features/events/components/EventPreviewModal.tsx`

### Cambios

- Eliminar las implementaciones duplicadas de `blockOccurrenceOn`.
- Compartir una implementacion para desktop, mobile y disponibilidad.
- Aplicar inicio, fallback legacy, intervalo, final y excepciones en todos los consumidores.
- Convertir `createdAt` como instante en `America/Santo_Domingo`, no con `slice(0, 10)`.
- Mantener las fechas seleccionadas como fechas de calendario, evitando conversiones UTC en medianoche.
- Pasar excepciones a `findAvailableStartMin` cuando esten disponibles.
- Mostrar en el editor la fecha de inicio derivada al convertir un bloque unico.
- Mostrar el mensaje real del backend para errores `409`.
- Conservar el rollback de la mutacion optimista.

## Fase 8: pruebas backend

### Archivos

- `apps/backend/src/utils/calendar-date.test.ts`
- `apps/backend/src/utils/calendar/recurrence-overlap.test.ts`
- `apps/backend/src/modules/timeblocks/timeblocks.service.test.ts`
- `apps/backend/src/modules/timeblocks/timeblocks.util.test.ts`
- `apps/backend/src/modules/timeblocks/timeblocks.validator.test.ts`
- `apps/backend/src/modules/events/events.service.test.ts`
- `apps/backend/src/modules/events/events.util.test.ts`
- Pruebas del controlador/ruta de excepciones.

### Casos obligatorios

- Conversión unico -> recurrente con bloque historico terminado: funciona.
- Conversión con bloque activo solapado: `409` con detalles.
- Conversión guarda `recurrenceStartsAt` correcto.
- `repeatEndsAt` conserva el dia local exacto.
- Excepcion del ultimo dia de un rango se devuelve.
- Excepcion con origen antes del rango y destino dentro del rango se devuelve.
- Evento diario de un solo dia no devuelve el dia siguiente.
- Evento semanal con base lunes y dias miércoles detecta miércoles.
- Evento skip no bloquea otra operacion.
- Evento move bloquea en el destino, no en el origen.
- Excepcion de un evento no altera otro evento.
- Recurrencia quincenal respeta fase semanal.
- Excepcion move sin horas conserva las horas originales del evento.
- Destinos duplicados de una serie se rechazan.

## Fase 9: pruebas frontend

### Casos

- Bloque legacy antes de `createdAt` no aparece.
- Bloque creado antes de medianoche local usa el dia correcto.
- Semanal y quincenal coinciden entre desktop y mobile.
- Fecha final inclusiva.
- Skip y move.
- Bloque unico.
- Excepcion en domingo.
- Disponibilidad respeta intervalo e inicio.
- Editor unico -> recurrente envia la transformacion esperada.

Anadir el script `test` en `apps/frontend/package.json`:

```json
{
  "scripts": {
    "test": "bun test"
  }
}
```

## Fase 10: datos existentes

- No borrar automaticamente `Estudio ITLA` ni ningun otro bloque.
- Generar un reporte de bloques recurrentes sin `recurrenceStartsAt`, bloques terminados, fechas guardadas a medianoche UTC y destinos duplicados.
- Mantener los fallbacks legacy.
- No corregir masivamente fechas existentes sin identificar su origen.
- Corregir automaticamente solo valores creados por las nuevas rutas.
- No se requiere migracion Prisma para los cambios principales porque `recurrenceStartsAt` y `targetDate` ya existen.

## Fase 11: verificacion

Ejecutar:

```bash
cd apps/backend && bun test
cd apps/backend && bun run typecheck
cd apps/backend && bunx prisma validate
cd apps/frontend && bun test
cd apps/frontend && bunx tsc --noEmit
cd apps/frontend && bun run lint
cd apps/frontend && bun run build
```

Verificar con datos sanitizados:

- Crear bloque unico y convertirlo a recurrente.
- Confirmar que el historico terminado no bloquea.
- Confirmar que el conflicto activo si bloquea y muestra su `id`.
- Confirmar `recurrenceStartsAt` en la respuesta.
- Probar excepcion en el ultimo dia de una semana.
- Probar recurrencia quincenal.
- Probar eventos diarios, semanales y movidos.
- Probar desktop y mobile.

## Despliegue y rollback

- Revocar los tokens expuestos en los HAR antes de volver a compartir trafico.
- Desplegar backend antes que frontend.
- Confirmar el commit desplegado en `nisky.las.do`.
- Ejecutar smoke tests autenticados sin guardar tokens en archivos.
- Si falla la verificacion, revertir el commit de aplicacion; no ejecutar rollback destructivo de datos.
