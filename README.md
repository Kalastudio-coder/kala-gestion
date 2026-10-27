# Kala Gestión

Programa de escritorio (Windows) para manejar los clientes de marketing de Kala Studio: servicios,
cuánto y cada cuánto paga cada uno, vencimientos, atrasados, historial de cobros, recibos, gastos y el
calendario de contenido de cada cliente.

Electron + React + Tailwind v4. Los datos quedan sólo en la compu, en `%APPDATA%\Kala Gestión\datos.json`,
con una copia automática por día en la carpeta `copias` (se guardan las últimas 30).

## Cómo funciona

- Cada **servicio** tiene un monto, una frecuencia (semanal, quincenal, mensual, cada 2, 3 o 6 meses,
  anual o pago único) y un primer vencimiento. Los vencimientos se calculan solos (`src/lib/billing.ts`).
- Un **pago** se asocia a un vencimiento. Se aceptan pagos parciales; un vencimiento sin pagar y con la
  fecha pasada aparece como atrasado.
- Si cambiás el monto de un servicio, también cambian los vencimientos viejos que no están pagados.
  Para un aumento, conviene terminar el servicio y crear otro desde la fecha nueva.

## Calendario de contenido

Cada cliente tiene una pestaña **Calendario de contenido** con la grilla del mes. Cada publicación tiene
fecha, título y copy. También se puede cargar desde afuera con `scripts/contenido.cjs` (así lo hace Claude
Code; ver `CLAUDE.md`). Si la app está abierta, los cambios aparecen solos.

**Exportar y enviar** genera un PDF del mes (portada, grilla, copys y resumen) en
`Documentos\Kala Gestión\Calendarios`. Después abre el chat de WhatsApp del cliente con un mensaje listo y deja
el PDF copiado, para pegarlo con Ctrl+V (WhatsApp no deja adjuntar archivos desde un link).

Cada cliente puede tener un **plan de contenido mensual** (por ejemplo 8 placas, 6 reels y 7 efemérides o promos).
El calendario muestra el avance del mes según el tipo que va al principio del título ("Reel: …"). Cada publicación
tiene su **aprobación**: pendiente, aprobada o con cambios (con lo que pidió el cliente).

## Cobros, gastos y recibos

- **Aumentos:** "Aumentar precios" aplica un porcentaje desde una fecha a uno o varios servicios. Los vencimientos
  anteriores mantienen su precio (`priceChanges` en cada servicio).
- **Gastos por cliente:** únicos o mensuales. La ficha y el inicio muestran la ganancia del mes (cobrado − gastos).
- **Recibos:** desde el historial de pagos o al registrar un cobro. Numeración correlativa; los datos del encabezado
  se cargan en Ajustes. Se guardan en `Documentos\Kala Gestión\Recibos`.

## Avisos, copias y actualizaciones

- **Avisos de Windows**, una vez por día desde las 8: lo que vence, lo atrasado, lo que se publica y lo que sale
  mañana sin aprobar. Con los avisos prendidos, cerrar la ventana deja la app en la bandeja. Puede arrancar
  escondida al prender la compu (`--oculto`).
- **Copia en la nube:** en Ajustes se elige una carpeta de Google Drive u OneDrive; cada día se guarda ahí
  `Kala Gestión\datos-AAAA-MM-DD.json` (las últimas 30).
- **Actualizaciones automáticas** con `electron-updater` desde los releases de GitHub
  (`Kalastudio-coder/kala-gestion`). Para publicar una versión: subir `version` en `package.json`, `npm run dist` y
  crear el release `vX.Y.Z` con `release/Kala-Gestion-Setup-X.Y.Z.exe`, su `.blockmap` y `latest.yml`.

## Comandos

- `npm run dev`: interfaz en el navegador (guarda en localStorage), en http://localhost:5173
- `npm run dev:app`: compila y abre la app de escritorio
- `npm run dist`: genera el instalador en `release/Kala-Gestion-Setup-<versión>.exe`
- `node scripts/make-icon.cjs`: vuelve a generar `build/icon.png`

Para publicar una versión nueva, subí `version` en `package.json` y corré `npm run dist`. Al instalar
encima, los datos se mantienen.
