import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';

// Router principal para rutas de delivery
const router = Router();

// Middleware de validación centralizado
const validarCampos = (req: Request, res: Response, next: NextFunction): void => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({
      exito: false,
      mensaje: 'Errores de validación en la solicitud',
      errores: errores.array().map((e) => ({
        campo: e.type === 'field' ? e.path : 'desconocido',
        mensaje: e.msg,
      })),
    });
    return;
  }
  next();
};

// Importación de controladores de delivery
import {
  crearPedido,
  obtenerPedidoPorId,
  obtenerPedidosPorUsuario,
  actualizarEstadoPedido,
  cancelarPedido,
  asignarRepartidor,
  obtenerRepartidoresDisponibles,
  actualizarUbicacionRepartidor,
  obtenerUbicacionEnTiempoReal,
  calcularTiempoEstimadoEntrega,
  obtenerHistorialEntregas,
  calificarEntrega,
  obtenerZonasCobertura,
  verificarDisponibilidadZona,
  obtenerEstadisticasDelivery,
  procesarWebhookEstado,
  obtenerPedidosActivos,
  reasignarPedido,
  reportarProblemaEntrega,
  obtenerRutaOptimizada,
} from '../controllers/delivery.controller';

// Importación de middlewares de autenticación y autorización
import {
  verificarToken,
  verificarRol,
  verificarPropietarioPedido,
  verificarRepartidorActivo,
  limitarPeticiones,
} from '../middlewares/auth.middleware';

// ─────────────────────────────────────────────
// RUTAS PÚBLICAS (sin autenticación requerida)
// ─────────────────────────────────────────────

/**
 * GET /api/delivery/zonas
 * Obtiene las zonas de cobertura disponibles para delivery
 */
router.get(
  '/zonas',
  limitarPeticiones(100, 15 * 60 * 1000), // 100 req / 15 min
  obtenerZonasCobertura
);

/**
 * POST /api/delivery/verificar-zona
 * Verifica si una dirección está dentro de la zona de cobertura
 */
router.post(
  '/verificar-zona',
  limitarPeticiones(50, 15 * 60 * 1000),
  [
    body('latitud')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitud inválida'),
    body('longitud')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitud inválida'),
    body('ciudad')
      .optional()
      .isString()
      .trim()
      .withMessage('Ciudad inválida'),
  ],
  validarCampos,
  verificarDisponibilidadZona
);

/**
 * GET /api/delivery/tiempo-estimado
 * Calcula el tiempo estimado de entrega entre origen y destino
 */
router.get(
  '/tiempo-estimado',
  limitarPeticiones(200, 15 * 60 * 1000),
  [
    query('lat_origen')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitud de origen inválida'),
    query('lng_origen')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitud de origen inválida'),
    query('lat_destino')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitud de destino inválida'),
    query('lng_destino')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitud de destino inválida'),
  ],
  validarCampos,
  calcularTiempoEstimadoEntrega
);

// ─────────────────────────────────────────────
// RUTAS DE PEDIDOS (requieren autenticación)
// ─────────────────────────────────────────────

/**
 * POST /api/delivery/pedidos
 * Crea un nuevo pedido de delivery
 */
router.post(
  '/pedidos',
  verificarToken,
  verificarRol(['cliente', 'admin']),
  limitarPeticiones(20, 60 * 1000), // 20 pedidos por minuto máximo
  [
    body('restauranteId')
      .isUUID()
      .withMessage('ID de restaurante inválido'),
    body('items')
      .isArray({ min: 1 })
      .withMessage('El pedido debe tener al menos un artículo'),
    body('items.*.productoId')
      .isUUID()
      .withMessage('ID de producto inválido'),
    body('items.*.cantidad')
      .isInt({ min: 1, max: 50 })
      .withMessage('Cantidad debe estar entre 1 y 50'),
    body('items.*.notas')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Notas del producto máximo 200 caracteres'),
    body('direccionEntrega.calle')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Calle de entrega requerida'),
    body('direccionEntrega.ciudad')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Ciudad de entrega requerida'),
    body('direccionEntrega.latitud')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitud de entrega inválida'),
    body('direccionEntrega.longitud')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitud de entrega inválida'),
    body('metodoPagoId')
      .isUUID()
      .withMessage('Método de pago inválido'),
    body('propina')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Propina no puede ser negativa'),
    body('instruccionesEntrega')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Instrucciones máximo 500 caracteres'),
    body('cuponDescuento')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Cupón de descuento inválido'),
  ],
  validarCampos,
  crearPedido
);

/**
 * GET /api/delivery/pedidos/activos
 * Obtiene todos los pedidos activos del usuario autenticado
 */
router.get(
  '/pedidos/activos',
  verificarToken,
  verificarRol(['cliente', 'repartidor', 'admin']),
  obtenerPedidosActivos
);

/**
 * GET /api/delivery/pedidos/historial
 * Obtiene el historial de pedidos del usuario autenticado con paginación
 */
