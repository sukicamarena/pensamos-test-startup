// Tipos para el módulo de conflictos de pandunesiosss
// Gestiona el flujo completo cuando una pareja activa el botón "Estoy Enojado/a"

// ─── Enums ────────────────────────────────────────────────────────────────────

/** Estado actual del conflicto entre la pareja */
export enum EstadoConflicto {
  ACTIVO = "ACTIVO",                     // Al menos uno presionó el botón
  RECONCILIANDOSE = "RECONCILIANDOSE",   // Se están enviando recuerdos
  RESUELTO = "RESUELTO",                 // Ambos marcaron que ya están bien
  EXPIRADO = "EXPIRADO",                 // Pasaron 24h sin resolución
}

/** Quién dentro de la pareja activó o respondió al conflicto */
export enum RolEnConflicto {
  INICIADOR = "INICIADOR",   // Quien presionó primero el botón
  RECEPTOR = "RECEPTOR",     // La pareja que recibió la notificación
}

/** Tipo de recuerdo que se envía durante la reconciliación */
export enum TipoRecuerdo {
  FOTO = "FOTO",
  VIDEO = "VIDEO",
  MENSAJE_TEXTO = "MENSAJE_TEXTO",
  AUDIO = "AUDIO",
  LUGAR = "LUGAR",           // Un lugar especial que visitaron juntos
  FECHA_ESPECIAL = "FECHA_ESPECIAL",
}

/** Nivel de intensidad del enojo reportado por el usuario */
export enum NivelEnojo {
  LEVE = 1,       // "Estoy un poco molesto/a"
  MODERADO = 2,   // "Estoy enojado/a"
  INTENSO = 3,    // "Estoy muy enojado/a"
  MAXIMO = 4,     // "Necesito espacio por ahora"
}

/** Canal por donde se entrega el recuerdo */
export enum CanalEntrega {
  PUSH_NOTIFICATION = "PUSH_NOTIFICATION",
  IN_APP = "IN_APP",
  EMAIL = "EMAIL",
  SMS = "SMS",
}

// ─── Interfaces base ──────────────────────────────────────────────────────────

/** Coordenadas geográficas de un lugar especial */
export interface Coordenadas {
  latitud: number;
  longitud: number;
  nombreLugar?: string;
}

/** Metadatos de un archivo multimedia en el recuerdo */
export interface MetadatosArchivo {
  urlOriginal: string;
  urlMiniatura?: string;
  duracionSegundos?: number;  // Para video y audio
  anchoPixeles?: number;
  altoPixeles?: number;
  tamanoBytes: number;
  formatoMime: string;
}

// ─── Recuerdos ────────────────────────────────────────────────────────────────

/** Un recuerdo compartido por la pareja usado para la reconciliación */
export interface Recuerdo {
  id: string;
  parejaId: string;
  creadoPor: string;            // userId de quien subió el recuerdo
  tipo: TipoRecuerdo;
  titulo: string;
  descripcion?: string;
  fechaDelRecuerdo: Date;
  fechaCreacion: Date;
  archivo?: MetadatosArchivo;
  lugar?: Coordenadas;
  etiquetas: string[];          // Ej: ["primer viaje", "cumpleaños", "sorpresa"]
  esFavorito: boolean;
  vecesUsadoEnConflicto: number;
}

/** Recuerdo enriquecido con un mensaje de amor generado para el conflicto */
export interface RecuerdoConMensaje {
  recuerdo: Recuerdo;
  mensajeDeAmor: string;        // Generado automáticamente o seleccionado
  mensajePersonalizado?: string; // Si el usuario quiso añadir algo propio
  generadoPorIA: boolean;
}

// ─── Conflicto principal ──────────────────────────────────────────────────────

/** Registro de quién presionó el botón y cuándo */
export interface AccionEnConflicto {
  usuarioId: string;
  rol: RolEnConflicto;
  nivelEnojo: NivelEnojo;
  notaOpcional?: string;        // "No me gustó cuando dijiste..."
  timestampAccion: Date;
  dispositivoId: string;
  ubicacion?: Coordenadas;
}

/** Entrega de un recuerdo durante un conflicto activo */
export interface EntregaRecuerdo {
  id: string;
  conflictoId: string;
  recuerdoConMensaje: RecuerdoConMensaje;
  destinatarioId: string;
  canal: CanalEntrega;
  timestampEnvio: Date;
  timestampVisto?: Date;
  reaccion?: ReaccionARecuerdo;
}

/** Reacción emocional del receptor al ver el recuerdo */
export interface ReaccionARecuerdo {
  emoji: string;                // "❤️" | "😢" | "🥺" | "😊"
  mensaje?: string;
  timestampReaccion: Date;
  inicioReconciliacion: boolean; // Si esta reacción marcó un cambio positivo
}

/** Configuración de la cadencia de envío de recuerdos */
export interface CadenciaEnvio {
  intervaloMinutosInicial: number;   // Cada cuántos minutos enviar el primero
  intervaloMinutosSubsecuente: number;
  maxRecuerdosTotal: number;
  pausarSiHayReaccionPositiva: boolean;
  horasHastaExpiracion: number;
}

/** El conflicto completo de una pareja */
export interface Conflicto {
  id: string;
  parejaId: string;
  estado: EstadoConflicto;
  accionIniciador: AccionEnConflicto;
  accionReceptor?: AccionEnConflicto;   // Puede no haber presionado el botón aún
  recuerdosEntregados: EntregaRecuerdo[];
  cadenciaConfigurada: CadenciaEnvio;
  timestampInicio: Date;
  timestampResolucion?: Date;
  timestampExpiracion: Date;
  ambosResueltosManualmente: boolean;
  puntuacionPostConflicto?: PuntuacionPostConflicto;
  metadatos: MetadatosConflicto;
}

