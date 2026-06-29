import { EventEmitter } from 'events';

// ============================================================
// Servicio de Delivery - Gestión completa de entregas en tiempo real
// Similar a Rappi pero optimizado para velocidad máxima de entrega
// ============================================================

// --- Tipos e Interfaces ---

export type EstadoEntrega =
  | 'pendiente'
  | 'asignado'
  | 'en_camino_tienda'
  | 'en_tienda'
  | 'recogido'
  | 'en_camino_cliente'
  | 'cerca_destino'
  | 'entregado'
  | 'fallido'
  | 'cancelado';

export type TipoVehiculo = 'bicicleta' | 'moto' | 'carro' | 'a_pie';

export interface Coordenadas {
  lat: number;
  lng: number;
}

export interface DireccionEntrega {
  id: string;
  calle: string;
  numero: string;
  apartamento?: string;
  ciudad: string;
  barrio: string;
  codigoPostal: string;
  coordenadas: Coordenadas;
  instrucciones?: string;
  nombreContacto: string;
  telefonoContacto: string;
}

export interface Domiciliario {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string;
  foto: string;
  calificacion: number;
  totalEntregas: number;
  vehiculo: TipoVehiculo;
  placaVehiculo?: string;
  ubicacionActual: Coordenadas;
  disponible: boolean;
  activo: boolean;
  zonaCobertura: string[];
  tiempoPromedioEntrega: number; // en minutos
}

export interface ItemPedido {
  productoId: string;
  nombre: string;
  cantidad: number;
  precio: number;
  notas?: string;
}

export interface Pedido {
  id: string;
  usuarioId: string;
  tiendaId: string;
  nombreTienda: string;
  items: ItemPedido[];
  subtotal: number;
  costoEnvio: number;
  propina: number;
  total: number;
  metodoPago: string;
  direccionEntrega: DireccionEntrega;
  coordenadasTienda: Coordenadas;
  estado: EstadoEntrega;
  domiciliarioId?: string;
  domiciliario?: Domiciliario;
  fechaCreacion: Date;
  fechaAsignacion?: Date;
  fechaRecogida?: Date;
  fechaEntrega?: Date;
  tiempoEstimadoMinutos: number;
  codigoConfirmacion: string;
  notas?: string;
}

export interface ActualizacionUbicacion {
  domiciliarioId: string;
  pedidoId: string;
  coordenadas: Coordenadas;
  velocidadKmh: number;
  timestamp: Date;
  distanciaRestanteMetros: number;
  tiempoRestanteMinutos: number;
}

export interface ResultadoAsignacion {
  exito: boolean;
  domiciliarioId?: string;
  tiempoEstimadoMinutos?: number;
  distanciaKm?: number;
  mensaje: string;
}

export interface MetricasEntrega {
  pedidoId: string;
  tiempoTotalMinutos: number;
  tiempoEsperaAsignacionMinutos: number;
  tiempoEnTiendaMinutos: number;
  tiempoTransitoMinutos: number;
  distanciaRecorridaKm: number;
  calificacionCliente?: number;
  comentarioCliente?: string;
}

export interface ConfiguracionZona {
  zonaId: string;
  nombre: string;
  poligono: Coordenadas[];
  costoEnvioBase: number;
  costoEnvioPorKm: number;
  tiempoPromedioMinutos: number;
  activa: boolean;
  horaInicio: string; // "HH:MM"
  horaFin: string;    // "HH:MM"
}

export interface RutaOptimizada {
  origen: Coordenadas;
  destino: Coordenadas;
  distanciaKm: number;
  tiempoMinutos: number;
  puntosMedio: Coordenadas[];
  traficoActual: 'ligero' | 'moderado' | 'pesado';
}

// --- Repositorio simulado (en producción conecta a tu ORM/DB) ---

const domiciliariosActivos: Map<string, Domiciliario> = new Map();
const pedidosActivos: Map<string, Pedido> = new Map();
const historialUbicaciones: Map<string, ActualizacionUbicacion[]> = new Map();
const zonasCobertura: Map<string, ConfiguracionZona> = new Map();

