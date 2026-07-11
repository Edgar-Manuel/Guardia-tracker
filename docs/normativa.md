# Normativa aplicable — PENDIENTE DE VERIFICACIÓN

> ⚠️ **Estado: sin verificar.** Este documento recoge el resultado de una investigación
> hecha con un asistente de IA con búsqueda web (julio de 2026). **Ninguna cita ha sido
> contrastada aún con el BOC/BOE ni con el contrato de trabajo.** Antes de usar estos
> datos frente a la empresa, un gestor o la Inspección, verificar cada punto con la
> lista de comprobación del final. La app usa umbrales configurables en Ajustes
> precisamente porque esto puede cambiar.

## Convenio colectivo: dos candidatos

### Candidato A — Grúas móviles autopropulsadas (Cantabria)

- Denominación citada: «Convenio Colectivo de Sector para Empresas Alquiladoras de
  Grúas Móviles Autopropulsadas (C.A. Cantabria)».
- Código citado: 39003275012008 · BOC 25/05/2018 (nº 102) · vigencia 1/1/2018–31/12/2020,
  presuntamente en ultraactividad.
- ⚠️ **Duda razonable**: el sector de «grúas móviles autopropulsadas» suele ser el de
  **alquiler de grúas de elevación** (construcción/industria), no el de asistencia en
  carretera. La afirmación de que incluye el auxilio en carretera necesita verificación
  expresa (mirar el artículo de ámbito funcional del convenio).

### Candidato B — Transporte de mercancías por carretera (Cantabria)

- Denominación citada: «Convenio Colectivo del Transporte de Mercancías por Carretera
  de Cantabria» · CVE-2025-5674 · BOC 30/06/2025 (nº 124) · vigencia 1/1/2025–31/12/2027.
- Cubre actividades principales y auxiliares del transporte de mercancías en Cantabria.
  Históricamente, muchas empresas de grúas de asistencia encajan aquí.

**Cómo salir de dudas**: el convenio aplicable figura obligatoriamente en el contrato de
trabajo y suele aparecer en la cabecera de la nómina. Esa es la fuente definitiva.

## Valores citados del convenio de grúas (si resultara aplicable)

Sin verificar; anotados para contraste futuro:

- Jornada: 40 h semanales de trabajo efectivo en cómputo anual; 8 h diarias efectivas
  garantizadas.
- Descanso entre jornadas: 12 h mínimas.
- Tiempo de presencia: máx. 20 h semanales de promedio mensual, retribuidas al menos
  como hora ordinaria (coincide con RD 1561/1995 art. 8).
- Guardia localizada (art. 24 citado): plus fijo de 110,25 €/mes (150 €/mes si incluye
  festivos señalados: 24, 25 y 31 dic; 1, 5 y 6 ene). No computa como trabajo efectivo.
- Nocturnidad (art. 25 citado): +25 % sobre hora ordinaria entre 22:00 y 06:00; plus de
  pernocta de 12 €/noche fuera de la localidad.
- Sábados: +20 % sobre hora ordinaria; domingos/festivos: +20 % más 4,66 €/hora.
- Horas extraordinarias: las que excedan de la jornada máxima anual; voluntarias;
  liquidación mensual.

## RD 1561/1995 (jornadas especiales — transporte por carretera)

- Art. 8: distingue trabajo efectivo y **tiempo de presencia**; presencia limitada a
  **20 h semanales de promedio en un mes**; no computa como jornada ni como horas
  extraordinarias; se retribuye al menos como hora ordinaria. → Implementado en la app
  (alerta «Tiempo de presencia semanal superior al permitido», umbral en Ajustes).
- Art. 9 (citado): descanso entre jornadas reducible a **10 h** en el sector, y descanso
  semanal de día y medio **acumulable por periodos de hasta cuatro semanas**. ⚠️ Verificar
  el texto exacto y sus condiciones de compensación antes de tocar los umbrales de la app
  (que hoy usan los generales del ET: 12 h y 14 días).

## Estatuto de los Trabajadores (valores generales que usa la app por defecto)

- Art. 34.1: 40 h semanales de promedio anual.
- Art. 34.3: 12 h entre jornadas; 9 h diarias efectivas salvo convenio.
- Art. 34.4: pausa de 15 min en jornada continuada de más de 6 h.
- Art. 35.2: máx. 80 h extraordinarias/año.
- Art. 36.1: periodo nocturno 22:00–06:00; trabajador nocturno máx. 8 h/día de promedio
  en 15 días y sin horas extraordinarias.
- Art. 37.1: descanso semanal de día y medio ininterrumpido, acumulable hasta 14 días.

## Jurisprudencia sobre guardias (para contexto, no implementable como regla fija)

- TJUE *Matzak* (C-518/15, 2018): la guardia es tiempo de trabajo si el trabajador debe
  permanecer en un lugar determinado por la empresa con plazo de respuesta muy breve.
- TJUE *Radiotelevizija Slovenija* (C-344/19) y *Stadt Offenbach* (C-580/19), 2021: lo
  decisivo es si las limitaciones impuestas (plazo de respuesta, frecuencia de avisos)
  afectan **objetiva y muy significativamente** a la capacidad de administrar el tiempo
  libre; si no, la guardia localizada es descanso a efectos de la Directiva 2003/88.
- TS (sentencia de 2023 citada, sin referencia completa): guardias telefónicas no
  presenciales sin lugar fijo ni respuesta inmediata no son tiempo de trabajo. ⚠️ Falta
  la referencia ECLI/número de recurso para poder citarla.
- Aplicación al caso: la obligación de **respuesta inmediata** y la **frecuencia real de
  los avisos** (que la app registra: nº de avisos, amplitud, huecos entre avisos) son
  exactamente los datos que la jurisprudencia considera para calificar la guardia. El
  registro objetivo de la app es la evidencia relevante en cualquiera de los dos sentidos.

## Lista de comprobación para verificar (cuando llegue el contrato)

1. [ ] Contrato o nómina: nombre y código exactos del convenio aplicable.
2. [ ] Buscar el convenio en el BOC (boc.cantabria.es) o REGCON y leer su **ámbito
       funcional**: ¿incluye asistencia/auxilio en carretera?
3. [ ] Contrastar los valores de la tabla de Ajustes de la app con los artículos reales:
       jornada diaria/anual, descansos, presencia, nocturnidad, guardias.
4. [ ] Confirmar el texto vigente del RD 1561/1995 arts. 8 y 9 (boe.es, texto consolidado).
5. [ ] Anotar en `CLAUDE.md` el convenio confirmado y actualizar los umbrales de Ajustes.

---

*Este documento no constituye asesoramiento jurídico. Ver `DESCARGO_LEGAL` en la app.*
