# Dirección de diseño de menús e interfaces del juego

## Guía operativa para diseño y desarrollo asistido por IA

> **Principio rector: ambientación antigua, experiencia contemporánea.**
>
> La interfaz debe expresar el mundo del juego mediante materiales, transparencias, símbolos y composición, sin imitar interfaces obsoletas ni parecer un formulario web.

---

# 1. Objetivo

Esta guía define la dirección obligatoria para:

- Menús principales.
- HUD durante la partida.
- Barras de habilidades.
- Accesos rápidos.
- Ventanas contextuales.
- Creación de personaje.
- Configuración de una nueva partida.
- Inventario.
- Construcción.
- Objetivos y misiones.
- Minimapa.
- Ajustes.
- Pantallas de pausa.
- Notificaciones.
- Tooltips.
- Modales de confirmación.

Copilot debe utilizar estas directrices al diseñar, implementar o modificar cualquier interfaz del juego.

El objetivo es conseguir una interfaz:

- Reconocible como parte de un videojuego.
- Coherente entre todas las pantallas.
- Integrada visualmente con el mundo.
- Moderna y legible.
- Preparada para teclado, ratón y mando.
- Alejada de los controles HTML predeterminados.
- Alejada del aspecto genérico asociado a imágenes generadas por IA.
- Construida a partir de una biblioteca común de assets reutilizables.

---

# 2. Dirección visual del juego

La referencia conceptual será:

> **Material histórico + UX contemporánea + transparencia integrada en el mundo.**

La ambientación antigua no debe traducirse en una interfaz anticuada.

La identidad temática podrá inspirarse en:

- Arcilla.
- Piedra.
- Bronce.
- Latón envejecido.
- Pigmentos minerales.
- Relieves.
- Sellos.
- Mapas.
- Tablillas.
- Geometría mesopotámica.
- Elementos arquitectónicos propios del mundo del juego.

Estos elementos deben utilizarse con moderación.

La interfaz no debe intentar parecer una aplicación antigua.

Debe ser una interfaz moderna construida con materiales y referencias visuales pertenecientes al mundo del juego.

## 2.1 Dirección prioritaria

A partir de ahora, la dirección principal será:

> **Transparencias + componentes flotantes + mundo visible + assets propios.**

Las transparencias, los módulos flotantes y la continuidad visual con el mundo serán rasgos principales del sistema.

La interfaz deberá evitar cubrir la escena mediante ventanas opacas siempre que no exista una razón funcional para hacerlo.

---

# 3. Transparencia como lenguaje principal

La transparencia será una característica estructural de la interfaz, no un efecto decorativo puntual.

Los siguientes elementos deberán integrarse sobre el mundo sin ocultarlo innecesariamente:

- HUD.
- Barras de habilidades.
- Accesos rápidos.
- Objetivos.
- Paneles contextuales.
- Indicadores de recursos.
- Minimapa.
- Notificaciones.
- Ayudas rápidas.
- Información sobre personajes.
- Información sobre edificios.
- Información sobre objetos.

## 3.1 Principios de transparencia

Utilizar superficies oscuras translúcidas combinadas con:

- Degradados suaves.
- Oscurecimiento localizado.
- Desenfoque moderado, cuando el motor lo permita.
- Bordes discretos.
- Sombras cortas.
- Iluminación interior sutil.
- Placas internas para textos importantes.

La transparencia debe permitir que la interfaz parezca integrada en la escena.

Sin embargo, nunca debe perjudicar:

- La legibilidad.
- El contraste.
- La identificación de los controles.
- La navegación con teclado o mando.
- La lectura sobre zonas claras del mapa.
- La lectura sobre zonas oscuras del mapa.
- La percepción de los estados interactivos.

## 3.2 Rangos orientativos de opacidad

Usar como punto de partida:

| Tipo de elemento | Opacidad orientativa |
|---|---:|
| HUD persistente | 55-70 % |
| Barra de habilidades | 60-75 % |
| Ayuda rápida | 55-70 % |
| Tooltip | 70-85 % |
| Panel contextual | 65-80 % |
| Ventana secundaria | 75-90 % |
| Modal crítico | 85-95 % |

Estos valores no son absolutos.

Deben validarse dentro del juego sobre:

- Terrenos claros.
- Terrenos oscuros.
- Edificios.
- Vegetación.
- Agua.
- Unidades.
- Escenas visualmente cargadas.
- Diferentes condiciones de iluminación.

## 3.3 Regla de ocupación

Los paneles deben ocupar únicamente el espacio necesario para mostrar su contenido.

Evitar:

- Grandes fondos opacos.
- Ventanas que cubran toda la escena sin necesidad.
- Paneles vacíos.
- Márgenes internos excesivos.
- Bloques rectangulares genéricos.
- Capas negras que anulen completamente el mundo.

La escena debe continuar siendo visible siempre que la interacción lo permita.

## 3.4 La transparencia no consiste simplemente en bajar la opacidad

No debe resolverse el diseño mediante:

```text
Rectángulo genérico
+ fondo negro
+ opacity: 0.6
```

La transparencia debe formar parte del lenguaje visual.

Los paneles deben poder combinar:

```text
Capa translúcida
+ degradado
+ material
+ sombra
+ borde
+ iluminación local
+ contenido
+ estado interactivo
```

El resultado debe tener profundidad visual sin perder claridad.

---

# 4. Barras de habilidades y accesos rápidos

Las barras de habilidades representan una de las referencias visuales más cercanas a la dirección que debe seguir el juego.

