// Tipos para el sistema de delivery ultra-rápido estilo Rappi
// Optimizado para velocidad de entrega y experiencia de usuario

// ============================================================
// ENUMS PRINCIPALES
// ============================================================

/** Estados del pedido en tiempo real */
export enum OrderStatus {
  DRAFT = "draft",                           // Pedido en construcción
  PENDING = "pending",                       // Esperando confirmación del comercio
  CONFIRMED = "confirmed",                   // Confirmado por el comercio
  PREPARING = "preparing",                   // En preparación
  READY_FOR_PICKUP = "ready_for_pickup",     // Listo para ser recogido
  ASSIGNED = "assigned",                     // Asignado a un repartidor
  PICKED_UP = "picked_up",                   // Recogido por el repartidor
  ON_THE_WAY = "on_the_way",                // En camino al cliente
  ARRIVING = "arriving",                     // A menos de 2 minutos
  DELIVERED = "delivered",                   // Entregado exitosamente
  CANCELLED = "cancelled",                   // Cancelado
  FAILED = "failed",                         // Falló la entrega
  REFUNDED = "refunded",                     // Reembolsado
}

/** Estados del repartidor */
export enum DriverStatus {
  OFFLINE = "offline",           // No disponible
  ONLINE = "online",             // Disponible para tomar pedidos
  BUSY = "busy",                 // Con pedido activo
  ON_BREAK = "on_break",        // En descanso
  SUSPENDED = "suspended",       // Suspendido temporalmente
}

/** Tipo de vehículo del repartidor */
export enum VehicleType {
  BICYCLE = "bicycle",           // Bicicleta (corta distancia, eco)
  MOTORCYCLE = "motorcycle",     // Moto (estándar, más común)
  CAR = "car",                   // Automóvil (pedidos grandes)
  WALKING = "walking",           // A pie (zonas peatonales)
  ELECTRIC_SCOOTER = "electric_scooter", // Scooter eléctrico
}

/** Categorías de comercios disponibles */
export enum StoreCategory {
  RESTAURANT = "restaurant",         // Restaurantes y comida
  GROCERY = "grocery",               // Supermercados y abarrotes
  PHARMACY = "pharmacy",             // Farmacias
  CONVENIENCE = "convenience",       // Tiendas de conveniencia
  LIQUOR = "liquor",                 // Licorería
  PET = "pet",                       // Mascotas
  ELECTRONICS = "electronics",       // Electrónica
  FLOWERS = "flowers",               // Flores y regalos
  BAKERY = "bakery",                 // Panadería
  COFFEE = "coffee",                 // Café y bebidas
  FAST_FOOD = "fast_food",           // Comida rápida
  HEALTHY = "healthy",               // Comida saludable
}

/** Métodos de pago aceptados */
export enum PaymentMethod {
  CREDIT_CARD = "credit_card",       // Tarjeta de crédito
  DEBIT_CARD = "debit_card",         // Tarjeta de débito
  CASH = "cash",                     // Efectivo
  DIGITAL_WALLET = "digital_wallet", // Billetera digital (nuestro wallet)
  NEQUI = "nequi",                   // Nequi
  DAVIPLATA = "daviplata",           // Daviplata
  PSE = "pse",                       // PSE transferencia
  APPLE_PAY = "apple_pay",           // Apple Pay
  GOOGLE_PAY = "google_pay",         // Google Pay
}

/** Estado del pago */
export enum PaymentStatus {
  PENDING = "pending",               // Pendiente de procesar
  PROCESSING = "processing",         // En proceso
  AUTHORIZED = "authorized",         // Autorizado, pendiente de captura
  CAPTURED = "captured",             // Capturado exitosamente
  FAILED = "failed",                 // Falló el cobro
  REFUNDED = "refunded",             // Reembolsado completamente
  PARTIALLY_REFUNDED = "partially_refunded", // Reembolso parcial
  DISPUTED = "disputed",             // En disputa
}

/** Prioridad del pedido para optimización de rutas */
export enum OrderPriority {
  STANDARD = "standard",             // Entrega estándar (30-45 min)
  EXPRESS = "express",               // Entrega express (15-25 min)
  ULTRA_FAST = "ultra_fast",         // Ultra rápido (menos de 15 min)
  SCHEDULED = "scheduled",           // Pedido programado
}

