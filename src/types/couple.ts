// Tipos principales para el módulo de parejas en pandunesiosss
// Define las estructuras de datos para gestionar relaciones, estados emocionales y memorias compartidas

// ============================================================
// ENUMS
// ============================================================

/** Estado emocional actual de un miembro de la pareja */
export enum EstadoEmocional {
  FELIZ = "FELIZ",
  ENOJADO = "ENOJADO",
  TRISTE = "TRISTE",
  NEUTRAL = "NEUTRAL",
  ENAMORADO = "ENAMORADO",
}

/** Estado general de la relación de pareja */
export enum EstadoRelacion {
  ACTIVA = "ACTIVA",
  EN_PELEA = "EN_PELEA",
  RECONCILIADOS = "RECONCILIADOS",
  PAUSADA = "PAUSADA",
  TERMINADA = "TERMINADA",
}

/** Estado de la invitación para formar una pareja */
export enum EstadoInvitacion {
  PENDIENTE = "PENDIENTE",
  ACEPTADA = "ACEPTADA",
  RECHAZADA = "RECHAZADA",
  EXPIRADA = "EXPIRADA",
}

/** Tipo de recuerdo compartido entre la pareja */
export enum TipoRecuerdo {
  FOTO = "FOTO",
  VIDEO = "VIDEO",
  NOTA_DE_AMOR = "NOTA_DE_AMOR",
  FECHA_ESPECIAL = "FECHA_ESPECIAL",
  UBICACION = "UBICACION",
  AUDIO = "AUDIO",
}

/** Canal por el que se envió la notificación de reconciliación */
export enum CanalNotificacion {
  PUSH = "PUSH",
  EMAIL = "EMAIL",
  SMS = "SMS",
  IN_APP = "IN_APP",
}

// ============================================================
// INTERFACES BASE
// ============================================================

/** Información básica de un usuario dentro del contexto de pareja */
export interface MiembroPareja {
  /** ID único del usuario en el sistema */
  usuarioId: string;
  /** Nombre para mostrar dentro de la relación */
  nombreMostrado: string;
  /** URL del avatar del usuario */
  avatarUrl: string | null;
  /** Fecha en que se unió a la plataforma */
  miembroDesde: Date;
  /** Estado emocional actual del miembro */
  estadoEmocional: EstadoEmocional;
  /** Fecha y hora del último cambio de estado emocional */
  ultimoCambioEstado: Date | null;
  /** Indica si el miembro tiene notificaciones push activas */
  notificacionesActivas: boolean;
  /** Token de dispositivo para envío de notificaciones push */
  tokenDispositivo: string | null;
}

/** Configuración de notificaciones y recordatorios para la pareja */
export interface ConfiguracionPelea {
  /** Minutos de espera antes de enviar el primer recuerdo tras marcar enojo */
  minutosEsperaInicial: number;
  /** Intervalo en minutos entre cada recuerdo enviado durante la pelea */
  intervaloEnvioRecuerdos: number;
  /** Número máximo de recuerdos a enviar por evento de pelea */
  maxRecuerdosPorPelea: number;
  /** Incluir mensajes de amor predefinidos de pandunesiosss */
  incluirMensajesPredefinidos: boolean;
  /** Incluir recuerdos personales de la pareja (fotos, notas) */
  incluirRecuerdosPersonales: boolean;
  /** Canales habilitados para recibir las notificaciones */
  canalesHabilitados: CanalNotificacion[];
  /** Activar modo suave: mensajes más calmados para peleas intensas */
  modoSuaveActivo: boolean;
}

/** Recuerdo compartido entre la pareja */
export interface Recuerdo {
  /** ID único del recuerdo */
  recuerdoId: string;
  /** ID de la pareja a la que pertenece */
  parejaId: string;
  /** Usuario que subió o creó el recuerdo */
  creadoPor: string;
  /** Tipo de contenido del recuerdo */
  tipo: TipoRecuerdo;
  /** URL del contenido multimedia del recuerdo */
  contenidoUrl: string | null;
  /** Texto de amor o descripción del recuerdo */
  mensajeAsociado: string | null;
  /** Título breve del recuerdo */
  titulo: string;
  /** Fecha real del recuerdo (no necesariamente cuando se subió) */
  fechaRecuerdo: Date;
  /** Fecha en que se subió a la plataforma */
  creadoEn: Date;
  /** Indica si este recuerdo es favorito para usar durante peleas */
  esFavoritoParaPelea: boolean;
  /** Etiquetas para categorizar el recuerdo */
  etiquetas: string[];
  /** Veces que este recuerdo fue enviado durante peleas */
  vecesEnviado: number;
}