Deben construirse mediante módulos compactos y flotantes.

Cada habilidad podrá mostrar:

- Icono principal.
- Tecla o botón asociado.
- Estado de selección.
- Tiempo de recarga.
- Cantidad disponible.
- Bloqueo temporal.
- Coste de uso.
- Estado deshabilitado.
- Indicador de mejora.
- Información contextual al pasar el cursor.
- Información contextual al seleccionar con mando.

## 4.1 Reglas visuales

- Utilizar fondos translúcidos.
- Evitar cajas rectangulares completamente opacas.
- Mantener tamaños consistentes.
- Diferenciar visualmente cada tipo de acción.
- Usar iconos legibles y con una silueta clara.
- Mostrar la tecla asociada sin competir con el icono.
- Representar la recarga mediante máscara radial, velo, arco o reducción de luminosidad.
- Reservar el dorado o bronce luminoso para selección, disponibilidad o importancia.
- Utilizar estados visuales diferentes para foco, selección y activación.
- Evitar que todas las habilidades parezcan botones web idénticos.

## 4.2 Estados obligatorios

Cada componente interactivo deberá definir al menos:

- Reposo.
- Hover.
- Foco de teclado.
- Foco de mando.
- Pulsación.
- Selección.
- Activación.
- Deshabilitado.
- Bloqueado.
- Error.
- Aviso.
- Éxito.
- Cooldown.
- Recurso insuficiente.

El foco de navegación no debe confundirse con la selección.

---

# 5. Biblioteca propia de assets de interfaz

Se creará una biblioteca versionada de assets para menús y HUD.

La biblioteca será la fuente única para todas las interfaces del juego.

Ninguna pantalla debe incorporar directamente un asset generado por IA sin pasar antes por un proceso de:

1. Revisión visual.
2. Limpieza.
3. Recorte.
4. Eliminación de artefactos.
5. Corrección de bordes.
6. Ajuste de transparencia.
7. Normalización de escala.
8. Revisión de iluminación.
9. Revisión de materiales.
10. Preparación de estados.
11. Incorporación al inventario.
12. Versionado.

> **El objetivo no es ocultar que se ha utilizado IA.**
>
> **El objetivo es impedir que cada componente parezca generado por una IA diferente.**

La identidad final debe proceder de una biblioteca limitada, coherente y revisada.

La IA puede participar en la creación de los assets, pero los resultados de IA no constituyen automáticamente assets finales del juego.

---

# 6. Contenido de la biblioteca de assets

## 6.1 Fondos y superficies

Crear assets reutilizables para:

- Panel translúcido.
- Panel contextual.
- Ventana principal.
- Ventana secundaria.
- Modal.
- Tooltip.
- Tarjeta.
- Cabecera.
- Pie.
- Separador.
- Máscara de oscurecimiento.
- Fondo para texto.
- Fondo para notificaciones.
- Fondo para objetivos.
- Fondo para minimapa.
- Panel de ayuda rápida.

## 6.2 Controles

Crear componentes para:

- Botón primario.
- Botón secundario.
- Botón destructivo.
- Botón de icono.
- Pestaña.
- Selector.
- Toggle.
- Slider.
- Scrollbar.
- Campo de texto.
- Stepper.
- Selector segmentado.
- Tarjeta seleccionable.
- Lista desplegable.
- Control bloqueado.
- Control deshabilitado.

## 6.3 Componentes de HUD

Crear componentes para:

- Ranura de habilidad.
- Barra de habilidades.
- Barra de salud.
- Barra de resistencia.
- Barra de recursos.
- Indicador de recarga.
- Contador.
- Indicador de cantidad.
- Panel de objetivos.
- Notificación.
- Minimapa.
- Ayuda contextual.
- Información de selección.
- Información de edificio.
- Información de personaje.
- Indicadores de estado.
- Acciones disponibles.

## 6.4 Iconografía

Crear una única familia visual para:

- Acciones.
- Recursos.
- Construcción.
- Combate.
- Movimiento.
- Población.
- Trabajadores.
- Animales.
- Edificios.
- Producción.
- Ajustes.
- Audio.
- Guardado.
- Navegación.
- Alertas.
- Objetivos.
- Inventario.

Los iconos deben compartir:

- Grosor.
- Perspectiva.
- Iluminación.
- Nivel de detalle.
- Tamaño óptico.
- Paleta.
- Material.
- Forma de las sombras.
- Margen de seguridad.

No utilizar pseudoescritura cuneiforme aleatoria para representar funciones.

Si un símbolo tiene una función, debe conservar el mismo significado en todo el juego.

---

# 7. Requisitos técnicos de los assets

Cada asset deberá entregarse:

- Sin texto incrustado.
- Sin marcas de agua.
- Sin información superpuesta.
- Con transparencia real cuando corresponda.
- Con bordes limpios.
- Sin halos blancos o negros.
- Sin píxeles semitransparentes incorrectos.
- En la resolución adecuada.
- Con una zona segura definida.
- Con pivote y anclaje documentados.
- Con estados adicionales cuando sean necesarios.
- Preparado para las resoluciones objetivo.
- Con iluminación y materiales coherentes con la biblioteca.

Los elementos escalables deberán prepararse como:

- `9-slice`.
- `Nine-patch`.
- Sprite escalable equivalente del motor.
- Vector, si el motor y el tipo de componente lo permiten.

## 7.1 Resoluciones mínimas de validación

Comprobar el sistema en:

- 1920 × 1080.
- 2560 × 1440.
- 3840 × 2160.
- 16:9.
- 16:10.
- 21:9.

