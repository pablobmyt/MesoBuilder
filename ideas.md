# TODO de ideas / mejoras pendientes

## Sonidos de stock para las acciones importantes (pedido)

Añadir sonidos libres de derechos (o generados) para, como mínimo:

* **Jugador**: acariciar al perro (Kidu + Adapa), montar/bajar del caballo,
  galope, comer, beber, sentarse, saludar/festejar/bailar, coger algo del suelo.
* **Mundo**: cosechar trigo, labrar con la azada, talar/romper hierbajos,
  construir/martillar, puerta al entrar en casa, cambiar de día.
* **Combate**: golpe dado, golpe recibido (con variante según la zona herida),
  muerte de un enemigo, disparo de la Makarov.
* **Interfaz**: abrir/cerrar paneles (inventario, acciones, ficha de jugador),
  aceptar/rechazar misión, subir de nivel.

Cómo encajarlo con lo que ya hay: el motor tiene `SoundManager` (Web Audio) y
`data/Sounds/`; conviene un `engine/sfx.js` con un mapa `nombre → { url, vol,
rate }`, precarga perezosa y un `playSfx('cosechar')` que se llame desde los
mismos sitios que hoy llaman a `notify()`/`fx.*`, más un ajuste de volumen y un
interruptor en Ajustes. Buscar los ficheros con licencia clara (CC0) y anotar la
procedencia en `data/Sounds/CREDITOS.md`.

## Otros pendientes

* Vista de espaldas para conejo, zorro, perro y lobo (el personaje y el caballo ya
  la tienen; son ~3 líneas por especie en `engine/animal-art.js`).
* Misiones secundarias: si el NPC acepta, marcar en el diario que fue un encargo
  "espontáneo" (hoy el aviso es genérico).
* Regar cultivos con un cubo (hoy la humedad es por cercanía al río).