/** Mensaje de amor predefinido o personalizado */
export interface MensajeDeAmor {
  /** ID único del mensaje */
  mensajeId: string;
  /** Texto completo del mensaje */
  texto: string;
  /** Indica si fue creado por pandunesiosss (true) o por la pareja (false) */
  esPredefinido: boolean;
  /** ID de la pareja si es personalizado */
  parejaId: string | null;
  /** Usuario que creó el mensaje (si es personalizado) */
  creadoPor: string | null;
  /** Categoría del mensaje para selección inteligente */
  categoria: "ROMANTICO" | "CHISTOSO" | "TIERNO" | "RECONOCIMIENTO" | "DISCULPA";
  /** Veces que fue usado en reconciliaciones */
  vecesUsado: number;
  /** Fecha de creación */
  creadoEn: Date;
}

/** Evento de pelea registrado en el sistema */
export interface EventoPelea {
  /** ID único del evento */
  peleaId: string;
  /** ID de la pareja involucrada */
  parejaId: string;
  /** ID del usuario que presionó el botón de enojo primero */
  iniciadoPor: string;
  /** Fecha y hora en que se inició la pelea */
  iniciadoEn: Date;
  /** Fecha y hora en que se marcó la reconciliación */
  reconciliadoEn: Date | null;
  /** Duración total de la pelea en minutos */
  duracionMinutos: number | null;
  /** Si el otro miembro también marcó enojo */
  ambosMarcaron: boolean;
  /** Fecha en que el segundo miembro marcó enojo */
  segundoMiembroMarcoEn: Date | null;
  /** Recuerdos enviados durante este evento de pelea */
  recuerdosEnviados: RecuerdoEnviado[];
  /** Indica si la pelea fue resuelta exitosamente */
  resuelta: boolean;
  /** Nota privada opcional sobre la reconciliación */
  notaReconciliacion: string | null;
}

/** Registro de un recuerdo enviado durante una pelea */
export interface RecuerdoEnviado {
  /** ID del recuerdo enviado */
  recuerdoId: string;
  /** ID del mensaje de amor enviado junto al recuerdo */
  mensajeDeAmorId: string | null;
  /** Fecha y hora de envío */
  enviadoEn: Date;
  /** Destinatario del recuerdo */
  enviadoA: string;
  /** Canal por el que fue enviado */
  canal: CanalNotificacion;
  /** Si el destinatario abrió o vio el recuerdo */
  fueVisto: boolean;
  /** Fecha en que fue visto */
  vistoEn: Date | null;
  /** Si el recuerdo generó una reacción positiva (se presionó reconciliar tras verlo) */
  generóReconciliacion: boolean;
}

/** Estadísticas de la pareja para análisis y gamificación */
export interface EstadisticasPareja {
  /** Total de peleas registradas */
  totalPeleas: number;
  /** Total de peleas resueltas */
  totalPeleasResueltas: number;
  /** Porcentaje de peleas resueltas con éxito */
  tasaReconciliacion: number;
  /** Duración promedio de las peleas en minutos */
  duracionPromedioPeleaMinutos: number;
  /** Pelea más larga en minutos */
  peleaMasLargaMinutos: number;
  /** Total de recuerdos subidos a la plataforma */
  totalRecuerdosSubidos: number;
  /** Recuerdo que más ha contribuido a reconciliaciones */
  recuerdoMasEfectivo: string | null;
  /** Días consecutivos sin peleas (racha actual) */
  rachaDiasSinPelea: number;
  /** Racha máxima de días sin peleas */
  rachaMáximaDiasSinPelea: number;
  /** Fecha de la última pelea */
  ultimaPeleaEn: Date | null;
  /** Mes con más peleas históricamente */
  mesMasPeleador: number | null;
}

/** Aniversario o fecha especial de la pareja */
export interface FechaEspecial {
  /** ID único de la fecha */
  fechaId: string;
  /** ID de la pareja */
  parejaId: string;
  /** Nombre de la fecha especial */
  nombre: string;
  /** Fecha a recordar (mes y día se usan para recordatorios anuales) */
  fecha: Date;
  /** Si se debe recordar anualmente */
  esAnual: boolean;
  /** Si genera un recuerdo especial automático ese día */
  generaRecuerdoAutomatico: boolean;
  /** Recuerdo asociado a esta fecha especial */
  recuerdoAsociadoId: string | null;
}

// ============================================================
// INTERFAZ PRINCIPAL DE PAREJA
// ============================================================