// --- Clase principal del servicio ---

export class DeliveryService extends EventEmitter {
  private readonly RADIO_BUSQUEDA_KM = 5;
  private readonly MAX_INTENTOS_ASIGNACION = 3;
  private readonly TIMEOUT_ASIGNACION_MS = 30000; // 30 segundos
  private readonly VELOCIDAD_PROMEDIO_MOTO_KMH = 35;
  private readonly VELOCIDAD_PROMEDIO_BICI_KMH = 15;

  constructor() {
    super();
    this.inicializarZonasCobertura();
  }

  // ============================================================
  // Inicialización de zonas de cobertura predeterminadas
  // ============================================================
  private inicializarZonasCobertura(): void {
    const zonas: ConfiguracionZona[] = [
      {
        zonaId: 'zona_norte',
        nombre: 'Zona Norte',
        poligono: [], // coordenadas del polígono definidas por operaciones
        costoEnvioBase: 3500,
        costoEnvioPorKm: 800,
        tiempoPromedioMinutos: 22,
        activa: true,
        horaInicio: '06:00',
        horaFin: '23:59',
      },
      {
        zonaId: 'zona_centro',
        nombre: 'Zona Centro',
        poligono: [],
        costoEnvioBase: 3000,
        costoEnvioPorKm: 700,
        tiempoPromedioMinutos: 18,
        activa: true,
        horaInicio: '00:00',
        horaFin: '23:59',
      },
      {
        zonaId: 'zona_sur',
        nombre: 'Zona Sur',
        poligono: [],
        costoEnvioBase: 3500,
        costoEnvioPorKm: 850,
        tiempoPromedioMinutos: 25,
        activa: true,
        horaInicio: '07:00',
        horaFin: '23:00',
      },
    ];

    zonas.forEach((zona) => zonasCobertura.set(zona.zonaId, zona));
  }