router.get(
  '/pedidos/historial',
  verificarToken,
  verificarRol(['cliente', 'admin']),
  [
    query('pagina')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Número de página inválido'),
    query('limite')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Límite debe estar entre 1 y 50'),
    query('estado')
      .optional()
      .isIn(['completado', 'cancelado', 'todos'])
      .withMessage('Estado de filtro inválido'),
    query('fechaDesde')
      .optional()
      .isISO8601()
      .withMessage('Fecha desde inválida'),
    query('fechaHasta')
      .optional()
      .isISO8601()
      .withMessage('Fecha hasta inválida'),
  ],
  validarCampos,
  obtenerHistorialEntregas
);

/**
 * GET /api/delivery/pedidos/:pedidoId
 * Obtiene el detalle completo de un pedido específico
 */
router.get(
  '/pedidos/:pedidoId',
  verificarToken,
  verificarRol(['cliente', 'repartidor', 'restaurante', 'admin']),
  [
    param('pedidoId')
      .isUUID()
      .withMessage('ID de pedido inválido'),
  ],
  validarCampos,
  verificarPropietarioPedido,
  obtenerPedidoPorId
);

/**
 * GET /api/delivery/pedidos/usuario/:usuarioId
 * Obtiene todos los pedidos de un usuario (solo admin o el propio usuario)
 */
router.get(
  '/pedidos/usuario/:usuarioId',
  verificarToken,
  verificarRol(['cliente', 'admin']),
  [
    param('usuarioId')
      .isUUID()
      .withMessage('ID de usuario inválido'),
    query('pagina')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Número de página inválido'),
    query('limite')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Límite debe estar entre 1 y 100'),
  ],
  validarCampos,
  obtenerPedidosPorUsuario
);

/**
 * PATCH /api/delivery/pedidos/:pedidoId/estado
 * Actualiza el estado de un pedido (restaurante, repartidor o admin)
 */
router.patch(
  '/pedidos/:pedidoId/estado',
  verificarToken,
  verificarRol(['restaurante', 'repartidor', 'admin']),
  [
    param('pedidoId')
      .isUUID()
      .withMessage('ID de pedido inválido'),
    body('estado')
      .isIn([
        'confirmado',
        'preparando',
        'listo_para_recoger',
        'repartidor_asignado',
        'en_camino',
        'cerca_destino',
        'entregado',
        'no_entregado',
      ])
      .withMessage('Estado de pedido inválido'),
    body('notas')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 300 })
      .withMessage('Notas de estado máximo 300 caracteres'),
    body('ubicacionActual')
      .optional()
      .isObject()
      .withMessage('Ubicación actual debe ser un objeto'),
    body('ubicacionActual.latitud')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitud de ubicación inválida'),
    body('ubicacionActual.longitud')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitud de ubicación inválida'),
  ],
  validarCampos,
  actualizarEstadoPedido
);

/**
 * POST /api/delivery/pedidos/:pedidoId/cancelar
 * Cancela un pedido (solo si está en estados cancelables)
 */
router.post(
  '/pedidos/:pedidoId/cancelar',
  verificarToken,
  verificarRol(['cliente', 'admin']),
  [
    param('pedidoId')
      .isUUID()
      .withMessage('ID de pedido inválido'),
    body('motivoCancelacion')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Motivo de cancelación requerido'),
    body('motivoCancelacion')
      .isIn([
        'tiempo_espera_largo',
        'error_en_pedido',
        'cambio_de_opinion',
        'problema_de_pago',
        'restaurante_cerrado',
        'otro',
      ])
      .withMessage('Motivo de cancelación inválido'),
    body('descripcionAdicional')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Descripción adicional máximo 500 caracteres'),
  ],
  validarCampos,
  verificarPropietarioPedido,
  cancelarPedido
);

/**
 * POST /api/delivery/pedidos/:pedidoId/calificar
 * Califica la experiencia de entrega de un pedido completado
 */
router.post(
  '/pedidos/:pedidoId/calificar',
  verificarToken,
  verificarRol(['cliente']),
  [
    param('pedidoId')
      .isUUID()
      .withMessage('ID de pedido inválido'),
    body('calificacionRepartidor')
      .isInt({ min: 1, max: 5 })
      .withMessage('Calificación del repartidor debe ser entre 1 y 5'),
    body('calificacionRestaurante')
      .isInt({ min: 1, max: 5 })
      .withMessage('Calificación del restaurante debe ser entre 1 y 5'),
    body('comentario')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Comentario máximo 1000 caracteres'),
    body('propinaadicional')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Propina adicional no puede ser negativa'),
    body('etiquetas')
      .optional()
      .isArray()
      .withMessage('Etiquetas debe ser un array'),
    body('etiquetas.*')
      .optional()
      .isIn([
        'rapido',
        'amable',
        'comida_caliente',
        'bien_empacado',
        'siguio_instrucciones',
        'entrega_puntual',
      ])
      .withMessage('Etiqueta de calificación inválida'),
  ],
  validarCampos,
  verificarPropietarioPedido,
  calificarEntrega
);

/**
 * POST /api/delivery/pedidos/:pedidoId/reportar-problema
 * Reporta un problema durante o después de la entrega
 */
router.post(
  '/pedidos/:pedidoId/reportar-problema',
  verificarToken,
  verificarRol(['cliente', 'repartidor', 'restaurante']),
  [
    param('pedidoId')
      .isUUID()
      .withMessage('ID de pedido inválido'),
    body('tipoproblema')
      .isIn([
        'pedido_incompleto',
        'articulo_incorr