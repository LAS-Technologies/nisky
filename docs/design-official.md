# Diseño oficial de Nisky

Propuesta 04 es la referencia oficial desde el 25 de septiembre de 2026.

- [Figma: Diseño oficial · Nisky](https://www.figma.com/design/xn5QjCuRGgDBjpSFr6v3jq?node-id=110-6127).
- Archivo: `xn5QjCuRGgDBjpSFr6v3jq`; página: `4:47`.
- Las propuestas anteriores se conservan como historial. Sus pantallas no son la referencia de implementación.
- Base visual: Plus Jakarta Sans + Inter, superficies claras azuladas, primario azul marino, tarjetas con radio de 16 px y sombra sutil.
- Conservar la nutria aprobada y la firma LAS abajo a la izquierda. Usar datos de la cuenta, no los ejemplos de Figma.

## Implementación por turnos

Cada turno completa un módulo y registra validación y pendientes aquí. No cambiar silenciosamente el alcance al comenzar otro turno.

| Turno | Módulo y pantallas de Figma | Rutas / componentes | Estado |
| --- | --- | --- | --- |
| 1 | Base compartida e Inicio (00); navegación, perfil y captura existentes | Sidebar, TopAppBar, BrandMark, `/`, tarjetas de Inicio | Implementado y validado |
| 2 | Proyectos: listado, resumen, tareas, notas, recursos, actividad, equipo, conversación (01–08); crear proyecto (35), invitaciones (40), vacío (45) | `/projects`, `/projects/[id]` | Implementado y validado |
| 3 | Tareas: lista, sin fecha, detalle (09–11), crear (36), error (46) | `/tasks` y paneles de tarea | Implementado y validado |
| 4 | Agenda semanal, eventos, enfoque (12–14), ventana flotante (34), crear bloque/evento (37–38), configuración de enfoque (42), detalle de bloque (44) | `/timeblocks`, `/events`, `/focus`, `/pomodoro-window` | Pendiente |
| 5 | Diario, editor y protegido (15–17); notas, crear/editar y vista previa (18–20, 43) | `/journal`, `/knowledge`, `/knowledge/new`, `/knowledge/[id]/edit` | Pendiente |
| 6 | Capturas, recordatorios (21–22), captura rápida (39), gestión de hábitos (41) | `/quick-notes`, `/reminders`, CaptureComposer, HabitManager | Pendiente |
| 7 | Perfil, seguridad, notificaciones, integraciones y administración (23–28); ayuda/feedback (29–30), acceso/registro/registro pausado (31–33) | `/settings`, `/support`, `/login`, `/register` | Pendiente |

Las pantallas de escritorio son la referencia visual. Mantener una adaptación móvil funcional usando la navegación móvil existente; no convertir los marcos de Figma en lienzos de tamaño fijo.

## Nodos de referencia por módulo

| Módulo | Nodos |
| --- | --- |
| Inicio | `110:6127` |
| Proyectos | `101:6`, `101:159`, `101:312`, `101:465`, `101:618`, `101:771`, `101:922`, `101:1075`, `109:4644`, `109:5238`, `110:6416` |
| Tareas | `101:1226`, `101:1379`, `101:1532`, `109:4729`, `110:6613` |
| Agenda y enfoque | `101:1685`, `101:1838`, `101:1991`, `101:4575`, `109:4820`, `109:5001`, `109:5638`, `109:5796` |
| Diario y notas | `101:2144`, `101:2297`, `101:2450`, `101:2601`, `101:2754`, `101:2907`, `109:5718` |
| Capturas, recordatorios y hábitos | `101:3060`, `101:3213`, `109:5170`, `109:5294` |
| Ajustes, ayuda y acceso | `101:3364`, `101:3515`, `101:3666`, `101:3817`, `101:3968`, `101:4119`, `101:4270`, `101:4421`, `101:4572`, `101:4573`, `101:4574` |

## Turno 1

- Navegación de 294 px y barra superior de 86 px en escritorio; conservar colapso, atajos, avisos, invitaciones y perfil.
- Inicio: saludo de la cuenta y fecha actual, captura rápida, bloque actual/próximo/vacío, tareas, hábitos y próximos días.
- La actividad y las capturas previas siguen accesibles en «Tu actividad y capturas rápidas», debajo de las tarjetas.
- El cierre de sesión permanece en el menú de perfil. No se modifica el flujo de autenticación.
- Los diálogos existentes conservan sus acciones; su adaptación visual se hará en su módulo.
- Recursos originales de Figma guardados en `apps/frontend/public/design-official/`; los dos logos reutilizan los archivos aprobados existentes.
- Validación: ESLint de los componentes modificados y `bun run build --webpack` correctos, incluyendo TypeScript. El build predeterminado con Turbopack quedó bloqueado por permisos de apertura de puertos del entorno.
- Comparación visual con el nodo oficial a 1448 × 1086; revisión responsive a 390, 768 y 1024 px sin desbordamientos horizontales. Estados comprobados: contenido, vacío, bloque activo, próximo bloque, carga, error y textos largos.
- Pruebas de navegador con API simulada: captura, Alt+N, menú de perfil, completar tarea/hábito, gestión de hábitos, colapso de navegación y Alt+B. Sin errores JavaScript no controlados. Estas pruebas no modificaron datos de negocio ni sustituyen una prueba integral contra el backend.
- Siguiente turno: módulo 2, Proyectos.

## Turno 2

- Listado de proyectos con tarjetas, filtros Todos/Propios/Compartidos, búsqueda, orden por actividad o nombre y estado vacío con la ilustración original.
- Cabecera y siete secciones adaptadas: Resumen, Tareas, Notas, Recursos, Actividad, Equipo y Conversación. Se conservan búsqueda avanzada, edición de campos de tarea, paginación, notas con permisos, gestión de miembros y confirmaciones para acciones destructivas.
- Formulario compartido para crear/editar, con fecha objetivo, meta semanal y colores. Invitaciones recibidas y envío en un diálogo accesible desde la barra superior o el equipo del proyecto.
- Adaptaciones a los datos disponibles: el listado muestra el total de tareas; el resumen muestra completadas/total y la meta semanal guardada. El tiempo de enfoque acumulado por proyecto no está disponible en esta API. La próxima sesión se limita explícitamente a los bloques de hoy de la cuenta actual.
- Validación: ESLint y build de producción con Webpack, incluyendo TypeScript. Pruebas de navegador con API simulada de creación/edición, recursos, comentarios, envío de invitaciones, filtros de estado y vista previa de notas. Estados vacío y error con recuperación; acciones de propietario ocultas para colaboradores.
- Revisión de las siete secciones a 1448, 390, 768 y 1024 px, sin desbordamientos horizontales ni errores JavaScript no controlados. Los recursos gráficos reutilizan los archivos locales aprobados del módulo 1.
- Las pruebas de navegador no modificaron datos de negocio y no sustituyen una prueba integral contra el backend.
- Siguiente turno: módulo 3, Tareas.

## Turno 3

- Lista agrupada por día, tarjetas de tareas, pestaña sin fecha límite y recuperación de errores con la ilustración original. Se mantienen búsqueda, filtros, orden, selección múltiple, traslado de tareas, eliminación con confirmación y paginación.
- Detalle en página dentro de Tareas: descripción y estado, subtareas y comentarios; proyecto, prioridad, responsable, fecha límite, recordatorios y enfoque en la tarjeta lateral. Recurrencia, autor y pomodoros permanecen en «Más detalles». Los paneles usados desde otras rutas conservan su presentación.
- Crear abre un formulario antes de guardar. Cancelar no crea tareas vacías. Incluye proyecto, responsable, prioridad, fecha y hora, estado, estimación, repetición y recordatorio. Las capturas se archivan después de crear correctamente la tarea; un error de recordatorio se informa sin repetir la creación.
- Adaptaciones a datos reales: fechas, cantidades y proyectos proceden de la API; las subtareas muestran su título y estado, sin inventar los textos secundarios ilustrativos de Figma. Se reutilizan controles y permisos existentes.
- Validación: ESLint de los archivos modificados, TypeScript y build de producción con Webpack. Navegador con API simulada: crear/cancelar, recurrencia y recordatorio, completar tarea, buscar, selección, lista/sin fecha, reintentar tras error, editar descripción y fecha, añadir/completar subtareas, comentar y abrir enfoque.
- Revisión visual a 1448, 390, 768 y 1024 px; formulario, detalle, lista, estado vacío y error. Textos largos y contenedores revisados sin desbordamiento horizontal. Se conserva la firma LAS inferior izquierda. Las pruebas no modificaron datos de negocio ni sustituyen una prueba integral contra el backend.
- Siguiente turno: módulo 4, Agenda y enfoque.

## Criterio de cierre por módulo

1. Consultar los nodos oficiales con la skill Figma a código.
2. Reutilizar componentes y mantener permisos, datos reales y acciones existentes.
3. Comprobar carga, vacío, error y datos completos cuando correspondan.
4. Revisar escritorio y móvil, textos largos, teclado y ausencia de desbordamiento horizontal.
5. Ejecutar build y verificaciones pertinentes; registrar el resultado y el próximo módulo.
