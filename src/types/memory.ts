// Tipos para el sistema de memorias de pandunesiosss
// Módulo central para gestionar los recuerdos de las parejas

// ============================================================
// ENUMS
// ============================================================

/** Tipos de archivos multimedia que puede contener un recuerdo */
export enum TipoMediaMemoria {
  FOTO = "foto",
  VIDEO = "video",
  AUDIO = "audio",
  GIF = "gif",
}

/** Estado de procesamiento de un recuerdo */
export enum EstadoMemoria {
  PENDIENTE = "pendiente",       // Recién subida, aún no procesada
  PROCESANDO = "procesando",     // En cola de análisis/indexación
  ACTIVA = "activa",             // Lista para ser enviada
  ARCHIVADA = "archivada",       // Ya no se envía automáticamente
  ELIMINADA = "eliminada",       // Marcada para eliminación (soft delete)
}

/** Categorías emocionales de un recuerdo para personalizar el envío */
export enum CategoriaEmocionalMemoria {
  PRIMER_ENCUENTRO = "primer_encuentro",
  VIAJE = "viaje",
  CELEBRACION = "celebracion",
  COTIDIANO = "cotidiano",
  LOGRO_COMPARTIDO = "logro_compartido",
  MENSAJE_ESPECIAL = "mensaje_especial",
  FECHA_ESPECIAL = "fecha_especial",
  INTIMIDAD = "intimidad",           // Categoría privada, solo visible por la pareja
  HUMOR = "humor",
  PROMESA = "promesa",
}

/** Quién puede ver o recibir el recuerdo */
export enum VisibilidadMemoria {
  AMBOS = "ambos",           // Ambos miembros de la pareja
  SOLO_YO = "solo_yo",       // Solo quien lo subió puede verlo
  PUBLICO = "publico",       // Visible en perfil público (si la pareja lo permite)
}

/** Origen de creación del recuerdo */
export enum OrigenMemoria {
  MANUAL = "manual",             // Subido directamente por el usuario
  IMPORTADO_GALERIA = "importado_galeria",
  IMPORTADO_INSTAGRAM = "importado_instagram",
  IMPORTADO_GOOGLE_PHOTOS = "importado_google_photos",
  GENERADO_IA = "generado_ia",   // Collage o resumen generado automáticamente
  MILESTONE = "milestone",       // Generado por evento (aniversario, etc.)
}

// ============================================================
// INTERFACES BASE
// ============================================================

/** Metadatos de un archivo multimedia adjunto a un recuerdo */
export interface MediaMemoria {
  id: string;
  memoriaId: string;
  tipo: TipoMediaMemoria;
  url: string;                    // URL pública del archivo en storage
  urlThumbnail?: string;          // Miniatura para previsualizaciones
  urlOriginal?: string;           // URL del archivo original sin comprimir
  nombreArchivo: string;
  tamanoBytes: number;
  duracionSegundos?: number;      // Para videos y audios
  anchoPx?: number;               // Para fotos y videos
  altoPx?: number;
  hashPerceptual?: string;        // Para detectar duplicados
  subidoEn: Date;
  procesadoEn?: Date;
}

/** Ubicación geográfica asociada a un recuerdo */
export interface UbicacionMemoria {
  latitud: number;
  longitud: number;
  nombreLugar?: string;           // Ej: "Café donde nos conocimos"
  ciudad?: string;
  pais?: string;
  esLugarEspecial: boolean;       // Marcado manualmente como especial
}

/** Reacción de un miembro de la pareja a un recuerdo recibido */
export interface ReaccionMemoria {
  id: string;
  memoriaId: string;
  usuarioId: string;
  emoji: string;                  // Ej: "❤️", "😂", "😢"
  comentario?: string;            // Mensaje corto de respuesta
  creadaEn: Date;
}

/** Estadísticas de envío de un recuerdo durante peleas */
export interface EstadisticasEnvioMemoria {
  memoriaId: string;
  vecesEnviada: number;
  ultimoEnvioEn?: Date;
  tasaReconciliacion: number;     // Porcentaje de veces que llevó a reconciliación (0-1)
  promedioTiempoRespuestaMinutos?: number;
  reaccionesPositivas: number;
  reaccionesNegativas: number;
}

