# Nisky · mockups para LAS

[Página de Figma — LAS / Project Mockups](https://www.figma.com/design/xn5QjCuRGgDBjpSFr6v3jq?node-id=139-6413)

Nisky se presenta como un único producto: plataforma web de productividad personal.

## Variantes adicionales: Inicio y Login

Se añadieron ambas vistas conservando los mockups anteriores. Inicio y Login se adaptaron desde «Diseño oficial · Nisky» a 16:10 (1737,6 × 1086) con cambios de layout, conservando componentes y contenido, para llenar el MacBook sin franjas laterales ni estirar las imágenes.

- Inicio: fuente `110:6127`; mockup desktop `155:6904`.
- Login: fuente `101:4572`; mockup desktop `155:6926`.

Cada vista incluye `project-nisky-[inicio|login]-mockup-desktop@2x.png` (3200 × 2200), `project-nisky-[inicio|login]-mockup-mobile@2x.png` (1600 × 1600) y `project-nisky-[inicio|login]-screen-only@2x.png` (aproximadamente 3475 × 2172), en `exports/`. Las variantes mobile son composiciones compactas del MacBook. Los mockups tienen fondo transparente.

También se añadió `project-nisky-login-mockup-iphone@2x.png` (1600 × 2200), frame `179:6439`, y su pantalla limpia `project-nisky-login-iphone-screen-only@2x.png` (780 × 1688). La interfaz del iPhone es una adaptación responsive de los componentes oficiales de Login, autorizada para este mockup; no es una captura de producción. Conserva marca Nisky, campos, botones y firma LAS. Se revisaron las composiciones, la ausencia de franjas laterales y los límites de los campos móviles.

## Entregables

### iPhone · Inicio

- [Mockup en Figma](https://www.figma.com/design/xn5QjCuRGgDBjpSFr6v3jq?node-id=187-6510): `project-nisky-inicio-mockup-iphone@2x.png`, 1600 × 2200, fondo transparente.
- Pantalla editable `187:6421`: `project-nisky-inicio-iphone-screen-only@2x.png`, 780 × 1688.
- Adaptación móvil autorizada del Inicio oficial: saludo, captura rápida, tareas y hábitos, conservando marca Nisky y firma LAS. Los ejemplos proceden de la referencia oficial; no es una captura de producción. Se simplifican etiquetas secundarias para el ancho móvil.
- Revisado visualmente: pantalla 390:844 sin deformación ni franjas laterales, márgenes amplios y marco coherente con el iPhone de Login.
- Refinamiento: bienvenida con ilustración oficial, texto de tareas a 14 px con categoría y vencimiento, navegación inferior derivada del menú oficial, superficies azuladas y espaciado revisado según la guía UI/UX. Marco grafito con botones laterales y sombra sutil. La navegación móvil es una propuesta de adaptación, no una captura de la implementación. Exportaciones actualizadas y verificadas visualmente en Figma.

Los PNG están en `exports/`, exportados desde Figma a 2×:

| Archivo | Uso | Resolución |
| --- | --- | --- |
| `project-nisky-mockup-desktop@2x.png` | MacBook con ventana de Enfoque superpuesta, transparente | 3200 × 2200 |
| `project-nisky-mockup-mobile@2x.png` | Composición vertical de MacBook y Enfoque, transparente | 1600 × 2200 |
| `project-nisky-screen-only@2x.png` | Tareas oficial sin dispositivo | 2896 × 2172 |
| `project-nisky-secondary-screen@2x.png` | Ventana oficial de Enfoque | 960 × 1040 |

El MacBook representa la plataforma web; la ventana de Enfoque complementa la gestión de tareas. Se sustituyó el iPhone conceptual para usar únicamente pantallas de la página «Diseño oficial · Nisky».

## Fuentes y límites

- Principal: copia íntegra de Tareas `101:1226`, 1448 × 1086, sin reinterpretar contenido ni distribución. Conserva la firma LAS. Se ajusta completa al MacBook, con márgenes laterales para respetar su proporción.
- Secundaria: copia íntegra de Enfoque `101:4575`, 480 × 520.
- Mobile designa una composición vertical de estas mismas pantallas. La página oficial no contiene una UI de teléfono; un futuro iPhone requiere primero aprobar esa pantalla allí.
- Los ejemplos de tareas proceden del diseño oficial; no son resultados, métricas ni clientes reales.
- Las pantallas técnicas mantienen el fondo propio de la interfaz; no tienen dispositivo, fondo de presentación ni sombra exterior.
- Figma incluye referencias editoriales desktop/mobile y notas de entrega. Las pantallas fuente son editables; las superficies de pantalla dentro de los dispositivos usan renders PNG a 2×.

## Integración y motion

- Mantener proporciones con `object-fit: contain`: Tareas 1448:1086 y Enfoque 480:520.
- Los mockups exportados no incluyen texto comercial. Renderizar nombre, categoría y descripción como HTML.
- Para animación independiente, usar las capas `device-primary`, `secondary-reveal` y `screen-reveal` en Figma, o las pantallas técnicas dentro de dispositivos SVG/CSS.
- Reservar espacio para desplazamientos iniciales de 40–64 px; reducir o desactivar movimiento con `prefers-reduced-motion`.
- Revisadas visualmente ambas composiciones en Figma: alineación, proporciones, márgenes y legibilidad general.
