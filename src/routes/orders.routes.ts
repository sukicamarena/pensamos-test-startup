// Rutas para la gestión de pedidos en la plataforma de delivery rápido
import { Router } from 'express';
import { OrdersController } from '../controllers/orders.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validateMiddleware } from '../middlewares/validate.middleware';
import { rateLimitMiddleware } from '../middlewares/rateLimit.middleware';
import {
  createOrderSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  rateOrderSchema,
  assignDriverSchema,
} from '../validators/orders.validator';

const router = Router();
const ordersController = new OrdersController();

// ─────────────────────────────────────────────
// Rutas públicas (requieren autenticación básica)
// ─────────────────────────────────────────────

// Obtener todos los pedidos del usuario autenticado
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['customer', 'admin']),
  ordersController.getOrders
);

// Obtener un pedido específico por ID
router.get(
  '/:orderId',
  authMiddleware,
  roleMiddleware(['customer', 'driver', 'restaurant', 'admin']),
  ordersController.getOrderById
);

// Rastreo en tiempo real del pedido (estado actual + ubicación del repartidor)
router.get(
  '/:orderId/tracking',
  authMiddleware,
  roleMiddleware(['customer', 'admin']),
  ordersController.trackOrder
);

// Obtener el historial completo de estados de un pedido
router.get(
  '/:orderId/history',
  authMiddleware,
  roleMiddleware(['customer', 'admin']),
  ordersController.getOrderHistory
);

// Obtener el tiempo estimado de entrega actualizado
router.get(
  '/:orderId/eta',
  authMiddleware,
  roleMiddleware(['customer', 'driver', 'admin']),
  ordersController.getOrderEta
);

// ─────────────────────────────────────────────
// Rutas para clientes (customer)
// ─────────────────────────────────────────────

// Crear un nuevo pedido (rate limiting para evitar spam)
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['customer']),
  rateLimitMiddleware({ windowMs: 60_000, max: 10, keyPrefix: 'create_order' }),
  validateMiddleware(createOrderSchema),
  ordersController.createOrder
);

// Cancelar un pedido (solo si está en estado pendiente o confirmado)
router.patch(
  '/:orderId/cancel',
  authMiddleware,
  roleMiddleware(['customer']),
  validateMiddleware(cancelOrderSchema),
  ordersController.cancelOrder
);

// Calificar y reseñar un pedido completado
router.post(
  '/:orderId/rate',
  authMiddleware,
  roleMiddleware(['customer']),
  validateMiddleware(rateOrderSchema),
  ordersController.rateOrder
);

// Re-ordenar un pedido anterior (replica los items)
router.post(
  '/:orderId/reorder',
  authMiddleware,
  roleMiddleware(['customer']),
  rateLimitMiddleware({ windowMs: 60_000, max: 5, keyPrefix: 'reorder' }),
  ordersController.reorder
);

// Reclamar un problema con el pedido (producto faltante, incorrecto, etc.)
router.post(
  '/:orderId/claim',
  authMiddleware,
  roleMiddleware(['customer']),
  ordersController.createClaim
);

// ─────────────────────────────────────────────
// Rutas para restaurantes (restaurant)
// ─────────────────────────────────────────────

// Obtener pedidos entrantes del restaurante
router.get(
  '/restaurant/incoming',
  authMiddleware,
  roleMiddleware(['restaurant', 'admin']),
  ordersController.getIncomingOrders
);

// Aceptar un pedido entrante
router.patch(
  '/:orderId/accept',
  authMiddleware,
  roleMiddleware(['restaurant']),
  ordersController.acceptOrder
);

// Marcar el pedido como listo para recoger por el repartidor
router.patch(
  '/:orderId/ready',
  authMiddleware,
  roleMiddleware(['restaurant']),
  ordersController.markOrderReady
);

// Rechazar un pedido (con motivo obligatorio)
router.patch(
  '/:orderId/reject',
  authMiddleware,
  roleMiddleware(['restaurant']),
  ordersController.rejectOrder
);

// Actualizar tiempo estimado de preparación
router.patch(
  '/:orderId/prep-time',
  authMiddleware,
  roleMiddleware(['restaurant']),
  ordersController.updatePrepTime
);

// ─────────────────────────────────────────────
// Rutas para repartidores (driver)
// ─────────────────────────────────────────────

// Obtener pedidos disponibles para asignación en zona del repartidor
router.get(
  '/driver/available',
  authMiddleware,
  roleMiddleware(['driver']),
  ordersController.getAvailableOrders
);

// Obtener pedidos activos asignados al repartidor
router.get(
  '/driver/active',
  authMiddleware,
  roleMiddleware(['driver']),
  ordersController.getDriverActiveOrders
);

// Tomar un pedido disponible (auto-asignación)
router.patch(
  '/:orderId/pickup',
  authMiddleware,
  roleMiddleware(['driver']),
  ordersController.pickupOrder
);

// Confirmar recogida del pedido en el restaurante
router.patch(
  '/:orderId/picked-up',
  authMiddleware,
  roleMiddleware(['driver']),
  ordersController.confirmPickup
);

// Marcar el pedido como entregado al cliente
router.patch(
  '/:orderId/deliver',
  authMiddleware,
  roleMiddleware(['driver']),
  ordersController.deliverOrder
);

// Actualizar ubicación del repartidor durante la entrega
router.patch(
  '/:orderId/location',
  authMiddleware,
  roleMiddleware(['driver']),
  rateLimitMiddleware({ windowMs: 5_000, max: 5, keyPrefix: 'driver_location' }),
  ordersController.updateDriverLocation
);

// ─────────────────────────────────────────────
// Rutas de administración
// ─────────────────────────────────────────────

// Obtener todos los pedidos con filtros avanzados (admin dashboard)
router.get(
  '/admin/all',
  authMiddleware,
  roleMiddleware(['admin']),
  ordersController.getAllOrders
);

// Obtener métricas y estadísticas de pedidos
router.get(
  '/admin/metrics',
  authMiddleware,
  roleMiddleware(['admin']),
  ordersController.getOrderMetrics
);

// Actualizar manualmente el estado de un pedido (para soporte)
router.patch(
  '/admin/:orderId/status',
  authMiddleware,
  roleMiddleware(['admin']),
  validateMiddleware(updateOrderStatusSchema),
  ordersController.updateOrderStatus
);

// Asignar manualmente un repartidor a un pedido
router.patch(
  '/admin/:orderId/assign-driver',
  authMiddleware,
  roleMiddleware(['admin']),
  validateMiddleware(assignDriverSchema),
  ordersController.assignDriver
);

// Procesar reembolso de un pedido
router.post(
  '/admin/:orderId/refund',
  authMiddleware,
  roleMiddleware(['admin']),
  ordersController.processRefund
);

// Exportar pedidos en formato CSV para reportes
router.get(
  '/admin/export',
  authMiddleware,
  roleMiddleware(['admin']),
  ordersController.exportOrders
);

export default router;