  // ============================================================
  // Calcular distancia entre dos coordenadas (fórmula Haversine)
  // ============================================================
  private calcularDistanciaKm(origen: Coordenadas, destino: Coordenadas): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.gradosARadianes(destino.lat - origen.lat);
    const dLng = this.gradosARadianes(destino.lng - origen.lng);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.gradosARadianes(origen.lat)) *
        Math.cos(this.gradosARadianes(destino.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private gradosARadianes(grados: number): number {
    return grados * (Math.PI / 180);
  }

  // ============================================================
  // Estimar tiempo de entrega basado en distancia y vehículo
  // ============================================================
  private estimarTiempoMinutos(
    distanciaKm: number,
    vehiculo: TipoVehiculo,
    incluirTiempoTienda: boolean = true
  ): number {
    const velocidades: Record<TipoVehiculo, number> = {
      moto: this.VELOCIDAD_PROMEDIO_MOTO_KMH,
      bicicleta: this.VELOCIDAD_PROMEDIO_BICI_KMH,
      carro: 25,
      a_pie: 5,
    };

    const velocidad = velocidades[vehiculo];
    const tiempoTransito = (distanciaKm / velocidad) * 60;
    const tiempoTienda = incluirTiempoTienda ? 8 : 0; // 8 min promedio en tienda
    const tiempoBuffer = 2; // buffer de imprevistos

    return Math.ceil(tiempoTransito + tiempoTienda + tiempoBuffer);
  }

  // ============================================================
  // Calcular costo de envío basado en distancia y zona
  // ============================================================
  calcularCostoEnvio(
    coordenadasOrigen: Coordenadas,
    coordenadasDestino: Coordenadas,
    zonaId: string = 'zona_centro'
  ): number {
    const zona = zonasCobertura.get(zonaId);
    if (!zona) {
      throw new Error(`Zona de cobertura no encontrada: ${zonaId}`);
    }

    const distancia = this.calcularDistanciaKm(coordenadasOrigen, coordenadasDestino);
    const costoTotal = zona.costoEnvioBase + distancia * zona.costoEnvioPorKm;

    // Redondear al múltiplo de 100 más cercano
    return Math.ceil(costoTotal / 100) * 100;
  }

  // ============================================================
  // Encontrar domiciliarios disponibles cercanos al punto de origen
  // ============================================================
  async encontrarDomiciliariosCercanos(
    coordenadas: Coordenadas,
    radioKm: number = this.RADIO_BUSQUEDA_KM,
    vehiculoPreferido?: TipoVehiculo
  ): Promise<Domiciliario[]> {
    const domiciliarios: Domiciliario[] = [];

    domiciliariosActivos.forEach((domiciliario) => {
      if (!domiciliario.disponible || !domiciliario.activo) return;

      const distancia = this.calcularDistanciaKm(
        coordenadas,
        domiciliario.ubicacionActual
      );

      if (distancia <= radioKm) {
        if (!vehiculoPreferido || domiciliario.vehiculo === vehiculoPreferido) {
          domiciliarios.push(domiciliario);
        }
      }
    });

    // Ordenar por: 1) distancia más corta, 2) mejor calificación, 3) más rápido
    return domiciliarios.sort((a, b) => {
      const distA = this.calcularDistanciaKm(coordenadas, a.ubicacionActual);
      const distB = this.calcularDistanciaKm(coordenadas, b.ubicacionActual);

      if (Math.abs(distA - distB) < 0.3) {
        // Si están a distancia similar, priorizar calificación
        return b.calificacion - a.calificacion;
      }
      return distA - distB;
    });
  }

  // ============================================================
  // Asignar domiciliario automáticamente a un pedido
  // ============================================================
  async asignarDomiciliario(pedidoId: string): Promise<ResultadoAsignacion> {
    const pedido = pedidosActivos.get(pedidoId);
    if (!pedido) {
      return {
        exito: false,
        mensaje: `Pedido ${pedidoId} no encontrado`,
      };
    }

    if (pedido.estado !== 'pendiente') {
      return {
        exito: false,
        mensaje: `El pedido ya tiene estado: ${pedido.estado}`,
      };
    }

    let intentos = 0;
    let radioActual = this.RADIO_BUSQUEDA_KM;

    while (intentos < this.MAX_INTENTOS_ASIGNACION) {
      const domiciliariosCercanos = await this.encontrarDomiciliariosCercanos(
        pedido.coordenadasTienda,
        radioActual
      );

      if (domiciliariosCercanos.length > 0) {
        const mejorDomiciliario = domiciliariosCercanos[0];

        // Calcular distancia total: domiciliario -> tienda -> cliente
        const distTienda = this.calcularDistanciaKm(
          mejorDomiciliario.ubicacionActual,
          pedido.coordenadasTienda
        );
        const distCliente = this.calcularDistanciaKm(
          pedido.coordenadasTienda,
          pedido.direccionEntrega.coordenadas
        );
        const distanciaTotal = distTienda + distCliente;

        const tiempoEstimado = this.estimarTiempoMinutos(
          distanciaTotal,
          mejorDomiciliario.vehiculo
        );

        // Actualizar pedido
        pedido.domiciliarioId = mejorDomiciliario.id;
        pedido.domiciliario = mejorDomiciliario;
        pedido.estado = 'asignado';
        pedido.fechaAsignacion = new Date();
        pedido.tiempoEstimadoMinutos = tiempoEstimado;
        pedidosActivos.set(pedidoId, pedido);

        // Marcar domiciliario como no disponible
        mejorDomiciliario.disponible = false;
        domiciliariosActivos.set(mejorDomiciliario.id, mejorDomiciliario);

        // Emitir evento de asignación exitosa
        this.emit('pedido:asignado', {
          pedidoId,
          domiciliarioId: mejorDomiciliario.id,
          tiempoEstimado,
        });

        return {
          exito: true,
          domiciliarioId: mejorDomiciliario.id,
          tiempoEstimadoMinutos: tiempoEstimado,
          distanciaKm: distanciaTotal,
          mensaje: `Domiciliario ${mejorDomiciliario.nombre} asignado exitosamente`,
        };
      }

      // Ampliar radio de búsqueda en cada intento
      radioActual += 2;
      intentos++;

      // Esperar un poco antes del siguiente intento
      await new Promise((resolve) =>