/** Tipo de promoción */
export enum PromotionType {
  PERCENTAGE = "percentage",         // Descuento porcentual
  FIXED_AMOUNT = "fixed_amount",     // Descuento en monto fijo
  FREE_DELIVERY = "free_delivery",   // Domicilio gratis
  BUY_X_GET_Y = "buy_x_get_y",      // Lleva X paga Y
  CASHBACK = "cashback",             // Devolución en wallet
}

/** Razón de cancelación */
export enum CancellationReason {
  USER_CANCELLED = "user_cancelled",             // Cancelado por el usuario
  STORE_CLOSED = "store_closed",                 // Comercio cerrado
  ITEM_UNAVAILABLE = "item_unavailable",         // Producto no disponible
  NO_DRIVER_AVAILABLE = "no_driver_available",   // Sin repartidor disponible
  PAYMENT_FAILED = "payment_failed",             // Pago fallido
  DRIVER_CANCELLED = "driver_cancelled",         // Cancelado por el repartidor
  STORE_CANCELLED = "store_cancelled",           // Cancelado por el comercio
  WEATHER_CONDITIONS = "weather_conditions",     // Condiciones climáticas
  SYSTEM_ERROR = "system_error",                 // Error del sistema
}

// ============================================================
// INTERFACES DE GEOLOCALIZACIÓN
// ============================================================

/** Coordenadas geográficas */
export interface Coordinates {
  lat: number;                       // Latitud
  lng: number;                       // Longitud
}

/** Dirección completa con coordenadas */
export interface Address {
  id: string;
  street: string;                    // Calle y número
  neighborhood: string;              // Barrio / Colonia
  city: string;                      // Ciudad
  state: string;                     // Departamento / Estado
  country: string;                   // País
  zipCode?: string;                  // Código postal (opcional en LATAM)
  coordinates: Coordinates;          // Coordenadas GPS
  instructions?: string;             // Instrucciones adicionales (apto, interior)
  alias?: string;                    // Alias (Casa, Oficina, etc.)
  isVerified: boolean;               // Verificada por geocoding
}

/** Zona de cobertura del servicio */
export interface DeliveryZone {
  id: string;
  name: string;                      // Nombre de la zona
  city: string;
  polygon: Coordinates[];            // Polígono que define la zona
  isActive: boolean;
  baseFee: number;                   // Tarifa base de domicilio
  surgeMultiplier: number;           // Multiplicador por alta demanda (1.0 = sin surge)
  maxDeliveryTime: number;           // Tiempo máximo de entrega en minutos
  supportedPriorities: OrderPriority[];
}

// ============================================================
// INTERFACES DE USUARIO
// ============================================================

/** Perfil del cliente */
export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;                     // Número con código de país (+57...)
  phoneVerified: boolean;
  profilePhoto?: string;             // URL de foto de perfil
  savedAddresses: Address[];         // Direcciones guardadas
  defaultAddressId?: string;         // Dirección predeterminada
  walletBalance: number;             // Saldo en billetera interna
  loyaltyPoints: number;             // Puntos de fidelidad
  isPrime: boolean;                  // Suscripción premium (como Rappi Prime)
  primeExpiresAt?: Date;
  referralCode: string;              // Código de referido único
  referredBy?: string;               // ID del cliente que lo refirió
  totalOrders: number;               // Pedidos totales realizados
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  deviceTokens: string[];            // Tokens para push notifications
}

/** Perfil del repartidor */
export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profilePhoto?: string;
  vehicleType: VehicleType;
  vehiclePlate?: string;             // Placa del vehículo
  vehicleModel?: string;             // Modelo del vehículo
  status: DriverStatus;
  currentLocation?: Coordinates;    // Ubicación en tiempo real
  currentOrderId?: string;          // Pedido activo actual
  rating: number;                   // Calificación promedio (1-5)
  totalRatings: number;             // Número total de calificaciones
  totalDeliveries: number;          // Entregas completadas
  completionRate: number;           // Tasa de completación (0-100)
  acceptanceRate: number;           // Tasa de aceptación de pedidos (0-100)
  zoneId: string;                   // Zona de operación
  isVerified: boolean;              // Documentos verificados
  documents: DriverDocument[];      // Documentos del repartidor
  bankAccount?: BankAccount;        // Cuenta bancaria para pagos
  walletBalance: number;            // Saldo pendiente de pago
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt?: Date;
}

