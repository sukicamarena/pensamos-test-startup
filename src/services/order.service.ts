import { PrismaClient, Order, OrderStatus, Prisma } from '@prisma/client';
import { EventEmitter } from 'events';

// Instancia de Prisma para operaciones de base de datos
const prisma = new PrismaClient();

// Emisor de eventos para notificaciones en tiempo real
export const orderEvents = new EventEmitter();

// Tipos específicos para el dominio de delivery rápido
export interface CreateOrderInput {
  customerId: string;
  storeId: string;
  items: OrderItemInput[];
  deliveryAddressId: string;
  paymentMethodId: string;
  promoCode?: string;
  scheduledFor?: Date;
  specialInstructions?: string;
}

export interface OrderItemInput {
  productId: string;
  quantity: number;
  customizations?: ProductCustomization[];
  notes?: string;
}

export interface ProductCustomization {
  groupId: string;
  optionId: string;
  extraCost: number;
}

export interface OrderWithDetails extends Order {
  items: OrderItemWithProduct[];
  customer: CustomerInfo;
  store: StoreInfo;
  driver?: DriverInfo;
  deliveryAddress: AddressInfo;
  tracking: OrderTracking[];
}

export interface OrderItemWithProduct {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customizations: ProductCustomization[];
  notes?: string;
}