// ============================================================
// INTERFAZ PRINCIPAL
// ============================================================

/** Estructura completa de un recuerdo en pandunesiosss */
export interface Memoria {
  id: string;
  parejaId: string;               // ID de la pareja dueña del recuerdo
  creadaPorUsuarioId: string;     // Usuario que creó/subió el recuerdo
  titulo?: string;                // Título opcional dado por el usuario
  descripcion?: string;           // Historia o contexto del recuerdo
  fechaDelRecuerdo: Date;         // Cuándo ocurrió (no cuándo se subió)
  creadaEn: Date;                 // Timestamp de creación en el sistema
  actualizadaEn: Date;
  eliminadaEn?: Date;             // Soft delete

  // Clasificación
  categoria: CategoriaEmocionalMemoria;
  etiquetas: string[];            // Tags personalizados: ["primera cita", "lluvia", ...]
  visibilidad: VisibilidadMemoria;
  estado: EstadoMemoria;
  origen: OrigenMemoria;

  // Contenido multimedia
  media: MediaMemoria[];
  mediaPortadaId?: string;        // ID del media que se usa como portada

  // Mensaje de amor asociado (puede ser personalizado)
  mensajeAmor?: string;           // Texto personalizado para cuando se envíe
  usarMensajePersonalizado: boolean;

  // Localización
  ubicacion?: UbicacionMemoria;

  // Contexto emocional
  intensidadEmocional: number;    // 1-10, qué tan significativo es el recuerdo
  esAniversario: boolean;         // Si tiene fecha recurrente anual
  recordarAnualmente: boolean;    // Enviar notificación en su aniversario

  // Engagement
  reacciones: ReaccionMemoria[];
  estadisticas?: EstadisticasEnvioMemoria;

  // Moderación
  reportada: boolean;
  revisadaPorModerador: boolean;
}

// ============================================================
// TIPOS PARA CREACIÓN Y ACTUALIZACIÓN
// ============================================================

/** Payload para crear un nuevo recuerdo */
export type CrearMemoriaPayload = Omit<
  Memoria,
  | "id"
  | "creadaEn"
  | "actualizadaEn"
  | "eliminadaEn"
  | "reacciones"
  | "estadisticas"
  | "reportada"
  | "revisadaPorModerador"
  | "estado"
> & {
  archivos?: File[];              // Archivos a subir (frontend)
};

/** Payload para actualizar un recuerdo existente */
export type ActualizarMemoriaPayload = Partial<
  Pick<
    Memoria,
    | "titulo"
    | "descripcion"
    | "categoria"
    | "etiquetas"
    | "visibilidad"
    | "mensajeAmor"
    | "usarMensajePersonalizado"
    | "ubicacion"
    | "intensidadEmocional"
    | "esAniversario"
    | "recordarAnualmente"
    | "mediaPortadaId"
  >
>;

// ============================================================
// TIPOS PARA ENVÍO DURANTE PELEAS
// ============================================================

/** Snapshot de un recuerdo optimizado para envío rápido durante una pelea */
export interface MemoriaParaEnvio {
  memoriaId: string;
  parejaId: string;
  destinatariosIds: string[];     // IDs de ambos usuarios de la pareja
  thumbnailUrl: string;
  titulo?: string;
  mensajeFinal: string;           // Mensaje definitivo (personalizado o generado)
  categoria: CategoriaEmocionalMemoria;
  fechaDelRecuerdo: Date;
  intensidadEmocional: number;
}

/** Registro de un envío de memoria durante una sesión de pelea */
export interface EnvioMemoriaPelea {
  id: string;
  memoriaId: string;
  peleaId: string;                // ID del evento de pelea que disparó el envío
  parejaId: string;
  enviadaA: string[];             // IDs de usuarios que recibieron el envío
  enviadaEn: Date;
  algoritmoVersion: string;       // Versión del algoritmo de selección usado
  puntuacionRelevancia: number;   // Score que tuvo este recuerdo al momento de selección (0-1)
  fueVista: boolean;
  tiempoVistaSegundos?: number;
  resultadoReconciliacion?: boolean; // null si aún no se sabe
}