Preparar variantes cuando el escalado automático no conserve calidad suficiente.

---

# 8. Convención de nombres

Usar la siguiente estructura:

```text
UI_Categoria_Componente_Variante_Estado_Tamaño
```

Ejemplos:

```text
UI_HUD_SkillSlot_Bronze_Default_64
UI_HUD_SkillSlot_Bronze_Selected_64
UI_HUD_SkillSlot_Bronze_Cooldown_64
UI_HUD_ResourceBar_Clay_Default_256
UI_Menu_Button_Primary_Hover_320
UI_Menu_Panel_Translucent_Default_512
UI_Notification_Warning_Default_384
```

No usar nombres genéricos como:

```text
boton_final.png
panel_nuevo2.png
imagen_ia.png
asset_bueno.png
prueba_final_final.png
```

---

# 9. Inventario de assets

La biblioteca debe incluir una hoja de inventario con:

| Campo | Descripción |
|---|---|
| Nombre | Identificador único del asset |
| Categoría | HUD, menú, control, icono, fondo, etc. |
| Función | Uso del asset |
| Dimensiones | Tamaño nativo |
| Margen seguro | Espacio que no debe contener información importante |
| Escalado | Fijo, proporcional, 9-slice o vectorial |
| Estados | Default, hover, selected, disabled, etc. |
| Opacidad | Valor base recomendado |
| Anclaje | Posición y comportamiento |
| Versión | Versión actual |
| Pantallas | Lugares en los que se utiliza |
| Asset maestro | Componente del que deriva |
| Estado de revisión | Provisional, revisado o aprobado |

Antes de crear un asset nuevo, Copilot deberá comprobar si ya existe un componente reutilizable.

Las variantes deberán derivarse del asset maestro.

No crear excepciones que cambien arbitrariamente:

- El borde.
- La iluminación.
- La opacidad.
- El material.
- La proporción.
- El radio.
- Las sombras.
- El tamaño óptico.

---

# 10. Sistema de componentes

## 10.1 Botón primario

Uso:

- Acción final de una pantalla.
- Confirmación principal.
- Inicio de partida.
- Creación de mundo.
- Guardado importante.

Directrices:

- Máximo un botón primario por vista.
- Debe destacar sin utilizar un brillo exagerado.
- Puede emplear bronce o dorado luminoso.
- Altura recomendada: 48-56 px en 1080p.
- No debe parecer un botón HTML.
- Debe incluir estados de hover, foco, pulsado y deshabilitado.

## 10.2 Botón secundario

- Fondo oscuro o translúcido.
- Borde discreto.
- Contraste suficiente.
- No debe competir con la acción principal.
- Puede incluir icono.
- Debe mantener la misma familia visual que el botón primario.

## 10.3 Selectores discretos

Para opciones como:

- Densidad de población.
- Densidad de animales.
- Dificultad.
- Cantidad de recursos.
- Frecuencia de eventos.
- Intensidad del mundo.

Utilizar entre 3 y 5 opciones nominales.

Ejemplo:

```text
Escasa | Equilibrada | Abundante
```

Evitar sliders si conocer el valor exacto no aporta nada al jugador.

## 10.4 Sliders

Reservar sliders para:

- Volumen.
- Música.
- Efectos.
- Brillo.
- Sensibilidad.
- Escala de interfaz.

Longitud orientativa:

```text
280-520 px en 1080p
```

Los sliders deben incluir:

- Valor visible.
- Rail propio.
- Thumb propio.
- Estado de foco.
- Estado de interacción.
- Contraste suficiente.
- Integración con la biblioteca de assets.

## 10.5 Toggle

Utilizar para estados binarios.

Directrices:

- Control propio.
- Ancho aproximado de 44-52 px.
- Etiqueta completa.
- Estado claramente distinguible.
- No utilizar el checkbox azul predeterminado del navegador.

## 10.6 Tarjetas de preset

Cada tarjeta deberá mostrar:

- Nombre.
- Promesa de experiencia.
- Descripción breve.
- Entre 2 y 4 modificadores.
- Miniatura o previsualización.
- Estado seleccionado.
- Estado de foco.
- Comparación con otros presets.

## 10.7 Scrollbar

La scrollbar deberá:

- Integrarse con el material del panel.
- Mantener un ancho visible de 8-12 px.
- Tener un thumb suficientemente contrastado.
- Incluir hover y arrastre.
- Evitar la apariencia de scrollbar predeterminada del navegador.

---

# 11. Composición y experiencia de usuario

## 11.1 Una pantalla, una intención

La acción principal debe identificarse en menos de 2 segundos.

Cada pantalla tendrá:

1. Un objetivo.
2. Una jerarquía clara.
3. Un foco visual.
4. Una acción principal.
5. Acciones secundarias subordinadas.

## 11.2 Ancho de lectura

No extender controles por toda la pantalla panorámica.

El contenido operativo ocupará normalmente entre:

```text
960 y 1280 px
```

El espacio restante podrá emplearse para:

- Mostrar el mundo.
- Previsualizaciones.
- Personajes.
- Edificios.
- Ilustraciones.
- Material ambiental.
- Respiración visual.

## 11.3 Grid

Trabajar con un grid base de:

```text
8 px
```

Valores recomendados:

- Márgenes principales: 32-64 px.
- Separación entre grupos: 24-32 px.
- Separación entre elementos: 8-16 px.
- Altura mínima de interacción: 44 px.
- Distancia entre icono y texto: 8-12 px.