// ─── Post-conflicto ───────────────────────────────────────────────────────────

/** Valoración que da la pareja después de reconciliarse */
export interface PuntuacionPostConflicto {
  usuarioId: string;
  conflictoId: string;
  ayudaronLosRecuerdos: boolean;
  estrellas: 1 | 2 | 3 | 4 | 5;
  comentario?: string;
  recuerdoFavoritoId?: string;   // El que más los ayudó a calmarse
  timestampValoracion: Date;
}

/** Estadísticas de los conflictos de una pareja */
export interface EstadisticasConflictos {
  parejaId: string;
  totalConflictos: number;
  conflictosResueltos: number;
  conflictosExpirados: number;
  tiempoPromedioResolucionMinutos: number;
  recuerdoMasEfectivo?: Recuerdo;
  racha actual SinConflictos: number;    // Días sin conflictos activos
  mesConMasConflictos?: string;          // "2024-03"
  tasaReconciliacion: number;            // 0.0 - 1.0
  ultimaActualizacion: Date;
}

/** Datos internos para tracking y analytics del conflicto */
export interface MetadatosConflicto {
  versionApp: string;
  plataformaIniciador: "ios" | "android" | "web";
  plataformaReceptor?: "ios" | "android" | "web";
  recuerdosDisponiblesAlMomento: number;
  seCanceloPorBloqueoUsuario: boolean;
  flagRevisarPorSoporte: boolean;
}

// ─── DTOs de entrada ──────────────────────────────────────────────────────────

/** Payload cuando un usuario presiona el botón "Estoy Enojado/a" */
export interface ActivarConflictoDTO {
  usuarioId: string;
  parejaId: string;
  nivelEnojo: NivelEnojo;
  notaOpcional?: string;
  dispositivoId: string;
  ubicacion?: Coordenadas;
  versionApp: string;
  plataforma: "ios" | "android" | "web";
}

/** Payload para marcar que el usuario ya se reconcilió */
export interface MarcarReconciladoDTO {
  usuarioId: string;
  conflictoId: string;
  puntuacion?: Omit<PuntuacionPostConflicto, "usuarioId" | "conflictoId" | "timestampValoracion">;
}

/** Payload para agregar un nuevo recuerdo a la bóveda de la pareja */
export interface CrearRecuerdoDTO {
  parejaId: string;
  creadoPor: string;
  tipo: TipoRecuerdo;
  titulo: string;
  descripcion?: string;
  fechaDelRecuerdo: Date;
  archivo?: Omit<MetadatosArchivo, "urlMiniatura">;
  lugar?: Coordenadas;
  etiquetas?: string[];
  esFavorito?: boolean;
}

/** Payload para reaccionar a un recuerdo recibido */
export interface ReaccionarARecuerdoDTO {
  usuarioId: string;
  entregaRecuerdoId: string;
  emoji: string;
  mensaje?: string;
}

// ─── DTOs de respuesta ────────────────────────────────────────────────────────

/** Respuesta al activar el botón de conflicto */
export interface RespuestaActivarConflicto {
  conflicto: Conflicto;
  primerRecuerdoEnviado?: EntregaRecuerdo;
  mensajeParaUsuario: string;    // "Hemos avisado a tu pareja y estamos enviando recuerdos ❤️"
  proximoEnvioEn?: number;       // Minutos hasta el siguiente recuerdo
}

/** Vista resumida del estado actual del conflicto */
export interface ResumenConflictoActivo {
  conflictoId: string;
  estado: EstadoConflicto;
  iniciadoHace: number;             // Minutos desde el inicio
  recuerdosEnviados: number;
  parejaYaRespondio: boolean;
  ultimoRecuerdo?: EntregaRecuerdo;
  proximoRecuerdoEn?: number;       // Minutos
  puedeMarcarseComoResuelto: boolean;
}

// ─── Eventos del sistema ──────────────────────────────────────────────────────

/** Eventos que emite el módulo de conflictos al resto del sistema */
export type EventoConflicto =
  | { tipo: "CONFLICTO_INICIADO"; payload: Conflicto }
  | { tipo: "PAREJA_TAMBIEN_ENOJADA"; payload: { conflictoId: string; accion: AccionEnConflicto } }
  | { tipo: "RECUERDO_ENTREGADO"; payload: EntregaRecuerdo }
  | { tipo: "RECUERDO_VISTO"; payload: { entregaId: string; timestamp: Date } }
  | { tipo: "REACCION_REGISTRADA"; payload: { entregaId: string; reaccion: ReaccionARecuerdo } }
  | { tipo: "USUARIO_SE_RECONCILIO"; payload: { conflictoId: string; usuarioId: string } }
  | { tipo: "CONFLICTO_RESUELTO"; payload: Conflicto }
  | { tipo: "CONFLICTO_EXPIRADO"; payload: { conflictoId: string; parejaId: string } };

// ─── Guards de tipo ───────────────────────────────────────────────────────────

/** Verifica si un conflicto está activo y puede recibir acciones */
export const esConflictoActivo = (conflicto: Conflicto): boolean =>
  conflicto.estado === EstadoConflicto.ACTIVO ||
  conflicto.estado === EstadoConflicto.RECONCILIANDOSE;

/** Verifica si ambos miembros de la pareja presionaron el botón */
export const ambosEnojados = (conflicto: Conflicto): boolean =>
  conflicto.accionIniciador !== undefined && conflicto.accionReceptor !== undefined;

/** Verifica si un recuerdo ya fue usado recientemente (evitar repetición) */
export const recuerdoUsadoRecientemente = (
  recuerdo: Recuerdo,
  umbralUsos: number = 3
): boolean => recuerdo.vecesUsadoEnConflicto >= umbralUsos;