// ============================================================
// TIPOS PARA FILTROS Y CONSULTAS
// ============================================================

/** Filtros para listar recuerdos de una pareja */
export interface FiltrosMemoria {
  parejaId: string;
  categorias?: CategoriaEmocionalMemoria[];
  etiquetas?: string[];
  estado?: EstadoMemoria;
  visibilidad?: VisibilidadMemoria;
  fechaDesde?: Date;
  fechaHasta?: Date;
  intensidadMinima?: number;      // Filtrar por nivel emocional mínimo
  soloConMedia?: boolean;
  soloAniversarios?: boolean;
  textoBusqueda?: string;         // Búsqueda en título y descripción
}

/** Opciones de paginación para listas de recuerdos */
export interface PaginacionMemoria {
  pagina: number;
  porPagina: number;              // Máximo 50
  ordenarPor: "fechaDelRecuerdo" | "creadaEn" | "intensidadEmocional" | "vecesEnviada";
  direccion: "asc" | "desc";
}

/** Resultado paginado de recuerdos */
export interface ResultadoListaMemoria {
  memorias: Memoria[];
  total: number;
  pagina: number;
  totalPaginas: number;
  tieneSiguiente: boolean;
  tieneAnterior: boolean;
}

// ============================================================
// TIPOS PARA ALGORITMO DE SELECCIÓN
// ============================================================

/** Contexto que recibe el algoritmo para seleccionar los mejores recuerdos */
export interface ContextoSeleccionMemoria {
  parejaId: string;
  peleaId: string;
  tiempoPelea: number;            // Minutos que lleva la pelea activa
  historialEnvioReciente: string[]; // IDs de memorias enviadas en últimas 24h (no repetir)
  categoriasPrioritarias?: CategoriaEmocionalMemoria[];
  totalMemoriasDisponibles: number;
}

/** Resultado de la selección de memorias por el algoritmo */
export interface SeleccionMemoriasAlgoritmo {
  memoriasSeleccionadas: MemoriaParaEnvio[];
  cantidadTotal: number;          // Cuántas memorias se seleccionaron
  tiempoProcesamientoMs: number;
  razonSeleccion: string;         // Explicación legible del criterio (para debugging)
  algoritmoVersion: string;
}

// ============================================================
// TIPOS DE RESPUESTA DE API
// ============================================================

/** Respuesta estándar al obtener una memoria */
export interface RespuestaMemoria {
  exito: boolean;
  memoria?: Memoria;
  error?: string;
}

/** Respuesta al crear o actualizar una memoria */
export interface RespuestaOperacionMemoria {
  exito: boolean;
  memoriaId?: string;
  memoria?: Memoria;
  errores?: Record<string, string>;   // Campo -> mensaje de error de validación
  mensaje?: string;
}

/** Respuesta al eliminar una memoria */
export interface RespuestaEliminarMemoria {
  exito: boolean;
  memoriaId: string;
  mensaje: string;
}

// ============================================================
// TIPOS UTILITARIOS
// ============================================================

/** Resumen de recuerdos de una pareja (para dashboard) */
export interface ResumenMemoriasPareja {
  parejaId: string;
  totalMemorias: number;
  memoriasPorCategoria: Record<CategoriaEmocionalMemoria, number>;
  memoriaDestacada?: Memoria;     // La memoria con mayor intensidad emocional
  primerRecuerdo?: Memoria;
  ultimoRecuerdo?: Memoria;
  diasDesdeUltimoRecuerdo?: number;
  memoriasMasEnviadas: Array<{
    memoria: Memoria;
    vecesEnviada: number;
  }>;
}

/** Evento de cambio de estado de una memoria (para auditoría) */
export interface EventoCambioEstadoMemoria {
  id: string;
  memoriaId: string;
  estadoAnterior: EstadoMemoria;
  estadoNuevo: EstadoMemoria;
  cambiadoPorUsuarioId?: string;  // undefined si fue automático por el sistema
  razon?: string;
  ocurridoEn: Date;
}