## 11.4 Jerarquía

Orden recomendado:

1. Título de pantalla.
2. Contexto breve.
3. Decisiones disponibles.
4. Consecuencia o previsualización.
5. Ayuda opcional.
6. Acción principal.

No mezclar mensajes de ayuda con etiquetas de campo.

## 11.5 Feedback

Los estados deben diferenciarse mediante más de una señal.

Ejemplos:

- Color + borde.
- Color + icono.
- Forma + iluminación.
- Opacidad + relieve.
- Animación + contraste.

No depender únicamente del color.

---

# 12. Lo que se debe evitar

## 12.1 Estructuras genéricas

Evitar:

- Paneles enormes con borde fino.
- Grandes espacios vacíos.
- Formularios verticales interminables.
- Controles distribuidos como una web.
- Bloques rectangulares idénticos.
- Modales completamente opacos sin necesidad.
- Menús que cubran el mundo entero.

Sustituir por:

- Módulos compactos.
- Capas translúcidas.
- Tarjetas.
- Barras flotantes.
- Paneles contextuales.
- Previsualizaciones.
- Zonas funcionales.

## 12.2 Controles genéricos

Evitar:

- Sliders extremadamente largos.
- Checkbox azul.
- `select` HTML visible.
- Scrollbar predeterminada.
- Botones genéricos.
- Inputs con apariencia de formulario web.
- Bordes idénticos en todos los elementos.

## 12.3 Abuso temático

Evitar:

- Dorado aplicado a todo.
- Texturas fuertes detrás del texto.
- Piedra en todas las superficies.
- Ornamentos sin función.
- Pseudoescritura histórica aleatoria.
- Marcos demasiado recargados.
- Decoración que reduzca el espacio útil.

## 12.4 Aspecto reconocible de IA

Evitar assets con:

- Texto deformado.
- Símbolos incoherentes.
- Bordes blandos.
- Iluminación contradictoria.
- Escalas diferentes.
- Materiales incompatibles.
- Detalles que no cumplen ninguna función.
- Ornamentos asimétricos accidentales.
- Formas imposibles de reutilizar.
- Fondos que deberían ser transparentes.
- Diferentes estilos mezclados dentro de la misma pantalla.

---

# 13. Aplicación a la pantalla de Nueva partida

La pantalla de Nueva partida deberá dividirse en pasos:

1. Personaje.
2. Mundo.
3. Reglas.
4. Confirmación.

No utilizar botones con estados visuales contradictorios para indicar el paso activo.

## 13.1 Preset del mundo

Sustituir el desplegable genérico por:

- Tarjetas.
- Carrusel.
- Selector visual.
- Miniaturas.
- Descripción de experiencia.
- Modificadores resumidos.
- Previsualización del mundo.

## 13.2 Opciones del mundo

Sustituir:

```text
Densidad NPCs: 1
Densidad animales: 1
```

por:

```text
Población:
Escasa | Equilibrada | Abundante

Fauna:
Escasa | Equilibrada | Abundante
```

Mostrar las consecuencias cuando cambie una opción.

## 13.3 Previsualización

La zona lateral o central deberá representar los cambios del mundo:

- Cantidad de población.
- Fauna.
- Recursos.
- Vegetación.
- Dificultad.
- Preset.
- Condiciones iniciales.

## 13.4 Audio

El audio debe trasladarse al menú de Ajustes.

En Nueva partida solo deben aparecer opciones que afecten a la generación o las reglas de la partida.

## 13.5 Acción final

La pantalla debe cerrarse con una acción principal inequívoca:

```text
Crear mundo
```

o:

```text
Comenzar partida
```

---

# 14. Movimiento y sensación de calidad

## 14.1 Duraciones recomendadas

| Interacción | Duración |
|---|---:|
| Hover | 80-140 ms |
| Pulsación | 80-120 ms |
| Cambio de pestaña | 160-240 ms |
| Entrada de panel | 180-280 ms |
| Tooltip | Retardo de 350-500 ms |
| Notificación | 180-300 ms |

## 14.2 Principios

- La animación debe comunicar una respuesta.
- No utilizar movimiento constante como decoración.
- Evitar animaciones lentas.
- Evitar bloqueos durante las transiciones.
- Permitir reducción de movimiento.
- No utilizar parpadeos repetitivos.
- Reservar los efectos de luz, polvo, relieve o sello para momentos importantes.

## 14.3 Audio de interfaz

El audio de UI puede inspirarse en:

- Piedra.
- Arcilla.
- Madera.
- Bronce.
- Metal suave.
- Pergamino.
- Sellos.

Evitar sonidos futuristas si no pertenecen al mundo del juego.

---

# 15. Tipografía e iconos

## 15.1 Tipografía

Utilizar:

- Una tipografía display con personalidad para títulos.
- Una tipografía sans serif muy legible para controles y cuerpo.

Tamaños orientativos en 1080p:

| Uso | Tamaño |
|---|---:|
| Título principal | 32-48 px |
| Título de sección | 20-28 px |
| Etiqueta de control | 16-20 px |
| Texto secundario | 14-16 px |
| Información auxiliar | 13-15 px |

No utilizar fuentes ornamentales para textos largos.

## 15.2 Iconos

Los iconos deberán:

- Pertenecer a la misma familia.
- Ser legibles entre 20 y 24 px.
- Tener una silueta clara.
- Compartir perspectiva.
- Compartir grosor.
- Compartir iluminación.
- Compartir paleta.
- Mantener el mismo significado en todo el juego.