export interface CustomerInfo {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export interface StoreInfo {
  id: string;
  name: string;
  address: string;
  phone: string;
  averagePreparationTime: number;
}

export interface DriverInfo {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  currentLocation?: GeoPoint;
  rating: number;
}

export interface AddressInfo {
  id: string;
  street: string;
  city: string;
  latitude: number;
  longitude: number;
  references?: string;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface OrderTracking {
  id: string;
  status: OrderStatus;
  timestamp: Date;
  description: string;
  location?: GeoPoint;
}

export interface PriceBreakdown {
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  taxes: number;
  total: number;
  promoApplied?: PromoDetails;
}

export interface PromoDetails {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  description: string;
}

export interface OrderFilter {
  customerId?: string;
  storeId?: string;
  driverId?: string;
  status?: OrderStatus | OrderStatus[];
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export interface PaginatedOrders {
  orders: OrderWithDetails[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export interface AssignDriverInput {
  orderId: string;
  driverId: string;
  estimatedPickupTime: number;
  estimatedDeliveryTime: number;
}

export interface OrderMetrics {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageDeliveryTime: number;
  averageOrderValue: number;
  revenueTotal: number;
}

// Tasas de servicio y configuración
const SERVICE_FEE_PERCENTAGE = 0.05; // 5% fee de servicio
const TAX_PERCENTAGE = 0.16; // 16% IVA
const BASE_DELIVERY_FEE = 25.0; // Tarifa base en MXN
const DELIVERY_FEE_PER_KM = 5.0; // Tarifa por kilómetro adicional
const FREE_DELIVERY_THRESHOLD = 200.0; // Pedido gratis sobre este monto

/**
 * Calcula la distancia entre dos puntos geográficos usando la fórmula Haversine
 */
function calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const dLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.latitude * Math.PI) / 180) *
      Math.cos((point2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calcula el tiempo estimado de entrega basado en distancia y condiciones
 */
function calculateEstimatedDeliveryTime(
  distanceKm: number,
  preparationTimeMinutes: number,
  isRushHour: boolean
): number {
  const speedKmPerMin = isRushHour ? 0.3 : 0.5; // Velocidad promedio del mensajero
  const travelTime = distanceKm / speedKmPerMin;
  const buffer = 5; // Minutos de margen
  return Math.ceil(preparationTimeMinutes + travelTime + buffer);
}

/**
 * Verifica si es hora pico (rush hour)
 */
function isRushHour(): boolean {
  const hour = new Date().getHours();
  return (hour >= 12 && hour <= 14) || (hour >= 19 && hour <= 21);
}

/**
 * Genera un número de orden único y legible
 */
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RPP-${timestamp}-${random}`;
}

/**
 * Calcula el costo de entrega basado en distancia y subtotal
 */
function calculateDeliveryFee(distanceKm: number, subtotal: number): number {
  // Entrega gratuita para pedidos grandes
  if (subtotal >= FREE_DELIVERY_THRESHOLD) {
    return 0;
  }
  const distanceCharge = Math.max(0, (distanceKm - 2) * DELIVERY_FEE_PER_KM);
  return Math.round((BASE_DELIVERY_FEE + distanceCharge) * 100) / 100;
}

/**
 * Calcula el desglose completo de precios de un pedido
 */
export async function calculateOrderPrice(
  items: OrderItemInput[],
  storeLocation: GeoPoint,
  deliveryLocation: GeoPoint,
  promoCode?: string
): Promise<PriceBreakdown> {
  let subtotal = 0;
  let promoApplied: PromoDetails | undefined;
  let discount = 0;

  // Calcular subtotal sumando productos y customizaciones
  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: { price: true, isAvailable: true, name: true },
    });

    if (!product) {
      throw new Error(`Producto ${item.productId} no encontrado`);
    }

    if (!product.isAvailable) {
      throw new Error(`El producto ${product.name} no está disponible`);
    }

    let itemPrice = product.price * item.quantity;

    // Agregar costo de customizaciones
    if (item.customizations) {
      const customizationCost = item.customizations.reduce(
        (sum, custom) => sum + custom.extraCost * item.quantity,
        0
      );
      itemPrice += customizationCost;
    }

    subtotal += itemPrice;
  }

  // Aplicar código de promoción si existe
  if (promoCode) {
    const promo = await prisma.promoCode.findFirst({
      where: {
        code: promoCode.toUpperCase(),
        isActive: true,
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() },
        usageCount: { lt: prisma.promoCode.fields.maxUsage },
      },
    });

    if (promo) {
      if (promo.discountType === 'PERCENTAGE') {
        discount = subtotal * (promo.discountValue / 100);
      } else {
        discount = Math.min(promo.discountValue, subtotal);
      }

      promoApplied = {
        code: promo.code,
        discountType: promo.discountType as 'PERCENTAGE' | 'FIXED',
        discountValue: promo.discountValue,
        description: promo.description,
      };
    }
  }

  const distanceKm = calculateDistance(storeLocation, deliveryLocation);
  const subtotalAfterDiscount = subtotal - discount;
  const deliveryFee = calculateDeliveryFee(distanceKm, subtotalAfterDiscount);
  const serviceFee = Math.round(subtotalAfterDiscount * SERVICE_FEE_PERCENTAGE * 100) / 100;
  const taxes = Math.round(subtotalAfterDiscount * TAX_PERCENTAGE * 100) / 100;
  const total = Math.round((subtotalAfterDiscount + deliveryFee + serviceFee + taxes) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    deliveryFee,
    serviceFee,
    discount: Math.round(discount * 100) / 100,
    taxes,
    total,
    promoApplied,
  };
}

/**
 * Crea un nuevo pedido con validación completa de disponibilidad y precios
 */
export async function createOrder(input: CreateOrderInput): Promise<OrderWithDetails> {
  // Validar que la tienda existe y está abierta
  const store = await prisma.store.findUnique({
    where: { id: input.storeId },
    include: {
      address: true,
      operatingHours: true,
    },
  });

  if (!store) {
    throw new Error('Tienda no encontrada');
  }

  if (!store.isActive) {
    throw new Error('La tienda está cerrada en este momento');
  }

  // Validar dirección de entrega del cliente
  const deliveryAddress = await prisma.address.findFirst({
    where: {
      id: input.deliveryAddressId,
      userId: input.customerId,
    },
  });

  if (!deliveryAddress) {
    throw new Error('Dirección de entrega no válida');
  }

  // Validar método de pago
  const paymentMethod = await prisma.paymentMethod.findFirst({
    where: {
      id: input.paymentMethodId,
      userId: input.customerId,
      isActive: true,
    },
  });

  if (!paymentMethod) {
    throw new Error('Método de pago no válido o inactivo');
  }

  const storeLocation: GeoPoint = {
    latitude: store.address.latitude,
    longitude: store.address.longitude,
  };

  const deliveryLocation: GeoPoint = {
    latitude: deliveryAddress.latitude,
    longitude: deliveryAddress.longitude,
  };

  // Calcular precios con validación
  const priceBreakdown = await calculateOrderPrice(
    input.items,
    storeLocation,
    deliveryLocation,
    input.promoCode
  );

  const distanceKm = calculateDistance(storeLocation, deliveryLocation);
  const estimatedTime = calculateEstimatedDeliveryTime(
    distanceKm,
    store.averagePreparationTime,
    isRushHour()
  );

  const orderNumber = generateOrderNumber();

  // Crear el pedido en una transacción para garantizar consistencia
  const order = await prisma.$transaction(async (tx) => {
    // Crear el pedido principal
    const newOrder = await tx.order.create({
      data: {
        orderNumber,
        customerId: input.customerId,
        storeId: input.storeId,
        deliveryAddressId: input.deliveryAddressId,
        paymentMethodId: input.paymentMethodId,
        status: OrderStatus.PENDING,
        subtotal: priceBreakdown.subtotal,
        deliveryFee: priceBreakdown.deliveryFee,
        serviceFee: priceBreakdown.serviceFee,
        discount: priceBreakdown.discount,
        taxes: priceBreakdown.taxes,
        total: priceBreakdown.total,
        promoCode: input.promoCode,
        specialInstructions: input.specialInstructions,
        scheduledFor: input.scheduledFor,
        estimatedDeliveryTime: estimatedTime,
        distanceKm,
        items: {
          create: await Promise.all(
            input.items.map(async (item) => {
              const product = await tx.product.findUnique({
                where: { id: item.productId },
                select: { price: true, name: true },
              });

              const customizationCost = (item.customizations || []).reduce(
                (sum, c) => sum + c.extraCost,
                0
              );

              return {
                productId: item.productId,
                productName: product!.name,
                quantity: item.quantity,
                unitPrice: product!.price + customizationCost,
                totalPrice: (product!.price + customizationCost) * item.quantity,
                customizations: item.customizations as Prisma.JsonArray,
                notes: item.notes,
              };
            })
          ),
        },
        tracking: {
          create: {
            status: OrderStatus.PENDING,
            description: 'Pedido recibido y en espera de confirmación',
            timestamp: new Date(),
          },
        },
      },
      include: {
        items: true,
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
        store: {
          select: {
            id: true,
            name: true,
            phone: true,
            averagePreparationTime: true,
            address: {
              select: { street: true, city: true },
            },
          },
        },
        deliveryAddress: true,
        driver: {
          select: {
            id: true,
            name: true,
            phone: true,
            vehicleType: true,
            rating: true,
          },
        },
        tracking: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    // Incrementar el contador de uso del código promo
    if (input.promoCode && priceBreakdown.promoApplied) {
      await tx.promoCode.update({
        where: { code: input.promoCode.toUpperCase