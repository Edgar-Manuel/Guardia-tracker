// Modelo de datos de Guardia Tracker.
// Todas las horas se guardan como cadenas ISO 8601 (hora local con offset).
// Las fechas de jornada se guardan como 'YYYY-MM-DD'.

export type EstadoActual = 'libre' | 'guardia' | 'servicio' | 'descanso';

export type TipoGuardia = 'guardia_12h' | 'guardia_24h' | 'otro';

export const TIPOS_GUARDIA: Record<TipoGuardia, string> = {
  guardia_12h: 'Guardia 12 h',
  guardia_24h: 'Guardia 24 h',
  otro: 'Otro',
};

export type TipoServicio =
  | 'bateria'
  | 'pinchazo'
  | 'cambio_rueda'
  | 'traslado_coche'
  | 'traslado_moto'
  | 'apertura'
  | 'combustible'
  | 'rescate'
  | 'accidente'
  | 'averia_mecanica'
  | 'otro';

export const TIPOS_SERVICIO: Record<TipoServicio, string> = {
  bateria: 'Batería',
  pinchazo: 'Pinchazo',
  cambio_rueda: 'Cambio de rueda',
  traslado_coche: 'Traslado de coche',
  traslado_moto: 'Traslado de moto',
  apertura: 'Apertura',
  combustible: 'Combustible',
  rescate: 'Rescate',
  accidente: 'Accidente',
  averia_mecanica: 'Avería mecánica',
  otro: 'Otro',
};

export type TipoDescanso = 'comida' | 'cena' | 'descanso' | 'cafe';

export const TIPOS_DESCANSO: Record<TipoDescanso, string> = {
  comida: 'Comer',
  cena: 'Cena',
  descanso: 'Descanso',
  cafe: 'Café',
};

/** Campos comunes para sincronización local-primero (last-write-wins). */
export interface BaseEntity {
  id: string;
  updatedAt: string;
  deletedAt: string | null;
  /** 1 = pendiente de subir a Supabase, 0 = sincronizado. */
  dirty: number;
}

export interface Guardia extends BaseEntity {
  fecha: string;
  inicio: string;
  fin: string | null;
  tipo: TipoGuardia;
  notas: string;
}

/** Fases cronológicas de un aviso. El orden importa para el flujo rápido. */
export const FASES_AVISO = [
  'horaAsignacion',
  'horaSalida',
  'horaLlegada',
  'horaInicioTrabajo',
  'horaFin',
  'horaDisponible',
] as const;

export type FaseAviso = (typeof FASES_AVISO)[number];

export const ETIQUETAS_FASE: Record<FaseAviso, string> = {
  horaAsignacion: 'Asignación',
  horaSalida: 'Salida',
  horaLlegada: 'Llegada al cliente',
  horaInicioTrabajo: 'Inicio del trabajo',
  horaFin: 'Finalización',
  horaDisponible: 'Disponible de nuevo',
};

export interface Aviso extends BaseEntity {
  guardiaId: string | null;
  fecha: string;
  tipo: TipoServicio;
  horaAsignacion: string | null;
  horaSalida: string | null;
  horaLlegada: string | null;
  horaInicioTrabajo: string | null;
  horaFin: string | null;
  horaDisponible: string | null;
  kmInicio: number | null;
  kmFin: number | null;
  /** Minutos; si son null se calculan a partir de las horas registradas. */
  minConduccion: number | null;
  minParado: number | null;
  minEspera: number | null;
  municipio: string;
  destino: string;
  aseguradora: string;
  observaciones: string;
  lat: number | null;
  lng: number | null;
}

export interface Descanso extends BaseEntity {
  inicio: string;
  fin: string | null;
  tipo: TipoDescanso;
  notas: string;
}

/** Umbrales legales configurables según convenio aplicable. */
export interface Ajustes {
  id: string;
  /** Horas máximas de trabajo efectivo diario (ET art. 34.3: 9 h salvo convenio). */
  maxJornadaDiaria: number;
  /** Horas semanales de trabajo efectivo en promedio (ET art. 34.1: 40 h). */
  maxSemana: number;
  /** Horas mínimas de descanso entre jornadas (ET art. 34.3: 12 h). */
  minDescansoEntreJornadas: number;
  /** Horas mínimas de descanso semanal ininterrumpido (ET art. 37.1: día y medio = 36 h). */
  minDescansoSemanal: number;
  /** Inicio del periodo nocturno (ET art. 36.1: 22:00). Formato 'HH:MM'. */
  inicioNocturno: string;
  /** Fin del periodo nocturno (ET art. 36.1: 06:00). Formato 'HH:MM'. */
  finNocturno: string;
  /** Máximo de horas extraordinarias al año (ET art. 35.2: 80 h). */
  maxHorasExtraAnuales: number;
  /** Minutos mínimos de pausa en jornada continuada de más de 6 h (ET art. 34.4: 15 min). */
  minPausaJornadaContinuada: number;
  convenioNombre: string;
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  id: 'ajustes',
  maxJornadaDiaria: 9,
  maxSemana: 40,
  minDescansoEntreJornadas: 12,
  minDescansoSemanal: 36,
  inicioNocturno: '22:00',
  finNocturno: '06:00',
  maxHorasExtraAnuales: 80,
  minPausaJornadaContinuada: 15,
  convenioNombre: '',
};

export type Severidad = 'info' | 'aviso' | 'grave';

export interface AlertaLegal {
  fecha: string;
  severidad: Severidad;
  titulo: string;
  detalle: string;
  referencia: string;
}