---

# 16. Accesibilidad

Cumplir como referencia con WCAG 2.2 AA.

Contraste mínimo:

- Texto normal: 4,5:1.
- Texto grande: 3:1.
- Elementos interactivos: 3:1.

Requisitos:

- Navegación completa con teclado.
- Navegación completa con mando.
- Foco visible.
- Foco diferente de la selección.
- Objetivo interactivo mínimo recomendado de 44 × 44 px.
- No depender únicamente del color.
- Permitir escalado de interfaz.
- Permitir reducción de movimiento.
- Mantener legibilidad sobre fondos variables.
- Verificar que las transparencias no reduzcan el contraste.

---

# 17. Gobernanza del sistema

Mantener un único UI Kit con:

- Colores.
- Tipografías.
- Espaciados.
- Radios.
- Bordes.
- Sombras.
- Opacidades.
- Materiales.
- Iconos.
- Sonidos.
- Animaciones.
- Duraciones.
- Componentes.
- Estados.

No aprobar una pantalla si introduce un componente que:

- Duplique otro existente.
- Contradiga el sistema.
- Cambie arbitrariamente el estilo.
- Incorpore un asset de IA sin revisar.
- Utilice un control estándar del navegador.
- Rompa la jerarquía de transparencias.
- No esté incorporado al inventario.

Los prompts y referencias de IA sirven para explorar.

El resultado final siempre deberá pasar una revisión de:

- UX.
- Dirección artística.
- Legibilidad.
- Coherencia.
- Viabilidad técnica.
- Transparencia.
- Escalado.
- Estados.
- Integración con el mundo.

---

# 18. Criterios de aceptación

Antes de considerar terminada cualquier pantalla, menú, HUD o componente de interfaz, comprobar los siguientes puntos.

## 18.1 Identidad visual

- [ ] La pantalla se reconoce inmediatamente como una interfaz de videojuego.
- [ ] La interfaz no parece una página web, dashboard o formulario HTML.
- [ ] La interfaz es coherente con el resto del juego.
- [ ] La ambientación mesopotámica se transmite sin recurrir a una estética de interfaz antigua.
- [ ] El bronce y el dorado se utilizan para comunicar jerarquía y estado.
- [ ] La decoración tiene una finalidad.
- [ ] No existen ornamentos añadidos únicamente para intentar que la interfaz parezca histórica.

## 18.2 Transparencias

- [ ] La transparencia forma parte del diseño estructural.
- [ ] El HUD permite seguir viendo claramente el mundo.
- [ ] Los paneles flotantes ocupan únicamente el espacio necesario.
- [ ] No existen grandes superficies opacas sin una razón funcional.
- [ ] La información sigue siendo legible sobre terrenos claros.
- [ ] La información sigue siendo legible sobre terrenos oscuros.
- [ ] La información sigue siendo legible sobre escenarios visualmente cargados.
- [ ] Se utilizan sombras, velos o placas interiores cuando son necesarios.
- [ ] La transparencia no dificulta identificar los elementos interactivos.
- [ ] La jerarquía de opacidad es coherente entre HUD, paneles, tooltips, ventanas y modales.

## 18.3 Composición y UX

- [ ] Existe un foco visual claro.
- [ ] Existe una única acción primaria claramente identificable.
- [ ] El jugador comprende el propósito de la pantalla en menos de 2 segundos.
- [ ] Los controles relacionados están agrupados.
- [ ] No existen espacios vacíos sin intención.
- [ ] Los controles no ocupan más espacio del necesario.
- [ ] Las decisiones importantes muestran sus consecuencias.
- [ ] Cuando sea útil existe una previsualización del resultado.
- [ ] Los textos explicativos son breves.
- [ ] No se muestran mensajes internos de desarrollo al jugador.
- [ ] La pantalla funciona con ratón.
- [ ] La pantalla funciona con teclado.
- [ ] La pantalla funciona con mando.

## 18.4 Componentes

- [ ] Todos los componentes proceden del UI Kit o biblioteca oficial.
- [ ] No existen botones HTML genéricos.
- [ ] No existen checkboxes estándar.
- [ ] No existen sliders estándar.
- [ ] No existen scrollbars estándar.
- [ ] Los sliders solo se utilizan cuando un valor continuo tiene sentido.
- [ ] Las decisiones discretas emplean selectores, tarjetas o controles segmentados.
- [ ] Foco, hover, selección y pulsación son diferentes.
- [ ] Los componentes mantienen las mismas proporciones, materiales, bordes e iluminación.
- [ ] Los controles tienen un área interactiva recomendada mínima de 44 × 44 px.

## 18.5 Assets

- [ ] No se ha incorporado directamente ningún asset generado por IA.
- [ ] Los assets generados con IA han sido revisados y limpiados.
- [ ] Los fondos que deben ser transparentes utilizan transparencia real.
- [ ] No existen halos blancos o negros.
- [ ] Los bordes están correctamente definidos.
- [ ] No existe texto generado dentro de las imágenes.
- [ ] No existen símbolos artificiales sin significado.
- [ ] La iluminación es coherente.
- [ ] La perspectiva es coherente.
- [ ] Los materiales son coherentes.
- [ ] Los assets pertenecen visualmente a la misma familia.
- [ ] Los elementos escalables están preparados mediante 9-slice o equivalente.
- [ ] Los assets utilizados se encuentran registrados en la biblioteca.
- [ ] Existe un asset maestro cuando hay múltiples variantes.

---

# 19. Flujo de trabajo obligatorio para Copilot

