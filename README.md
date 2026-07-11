# Guardia Tracker

Aplicación web (PWA) para trabajadores de asistencia en carretera (grúas): registra de forma
exhaustiva la jornada laboral y genera informes comparables con el Estatuto de los Trabajadores
y el convenio aplicable.

## Qué registra

- **Guardias**: fecha, hora de inicio y fin, tipo (12 h, 24 h u otro).
- **Avisos**: cronología completa (asignación → salida → llegada → inicio del trabajo →
  finalización → disponible), tipo de servicio (batería, pinchazo, cambio de rueda, traslados,
  apertura, combustible, rescate, accidente, avería mecánica…), kilómetros, tiempos de
  conducción/parado/espera, municipio, destino, aseguradora, ubicación GPS opcional y
  observaciones.
- **Descansos**: comer, cena, descanso y café, con inicio y fin.

## Funciones

- **Pantalla principal** con hora actual, estado (libre / en guardia / en servicio /
  descansando), temporizador en tiempo real, flujo de un toque para sellar cada fase del aviso
  y resumen del día.
- **Estadísticas** por día, semana y mes: horas efectivas, **amplitud de jornada** (del
  primer aviso al cierre del último, la métrica que refleja la disponibilidad real de las
  guardias), tiempo de guardia, nº de avisos, medias, horas nocturnas, exceso de jornada,
  conducción, tiempo con clientes, esperas, descansos y kilómetros. Gráficos interactivos.
  Los avisos solapados (uno entra antes de cerrar el anterior) se fusionan para no contar
  el tiempo dos veces.
- **Calendario** mensual con detalle por día (avisos, horas, mapa si hay ubicación, alertas).
- **Alertas legales automáticas** (sin asesoramiento jurídico): jornadas superiores a las
  permitidas, amplitud de jornada elevada, descansos insuficientes entre jornadas y
  semanales, pausas insuficientes, jornadas nocturnas y horas extraordinarias acumuladas.
  Umbrales configurables según convenio en Ajustes (por defecto, Estatuto de los
  Trabajadores arts. 34–37; tiempos de presencia: RD 1561/1995).
- **Informes PDF** con calendario, resúmenes diario/semanal/mensual, gráfico, tabla completa de
  avisos, descansos, horas nocturnas y extraordinarias e incidencias detectadas.
- **Exportación** a PDF, Excel, CSV y JSON.
- **Offline primero**: todos los datos se guardan en el dispositivo (IndexedDB) y la app
  funciona sin conexión (service worker). Si se configura Supabase, sincroniza automáticamente
  al volver la conexión (last-write-wins) y permite copia de seguridad multi-dispositivo con
  Supabase Auth.
- **PWA instalable** en Android e iPhone, con tema claro y oscuro.

## Tecnología

Next.js (App Router) · React · TypeScript · Tailwind CSS · Dexie (IndexedDB) ·
Supabase (PostgreSQL + Auth) · Recharts · jsPDF · SheetJS.

## Puesta en marcha

```bash
npm install
npm run dev
```

La app funciona sin configuración adicional en **modo local** (los datos no salen del
dispositivo).

### Sincronización en la nube (opcional)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ejecuta `supabase/schema.sql` en el editor SQL del proyecto.
3. Copia `.env.example` a `.env.local` y rellena `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Inicia sesión desde **Ajustes → Cuenta y sincronización**.

### Producción

```bash
npm run build
npm start
```

## Estructura

```
src/
  app/            Páginas (inicio, avisos, guardias, descansos, estadísticas,
                  calendario, informes, ajustes)
  components/     Interfaz compartida (shell, gráficos, fichas)
  lib/            Dominio: tipos, BD local, sincronización, estadísticas,
                  motor legal, exportaciones, PDF
supabase/         Esquema SQL con RLS
public/           Manifest PWA, service worker e iconos
scripts/          Generador de iconos
```

El dominio está separado de la interfaz (`src/lib`) para poder añadir en el futuro
importación automática de avisos desde aplicaciones de asistencia o GPS sin tocar las
pantallas.

## Aviso

Las alertas se calculan automáticamente a partir de los datos registrados y de los umbrales
configurados. Tienen carácter meramente informativo y **no constituyen asesoramiento
jurídico**.