/** Documento del repartidor */
export interface DriverDocument {
  type: "id_card" | "driving_license" | "vehicle_registration" | "insurance";
  url: string;                       // URL del documento almacenado
  expiresAt?: Date;
  isVerified: boolean;
  verifiedAt?: Date;
}

/** Cuenta bancaria para pagos a repartidores */
export interface BankAccount {
  bankName: string;
  accountNumber: string;             // Número de cuenta (enmascarado)
  accountType: "savings" | "checking";
  ownerName: string;
  isVerified: boolean;
}

// ============================================================
// INTERFACES DE COMERCIO
// ============================================================

/** Horario de atención */
export interface BusinessHours {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Domingo, 6=Sábado
  openTime: string;                  // Formato HH:mm (24h)
  closeTime: string;
  isOpen: boolean;                   // Si atiende ese día
}

/** Información del comercio aliado */
export interface Store {
  id: string;
  name: string;
  description: string;
  category: StoreCategory;
  tags: string[];                    // Tags para búsqueda (pizza, sushi, etc.)
  logo: string;                      // URL del logo
  coverImage: string;                // URL imagen de portada
  address: Address;
  phone: string;
  email: string;
  rating: number;                    // Calificación promedio
  totalRatings: number;
  totalOrders: number;
  businessHours: BusinessHours[];
  isOpen: boolean;                   // Estado actual (calculado en tiempo real)
  isActive: boolean;                 // Habilitado en la plataforma
  isFeatured: boolean;               // Destacado en la app
  preparationTime: number;           // Tiempo promedio de preparación en minutos
  minOrderAmount: number;            // Monto mínimo de pedido
  maxOrderAmount?: number;           // Monto máximo (para control de riesgo)
  deliveryFeeOverride?: number;      // Tarifa de domicilio personalizada
  commissionRate: number;            // Comisión de la plataforma (0-100)
  acceptsScheduledOrders: boolean;   // Acepta pedidos programados
  zoneIds: string[];                 // Zonas donde hace entregas
  bankAccount: BankAccount;          // Cuenta para liquidación
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// INTERFACES DE PRODUCTOS
// ============================================================

/** Modificador de producto (adiciones, exclusiones) */
export interface ProductModifier {
  id: string;
  name: string;                      // Ej: "Sin cebolla", "Queso extra"
  price: number;                     // Costo adicional (0 si es gratis)
  isAvailable: boolean;
}

/** Grupo de modificadores */
export interface ModifierGroup {
  id: string;
  name: string;                      // Ej: "Proteína", "Bebida", "Salsas"
  isRequired: boolean;               // Si es obligatorio seleccionar uno
  minSelections: number;             // Mínimo de selecciones
  maxSelections: number;             // Máximo de selecciones
  modifiers: ProductModifier[];
}

/** Producto del catálogo */
export interface Product {
  id: string;
  storeId: string;
  name: string;
  description: string;
  price: number;                     // Precio base
  originalPrice?: number;            // Precio original (si tiene descuento)
  images: string[];                  // URLs de imágenes del producto
  category: string;                  // Categoría dentro del menú
  tags: string[];                    // Tags (vegano, sin gluten, etc.)
  modifierGroups: ModifierGroup[];
  isAvailable: boolean;
  isFeatured: boolean;               // Destacado en el menú
  isPopular: boolean;                // Tag "Lo más pedido"
  preparationTime?: number;          // Tiempo específico si difiere del comercio
  calories?: number;                 // Información nutricional
  allergens?: string[];              // Alérgenos (leche, gluten, mariscos...)
  sku?: string;                      // SKU para inventario
  sortOrder: number;                 // Orden de aparición en el menú
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// INTERFACES DE PEDIDO
// ============================================================

/** Ítem dentro de un pedido */
export interface OrderItem {
  id: string;
  productId: string;
  productName: string;               // Snapshot del nombre al momento del pedido
  productImage?: string;
  quantity: number;
  unitPrice: number;                 // Precio unitario al momento del pedido
  selectedModifiers: {
    groupId: string;
    groupName: string;
    modifierId: string;
    modifierName: string;
    price: number;
  }[];
  subtotal: number;                  // quantity * (unitPrice + modifiers)
  specialInstructions?: string;      // Instrucciones especiales del item
}

/** Desglose de costos del pedido */
export interface OrderPricing {
  subtotal: number;                  // Suma de