Cuando Copilot tenga que crear o modificar una interfaz, deberá seguir este proceso.

## Paso 1. Analizar la función

Antes de generar código o assets, identificar:

- Qué está haciendo el jugador.
- Qué información necesita.
- Qué decisiones debe tomar.
- Qué acción es la principal.
- Qué información debe estar siempre visible.
- Qué información puede aparecer bajo demanda.
- Cuánto mundo debe permanecer visible.

No comenzar diseñando componentes individuales antes de resolver estos puntos.

## Paso 2. Revisar componentes existentes

Antes de crear un componente nuevo:

1. Revisar el UI Kit.
2. Revisar la biblioteca de assets.
3. Buscar componentes equivalentes.
4. Buscar variantes existentes.
5. Reutilizar siempre que sea posible.

No crear:

```text
UI_Panel_New
UI_Panel_New2
UI_Panel_Other
```

si ya existe:

```text
UI_Panel_Contextual
```

y puede adaptarse mediante parámetros o variantes.

## Paso 3. Diseñar la composición

Definir primero:

- Zonas.
- Jerarquía.
- Tamaños.
- Anclajes.
- Flujo.
- Navegación.
- Acción primaria.
- Elementos persistentes.
- Elementos contextuales.

Después definir el aspecto.

## Paso 4. Diseñar los estados

Para cada elemento interactivo definir:

```text
Default
Hover
Focus
Pressed
Selected
Disabled
Blocked
Warning
Error
Success
Cooldown
```

No considerar terminado un componente si únicamente existe su estado normal.

## Paso 5. Aplicar el lenguaje visual

Aplicar:

- Transparencia.
- Materiales.
- Paleta.
- Iluminación.
- Iconografía.
- Tipografía.
- Animaciones.
- Sonido.

Sin alterar la usabilidad definida anteriormente.

## Paso 6. Validar dentro del juego

Nunca aprobar una interfaz únicamente mediante una imagen aislada.

Probarla:

- Sobre terreno claro.
- Sobre terreno oscuro.
- Sobre edificios.
- Sobre unidades.
- Durante movimiento.
- Durante escenas con muchos elementos.
- En 1080p.
- En 1440p.
- En 4K.
- Con ratón.
- Con teclado.
- Con mando.

La interfaz debe evaluarse dentro del contexto real donde se utilizará.

---

# 20. Prompt maestro para Copilot

Utilizar el siguiente prompt como contexto base para cualquier tarea relacionada con UI:

```text
Actúa como diseñador UI/UX senior y desarrollador de interfaces de videojuegos.

Estás trabajando en un juego de estrategia y gestión ambientado en Mesopotamia.

Toda nueva interfaz debe respetar la siguiente dirección:

MATERIAL HISTÓRICO + UX CONTEMPORÁNEA + TRANSPARENCIA INTEGRADA EN EL MUNDO.

La interfaz debe parecer diseñada para un videojuego comercial moderno.

Nunca debe parecer una web, dashboard, formulario HTML o aplicación empresarial tematizada.

TRANSPARENCIA

Las transparencias constituyen uno de los principales lenguajes visuales del juego.

HUD, barras de habilidades, objetivos, accesos rápidos, minimapa y paneles contextuales deben utilizar módulos compactos y flotantes que permitan seguir viendo el mundo.

Evita grandes superficies opacas.

Utiliza como orientación:

- HUD persistente: 55-70 %
- Barras de habilidades: 60-75 %
- Ayuda rápida: 55-70 %
- Tooltip: 70-85 %
- Panel contextual: 65-80 %
- Ventana secundaria: 75-90 %
- Modal crítico: 85-95 %

No apliques estos porcentajes mecánicamente.

Ajusta la opacidad para mantener contraste y legibilidad sobre cualquier escenario.

La transparencia no consiste simplemente en utilizar rectángulos negros con opacity.

Combina cuando sea necesario:

- transparencia;
- degradado;
- material;
- sombra;
- iluminación;
- borde;
- desenfoque;
- placas interiores de lectura.

DIRECCIÓN ARTÍSTICA

Utiliza de forma sutil referencias a:

- arcilla;
- piedra;
- bronce;
- latón envejecido;
- pigmentos minerales;
- relieves;
- sellos;
- tablillas;
- mapas;
- geometría mesopotámica.

La ambientación antigua nunca debe convertirse en una interfaz anticuada.

No diseñes "una interfaz antigua".

Diseña una interfaz moderna utilizando el lenguaje material del mundo antiguo.

EVITAR

No utilizar:

- controles HTML nativos;
- botones web genéricos;
- checkboxes azules;
- selectores HTML visibles;
- scrollbars del navegador;
- sliders excesivamente largos;
- grandes paneles vacíos;
- bordes alrededor de absolutamente todo;
- dorado aplicado indiscriminadamente;
- texturas fuertes detrás del texto;
- ornamentación sin función;
- pseudoescritura histórica;
- imágenes generadas con texto incrustado;
- assets de IA sin revisar;
- estilos visuales inconsistentes entre componentes.

BIBLIOTECA DE ASSETS

Existe una biblioteca propia y versionada de assets de interfaz.

Antes de crear cualquier componente nuevo:

1. Comprueba si ya existe.
2. Reutiliza componentes existentes.
3. Genera variantes únicamente cuando sean necesarias.
4. Mantén materiales, iluminación, escala, perspectiva, bordes y opacidad coherentes.
5. Incorpora cualquier asset nuevo al inventario.

Ningún asset generado mediante IA debe incorporarse directamente al juego.

Debe pasar por:

- revisión;
- limpieza;
- eliminación de artefactos;
- transparencia;
- normalización;
- preparación de estados;
- adaptación al UI Kit;
- incorporación a la biblioteca.

Los assets deben estar libres de:

- texto incrustado;
- marcas de agua;
- halos;
- bordes defectuosos;
- símbolos incoherentes;
- perspectivas incompatibles;
- iluminación contradictoria.

Cuando corresponda, los componentes escalables deberán utilizar 9-slice o una técnica equivalente.

COMPONENTES

Todos los componentes interactivos deben contemplar:

- Default
- Hover
- Focus
- Pressed
- Selected
- Disabled
- Blocked
- Warning
- Error
- Success
- Cooldown

Focus y Selected nunca deben parecer el mismo estado.

CONTROLES

Utiliza tarjetas o selectores segmentados para valores discretos.

Ejemplo:

Población:
Escasa | Equilibrada | Abundante

No utilices un slider para este tipo de decisión.

Reserva sliders para valores realmente continuos como:

- volumen;
- brillo;
- sensibilidad;
- escala de interfaz.

Los sliders tendrán normalmente entre 280 y 520 px en 1080p.

COMPOSICIÓN

Cada pantalla debe tener:

1. una intención clara;
2. un foco visual;
3. una acción primaria;
4. una jerarquía comprensible;
5. consecuencias visibles para las decisiones importantes.

El jugador debe comprender en menos de 2 segundos cuál es la función principal de la pantalla.

No llenes automáticamente todo el ancho disponible.

El contenido operativo utilizará normalmente una zona aproximada de 960-1280 px en resoluciones 1080p/1440p.

Utiliza el espacio restante para:

- mantener visible el mundo;
- previsualizaciones;
- personajes;
- edificios;
- mapas;
- ilustración;
- ambiente visual.

HUD

El HUD debe ser ligero.

El mundo es el elemento principal de la pantalla.

La UI existe para proporcionar información y permitir acciones, no para competir visualmente con la escena.

Las barras de habilidades y accesos rápidos deben utilizar módulos flotantes translúcidos con:

- icono;
- tecla asociada;
- estado;
- cooldown;
- cantidad;
- coste cuando corresponda.

ACCESIBILIDAD

Mantén como referencia WCAG 2.2 AA.

- Texto normal: contraste mínimo 4,5:1.
- Texto grande: 3:1.
- Elementos interactivos: 3:1.
- Objetivo interactivo recomendado: mínimo 44 x 44 px.

La interfaz debe funcionar mediante:

- ratón;
- teclado;
- mando.

Focus debe ser siempre visible.

No dependas exclusivamente del color.

RESOLUCIONES

Validar como mínimo:

- 1920x1080;
- 2560x1440;
- 3840x2160;
- 16:9;
- 16:10;
- 21:9.

PROCESO

Antes de escribir código:

1. Explica brevemente el objetivo de la pantalla.
2. Identifica la acción principal.
3. Identifica qué información debe permanecer visible.
4. Comprueba qué componentes existentes pueden reutilizarse.
5. Propón la jerarquía.
6. Define los componentes necesarios.
7. Define los estados.
8. Después implementa.

No generes controles improvisados si ya existe un componente equivalente.

RESULTADO

La interfaz final debe parecer diseñada deliberadamente por un único equipo de UI/UX.

Los componentes deben parecer miembros de la misma familia.

La interfaz debe integrarse con el mundo y no cubrirlo innecesariamente.

Antes de considerar terminada una propuesta, pregúntate:

"¿Esto parece una interfaz de videojuego comercial moderno o una aplicación web tematizada?"

"¿Las transparencias forman realmente parte del diseño o simplemente he bajado la opacidad de rectángulos genéricos?"

"¿Estos componentes parecen diseñados conjuntamente o generados independientemente por IA?"

"¿Estoy reutilizando el sistema de diseño existente o creando otra variante innecesaria?"

Si alguna respuesta revela un problema, revisa la propuesta antes de implementarla.
```

---

# 21. Plantilla para solicitar una nueva pantalla a Copilot

Utilizar esta estructura:

```text
PANTALLA:
[Nombre]

OBJETIVO:
[Qué debe conseguir el jugador]

CONTEXTO:
[Desde dónde llega el jugador y qué está ocurriendo]

INFORMACIÓN OBLIGATORIA:
[Información necesaria]

DECISIONES:
[Opciones que debe poder modificar]

ACCIÓN PRINCIPAL:
[Acción dominante]

ACCIONES SECUNDARIAS:
[Volver, cancelar, ayuda...]

ELEMENTOS PERSISTENTES:
[HUD, recursos, minimapa...]

ELEMENTOS CONTEXTUALES:
[Tooltips, información de selección...]

PREVISUALIZACIÓN:
[Qué consecuencia visual deberá mostrarse]

ASSETS EXISTENTES:
[Componentes de la biblioteca que deben reutilizarse]

ASSETS NUEVOS:
[Únicamente los que realmente sea necesario crear]

NIVEL DE TRANSPARENCIA:
[HUD / panel contextual / ventana / modal]

ENTRADA:
- Ratón
- Teclado
- Mando

RESOLUCIONES:
- 1080p
- 1440p
- 4K
- 21:9

ENTREGABLE:

1. Analiza primero el flujo UX.
2. Propón la distribución.
3. Identifica componentes reutilizables.
4. Identifica únicamente los assets nuevos necesarios.
5. Define todos los estados.
6. Implementa la interfaz.
7. Comprueba las directrices generales del UI Kit.
```

