# Guardia Tracker — Contexto del proyecto

## Situación del usuario

El usuario es **conductor de grúa de asistencia en carretera en Cantabria**. Lleva pocas
semanas en la empresa y quiere registrar su jornada laboral de forma completamente objetiva.

No es una app de fichar entrada/salida: debe **reflejar la realidad del trabajo de guardias**.

### Cómo funciona su empresa

- Semanas alternas: una semana de **guardia de 12 horas** (lunes a viernes de **08:00 a
  20:00**; el viernes a las 20:00 apaga el móvil hasta el lunes a las 08:00), la siguiente
  de **guardia 24/7** (disponible las 24 horas todos los días).
- **Solo libra sábado y domingo de la semana de 12 h.** La semana 24/7 no tiene ningún día
  libre, así que el ciclo real de 14 días encadena **12 días seguidos de trabajo/guardia**
  con solo 2 de descanso. Por eso el descanso semanal se evalúa contando las guardias como
  presencia (no como descanso) y de forma **acumulada en periodos de 14 días** (ET art.
  37.1: día y medio acumulable hasta 14 días).
- Durante la guardia puede estar donde quiera, pero debe responder inmediatamente al entrar
  un aviso, a cualquier hora (madrugada, comiendo, descansando).
- Los avisos llegan por una app de la empresa que registra hora de asignación y de cierre.
- **A veces un aviso entra antes de terminar el anterior**: hay solapamientos que deben
  interpretarse correctamente y **no contarse dos veces** como tiempo efectivo.
- Además de los servicios hay desplazamientos a la base, recogidas de vehículos, esperas,
  conducción y otros trabajos que también son jornada.

### El problema real

El trabajo efectivo puede ser de 8–9 h, pero repartido en 15–16+ horas de disponibilidad,
lo que impide descansar o tener vida personal. Ejemplo real de una jornada:

- Primer aviso: 09:30 · último servicio cerrado: 01:17 del día siguiente.
- 12 servicios, más de 8,5 h de trabajo efectivo.
- **Casi 16 h desde el primer aviso hasta cerrar el último** (esto es la *amplitud de
  jornada*, métrica central de la app).

### Objetivo

Datos objetivos —no conflicto— para saber si la jornada cumple el Estatuto de los
Trabajadores y el convenio aplicable, hablar con su responsable con información precisa, y
disponer de un registro fiable y exportable para un gestor, un abogado o la Inspección de
Trabajo. También aplica el **RD 1561/1995** (jornadas especiales de trabajo: tiempos de
presencia en transporte por carretera; art. 8: máx. 20 h semanales de presencia en promedio
mensual, umbral configurable en Ajustes).

El convenio aplicable **está pendiente de confirmar** (el usuario aún no tiene el contrato).
Hay dos candidatos investigados —grúas móviles autopropulsadas de Cantabria (dudoso: ese
sector suele ser alquiler de grúas de elevación, no auxilio en carretera) y transporte de
mercancías por carretera de Cantabria— documentados con sus valores citados y una lista de
verificación en `docs/normativa.md`. Cuando se confirme, revisar los umbrales de Ajustes
contra el texto real del convenio y anotarlo aquí y en ese documento.

## Implicaciones técnicas (ya implementadas — mantener al evolucionar)

- **Local-primero**: IndexedDB (Dexie) es la fuente de verdad; Supabase es sincronización
  opcional (last-write-wins con `updatedAt` + `dirty`). La app debe funcionar 100 % offline.
- **Los solapamientos de avisos se fusionan** (unión de intervalos) al calcular horas
  efectivas y nocturnas en `src/lib/stats.ts`. Nunca sumar duraciones de avisos sin fusionar.
- **Amplitud de jornada** (`minAmplitud`): del inicio del primer aviso del día al cierre del
  último (puede cruzar medianoche). Es distinta de las horas efectivas y del tiempo de guardia.
- Las métricas por aviso (km, conducción, espera, con cliente) se atribuyen a la **fecha del
  aviso**; las métricas de tiempo (efectivas, nocturnas, guardia, descanso) se recortan al
  día natural.
- Los umbrales legales viven en `Ajustes` (configurables por convenio); el motor de alertas
  está en `src/lib/legal.ts` y **nunca emite asesoramiento jurídico** (ver `DESCARGO_LEGAL`).
- El dominio está en `src/lib` separado de la interfaz, pensado para importar avisos en el
  futuro desde la app de la empresa o desde GPS.
- Idioma de la interfaz, código y comentarios: **español**.

## Comandos

- `npm run dev` / `npm run build` / `npm run typecheck`
- `node scripts/gen-icons.mjs` regenera los iconos PWA.
- Esquema de Supabase en `supabase/schema.sql` (RLS por usuario). Si se añaden tipos de
  servicio o campos, actualizar también el `check` y el mapeo de `src/lib/sync.ts`.