/** Entidad principal que representa una pareja en pandunesiosss */
export interface Pareja {
  /** ID único de la pareja */
  parejaId: string;
  /** Primer miembro de la pareja */
  miembro1: MiembroPareja;
  /** Segundo miembro de la pareja */
  miembro2: MiembroPareja;
  /** Estado actual de la relación */
  estadoRelacion: EstadoRelacion;
  /** Fecha oficial de inicio de la relación (como pareja, no en la app) */
  fechaInicioRelacion: Date | null;
  /** Fecha en que se conectaron en pandunesiosss */
  conectadosEn: Date;
  /** Nombre personalizado que le dieron a su pareja en la app */
  nombrePersonalizadoPareja: string | null;
  /** Configuración del sistema anti-peleas */
  configuracionPelea: ConfiguracionPelea;
  /** Estadísticas acumuladas de la pareja */
  estadisticas: EstadisticasPareja;
  /** Fechas especiales registradas por la pareja */
  fechasEspeciales: FechaEspecial[];
  /** Recuerdos compartidos por la pareja */
  recuerdos: Recuerdo[];
  /** Historial de peleas */
  historialPeleas: EventoPelea[];
  /** Pelea activa actualmente (null si no hay pelea en curso) */
  peleaActiva: EventoPelea | null;
  /** Mensajes de amor personalizados creados por la pareja */
  mensajesPersonalizados: MensajeDeAmor[];
  /** Indica si la pareja tiene suscripción premium */
  esPremium: boolean;
  /** Fecha de expiración de la suscripción premium */
  premiumHasta: Date | null;
  /** Fecha de última actualización del perfil de pareja */
  actualizadoEn: Date;
  /** Si la cuenta de pareja está activa */
  activa: boolean;
}

// ============================================================
// TIPOS PARA INVITACIONES
// ============================================================

/** Invitación para que dos usuarios formen una pareja en pandunesiosss */
export interface InvitacionPareja {
  /** ID único de la invitación */
  invitacionId: string;
  /** ID del usuario que envía la invitación */
  remitenteId: string;
  /** Nombre del remitente para mostrar */
  nombreRemitente: string;
  /** ID del usuario que recibe la invitación */
  destinatarioId: string | null;
  /** Email del destinatario si aún no está registrado */
  emailDestinatario: string | null;
  /** Código único para aceptar la invitación */
  codigoInvitacion: string;
  /** Estado actual de la invitación */
  estado: EstadoInvitacion;
  /** Mensaje personalizado del remitente */
  mensajePersonalizado: string | null;
  /** Fecha de creación de la invitación */
  creadaEn: Date;
  /** Fecha de expiración (las invitaciones expiran a los 7 días) */
  expiraEn: Date;
  /** Fecha en que fue respondida */
  respondidaEn: Date | null;
}

// ============================================================
// TIPOS PARA OPERACIONES Y PAYLOADS
// ============================================================

/** Payload para marcar el estado de enojo — el botón principal de pandunesiosss */
export interface PayloadMarcarEnojo {
  /** ID del usuario que presiona el botón de enojo */
  usuarioId: string;
  /** ID de la pareja */
  parejaId: string;
  /** Nivel de intensidad del enojo (1-5) para calibrar los mensajes */
  nivelIntensidad: 1 | 2 | 3 | 4 | 5;
  /** Nota corta y opcional sobre el motivo (solo para registro privado) */
  notaPrivada: string | null;
}

/** Payload para marcar la reconciliación */
export interface PayloadMarcarReconciliacion {
  /** ID del usuario que marca la reconciliación */
  usuarioId: string;
  /** ID de la pareja */
  parejaId: string;
  /** ID del evento de pelea que se está cerrando */
  peleaId: string;
  /** Mensaje de reconciliación opcional para enviar al otro miembro */
  mensajeReconciliacion: string | null;
  /** Si desea compartir este momento como un recuerdo */
  guardarComoRecuerdo: boolean;
}

/** Payload para agregar un nuevo recuerdo */
export interface PayloadAgregarRecuerdo {
  /** ID de la pareja */
  parejaId: string;
  /** ID del usuario que sube el recuerdo */
  usuarioId: string;
  /** Tipo de recuerdo */
  tipo: TipoRecuerdo;
  /** URL del contenido (procesada por el servidor) */
  contenidoUrl: string | null;
  /** Título del recuerdo */
  titulo: string;
  /** Mensaje de amor asociado al recuerdo */
  mensajeAsociado: string | null;
  /** Fecha real del recuerdo */
  fechaRecuerdo: Date;
  /** Si este