---

# 22. Criterio de revisión final

Antes de aprobar visualmente cualquier interfaz, realizar estas preguntas:

> **¿Esta pantalla parece diseñada deliberadamente por el mismo equipo que diseñó el resto del juego?**

> **¿Parece una interfaz de videojuego o una aplicación web tematizada?**

> **¿Los elementos parecen diseñados como una familia o generados de forma independiente?**

> **¿La interfaz acompaña al mundo o lo tapa?**

> **¿La ambientación se expresa mediante dirección artística o simplemente mediante colores marrones y dorados?**

> **¿La transparencia ayuda a integrar la interfaz o simplemente reduce la opacidad de rectángulos genéricos?**

> **¿Se está reutilizando la biblioteca de assets o se están creando componentes innecesariamente?**

> **¿La pantalla sería reconocible como parte de este juego si eliminásemos el texto?**

Si cualquiera de estas preguntas detecta un problema evidente, el diseño deberá revisarse.

---

# 23. Principio final

A partir de ahora, todo el sistema de interfaces deberá avanzar hacia una identidad basada en:

> **TRANSPARENCIA + MUNDO VISIBLE + COMPONENTES FLOTANTES + ASSETS PROPIOS + COHERENCIA VISUAL**

Las barras de habilidades, HUD y elementos contextuales deben servir como referencia para extender este lenguaje al resto del juego.

La interfaz no debe ser una colección de imágenes generadas independientemente.

Debe existir una biblioteca controlada y limitada de:

- Materiales.
- Marcos.
- Fondos.
- Bordes.
- Iconos.
- Controles.
- Estados.
- Barras.
- Indicadores.
- Overlays.
- Animaciones.

Copilot deberá reutilizar esta biblioteca antes de crear nuevos elementos.

La IA puede utilizarse para acelerar:

- Exploración visual.
- Concept art.
- Variantes.
- Iconografía inicial.
- Texturas.
- Prototipos.

Pero la IA **no define por sí misma la dirección artística**.

La dirección artística viene determinada por:

1. Este documento.
2. El UI Kit.
3. La biblioteca de assets aprobados.
4. Las interfaces previamente aprobadas.
5. Las reglas de consistencia establecidas para el proyecto.

---

# 24. Regla fundamental del proyecto

> ## No queremos que la interfaz parezca hecha por IA.
>
> ## Queremos que parezca diseñada específicamente para este juego.

Para conseguirlo:

> **No se debe generar cada pantalla desde cero.**

Cada pantalla debe construirse utilizando:

- Un lenguaje visual común.
- Una biblioteca compartida.
- Componentes reutilizables.
- Materiales definidos.
- Transparencias coherentes.
- Estados normalizados.
- Iconografía común.
- Reglas de composición comunes.

El objetivo no es eliminar la IA del proceso.

El objetivo es utilizar la IA como herramienta de producción sin permitir que determine de forma arbitraria el resultado visual.

La IA puede ayudar a crear los elementos.

**La dirección artística debe pertenecer al juego.**

---

# 25. Resumen ejecutivo para Copilot

Si únicamente se debe recordar un conjunto reducido de reglas, utilizar las siguientes:

1. **La interfaz debe parecer de un videojuego, nunca de una web.**
2. **Ambientación antigua no significa interfaz antigua.**
3. **La transparencia es uno de los pilares visuales del proyecto.**
4. **El mundo debe permanecer visible siempre que sea razonablemente posible.**
5. **HUD y barras de habilidades deben ser compactos, flotantes y translúcidos.**
6. **Evitar grandes paneles opacos.**
7. **No utilizar controles HTML con apariencia predeterminada.**
8. **No utilizar sliders para decisiones que puedan expresarse mejor mediante opciones discretas.**
9. **No generar cada pantalla como una pieza visual independiente.**
10. **Crear y mantener una biblioteca propia de assets de interfaz.**
11. **Reutilizar los assets existentes antes de generar otros nuevos.**
12. **Toda imagen generada por IA debe revisarse, limpiarse y normalizarse antes de incorporarse al proyecto.**
13. **Los assets deben utilizar transparencias reales cuando corresponda.**
14. **Los assets no deben contener texto incrustado.**
15. **Todos los componentes deben compartir materiales, iluminación, proporciones y estados.**
16. **Focus, Hover, Selected y Pressed son estados diferentes.**
17. **La ornamentación mesopotámica debe ser sutil y funcional.**
18. **El bronce y el dorado deben indicar importancia, no cubrir toda la interfaz.**
19. **La legibilidad tiene prioridad sobre la decoración.**
20. **La interfaz debe probarse dentro del juego, no únicamente como mockup.**
21. **Debe funcionar correctamente con ratón, teclado y mando.**
22. **Debe validarse como mínimo en 1080p, 1440p, 4K y 21:9.**
23. **Cada pantalla debe tener una intención y una acción principal claras.**
24. **Las decisiones importantes deben mostrar sus consecuencias cuando sea posible.**
25. **Antes de crear un nuevo componente, comprobar si ya existe uno equivalente.**

## Dirección definitiva

**Material histórico.**

**UX contemporánea.**

**Transparencia.**

**Mundo visible.**

**Componentes flotantes.**

**Assets propios.**

**Biblioteca común.**

**Coherencia por encima de generación individual.**

**IA como herramienta, no como dirección artística.**

---

# FIN DE LAS DIRECTRICES