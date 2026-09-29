# Comparación visual · 29 de septiembre de 2026

## Resultado

Los módulos 4–7 no se pueden considerar terminados visualmente. Existen rutas y componentes, pero la comparación directa confirma diferencias estructurales. La revisión anterior de código y build no justificaba el estado «alineado».

## Evidencia directa

En cada imagen: Figma a la izquierda; aplicación a la derecha. Referencia: archivo `xn5QjCuRGgDBjpSFr6v3jq`, página `4:47`. Se comparan estructura y controles; los textos y cantidades de los datos de ejemplo pueden variar.

| Pantalla / nodo | Diferencia confirmada | Evidencia |
| --- | --- | --- |
| Editor del diario · `101:2297` | Figma coloca el editor ancho a la izquierda y «Solo para ti» a la derecha, con Guardar en la cabecera. La aplicación mantiene la lista de entradas a la izquierda, editor a la derecha y Guardar abajo. | [Comparación](compare-journal.jpg) |
| Captura rápida · `109:5170` | Difieren dimensiones, cabecera, orden de pestañas, área de texto y pie. La aplicación incorpora una lista de pendientes dentro del diálogo y no muestra Cancelar como Figma. | [Comparación](compare-capture.jpg) |
| Hábitos · `109:5294` | El formulario compacto y la edición en línea no reproducen la distribución de frecuencia, repetición, días y acciones del diseño. La cantidad de hábitos es dato de prueba, no un defecto. | [Comparación](compare-habits.jpg) |
| Perfil · `101:3364` | Las pestañas y la ilustración están presentes. El perfil usa edición en línea en lugar del formulario y Guardar cambios; difieren proporciones y altura de las tarjetas. Conservar la función adicional de nombre de usuario al adaptar. | [Comparación](compare-profile.jpg) |
| Acceso · `101:4572` | Falta la división de fondo azul/ blanco; el formulario está dentro de una tarjeta más estrecha. Difieren posiciones, espacios y textos. Nutria y LAS sí están presentes. | [Comparación](compare-login.jpg) |
| Notificaciones · `101:3666` | La aplicación limita el ancho, añade una tarjeta de diagnóstico y usa una lista más extensa. Figma muestra dos tarjetas anchas. El estado activado/desactivado depende del permiso del navegador y no se cuenta como defecto. Conservar las preferencias reales al reorganizar. | [Comparación](compare-notifications.jpg) |

## Alcance y límites de la ejecución

- Navegador Chromium sobre la aplicación local, con API simulada; sin modificar datos reales.
- 83 registros de escenarios: 82 capturas completadas y un escenario fallido. Revisión de rutas principales de módulos 4–7 a 1448, 390, 768 y 1024 px, más diálogos y acceso/registro.
- Ningún desbordamiento horizontal del documento en las capturas completadas. Se detectó una imagen sin cargar en el diálogo de conexión de integraciones: `/universities/itla.png` a través de `/_next/image`; queda por determinar si procede del recurso o de su optimización. Sin excepciones JavaScript no controladas registradas. Esto no certifica todas las interacciones ni accesibilidad.
- El escenario de detalle de bloque falló porque el selector encontró un elemento no visible; queda pendiente y no demuestra un fallo del producto.
- La ventana flotante se capturó con un fixture incompleto (`plannedSec` y `totalPausedSec` ausentes). Su temporizador no se considera validado; el `NaN` observado no se atribuye al producto.
- Las seis comparaciones enlazadas son evidencia visual directa. Las demás capturas de esta ejecución no equivalen a aprobación frente a cada nodo de Figma. Inicio, Proyectos y Tareas conservan su validación histórica, sin una nueva auditoría completa en esta ejecución.
- No se verificó persistencia contra el backend, envío de notificaciones ni conexión real con Moodle.

## Pendiente para cerrar

1. Adaptar el editor del diario, captura y hábitos a su composición oficial conservando funciones.
2. Completar perfil, notificaciones y acceso; comparar también registro y registro pausado con sus nodos.
3. Comparar individualmente los demás nodos de módulos 4–7, corregir las diferencias y repetir los escenarios pendientes con fixtures válidos.
4. Validar guardar/cancelar, carga/vacío/error y permisos; ejecutar el build después de los cambios de código.

En esta revisión se actualizan documentación y evidencia; no se modificó el código de la aplicación.
