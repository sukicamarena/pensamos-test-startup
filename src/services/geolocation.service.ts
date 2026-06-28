// Servicio de geolocalización para plataforma de delivery tipo Rappi
// Maneja la ubicación de usuarios, repartidores y restaurantes en tiempo real

import { EventEmitter } from 'events';

// ============================================================
// TIPOS E INTERFACES
// ============================================================

export interface Coordenadas {
  latitud: number;
  longitud: number;
  precision?: number; // metros
  altitud?: number;
  velocidad?: number; // km/h
  rumbo?: number; // grados 0-360
  timestamp: Date;
}

export interface UbicacionRepartidor {
  repartidorId: string;
  coordenadas: Coordenadas;
  estadoEntrega: 'disponible' | 'recogiendo' | 'en_camino' | 'entregado' | 'desconectado';
  pedidoActualId?: string;
  ultimaActualizacion: Date;
}

export interface UbicacionUsuario {
  usuarioId: string;
  coordenadas: Coordenadas;
  direccionTexto?: string;
  esDireccionGuardada: boolean;
  ultimaActualizacion: Date;
}

export interface RestauranteUbicacion {
  restauranteId: string;
  nombre: string;
  coordenadas: Coordenadas;
  radioEntregaKm: number;
  activo: boolean;
}

export interface ZonaCobertura {
  zonaId: string;
  nombre: string;
  poligono: Coordenadas[];
  activa: boolean;
  tarifaBase: number;
  tarifaKm: number;
}

export interface CalculoRuta {
  distanciaKm: number;
  tiempoEstimadoMinutos: number;
  costoEnvio: number;
  ruta?: Coordenadas[];
}

export interface RepartidorCercano {
  repartidorId: string;
  distanciaKm: number;
  tiempoEstimadoMinutos: number;
  coordenadas: Coordenadas;
  estadoEntrega: UbicacionRepartidor['estadoEntrega'];
}

export interface DireccionGeocoded {
  direccionCompleta: string;
  calle: string;
  numero: string;
  colonia: string;
  ciudad: string;
  estado: string;
  codigoPostal: string;
  pais: string;
  coordenadas: Coordenadas;
  confianza: number; // 0-1
}

export interface ConfiguracionGeolocation {
  googleMapsApiKey?: string;
  mapboxApiKey?: string;
  radioMaxBusquedaRepartidoresKm: number;
  intervaloActualizacionRepartidorMs: number;
  tiempoEsperaMaximoMs: number;
  velocidadPromedioRepartidorKmh: number;
  factorTraficoUrbanio: number; // multiplicador para tiempo estimado
}

// ============================================================
// CONSTANTES
// ============================================================

const RADIO_TIERRA_KM = 6371;
const VELOCIDAD_PROMEDIO_MOTO_KMH = 30; // velocidad promedio en ciudad con tráfico
const FACTOR_RUTA_REAL = 1.3; // distancia real vs línea recta (calles no son directas)
const TIEMPO_PREPARACION_BASE_MIN = 5; // tiempo base para que el repartidor llegue al restaurante

// ============================================================
// CLASE PRINCIPAL DEL SERVICIO
// ============================================================

export class GeolocationService extends EventEmitter {
  private config: ConfiguracionGeolocation;
  private ubicacionesRepartidores: Map<string, UbicacionRepartidor> = new Map();
  private zonasCobertura: Map<string, ZonaCobertura> = new Map();
  private intervalosActualizacion: Map<string, NodeJS.Timer> = new Map();

  constructor(config: Partial<ConfiguracionGeolocation> = {}) {
    super();

    // Configuración por defecto optimizada para delivery rápido
    this.config = {
      radioMaxBusquedaRepartidoresKm: 10,
      intervaloActualizacionRepartidorMs: 5000, // actualizar cada 5 segundos
      tiempoEsperaMaximoMs: 10000,
      velocidadPromedioRepartidorKmh: VELOCIDAD_PROMEDIO_MOTO_KMH,
      factorTraficoUrbanio: FACTOR_RUTA_REAL,
      ...config,
    };
  }

  // ============================================================
  // CÁLCULO DE DISTANCIAS (FÓRMULA HAVERSINE)
  // ============================================================

  /**
   * Calcula la distancia en kilómetros entre dos coordenadas usando la fórmula Haversine
   * Más precisa que la distancia euclidiana para distancias en la superficie terrestre
   */
  calcularDistanciaKm(origen: Coordenadas, destino: Coordenadas): number {
    const dLatRad = this.gradosARadianes(destino.latitud - origen.latitud);
    const dLonRad = this.gradosARadianes(destino.longitud - origen.longitud);

    const latOrigenRad = this.gradosARadianes(origen.latitud);
    const latDestinoRad = this.gradosARadianes(destino.latitud);

    const a =
      Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) +
      Math.cos(latOrigenRad) *
        Math.cos(latDestinoRad) *
        Math.sin(dLonRad / 2) *
        Math.sin(dLonRad / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanciaLineal = RADIO_TIERRA_KM * c;

    // Ajustamos por factor de ruta real (las calles no son líneas rectas)
    return distanciaLineal * this.config.factorTraficoUrbanio;
  }

  /**
   * Convierte grados a radianes
   */
  private gradosARadianes(grados: number): number {
    return grados * (Math.PI / 180);
  }

  // ============================================================
  // ESTIMACIÓN DE TIEMPOS
  // ============================================================

  /**
   * Estima el tiempo de llegada en minutos dado una distancia en km
   * Considera velocidad promedio de moto en ciudad + factor tráfico
   */
  estimarTiempoMinutos(distanciaKm: number): number {
    const tiempoViaje = (distanciaKm / this.config.velocidadPromedioRepartidorKmh) * 60;
    // Agregamos tiempo base para arranque, semáforos, estacionamiento, etc.
    const tiempoExtra = Math.max(2, distanciaKm * 1.5);
    return Math.ceil(tiempoViaje + tiempoExtra);
  }

  /**
   * Calcula el tiempo total estimado de entrega:
   * tiempo repartidor → restaurante + tiempo preparación + tiempo restaurante → cliente
   */
  calcularTiempoEntregaTotal(
    coordenadasRepartidor: Coordenadas,
    coordenadasRestaurante: Coordenadas,
    coordenadasCliente: Coordenadas,
    tiempoPreparacionRestauranteMin: number = 15
  ): {
    tiempoRepartidorARestaurante: number;
    tiempoPreparacion: number;
    tiempoRestauranteACliente: number;
    tiempoTotalMin: number;
    tiempoTotalMax: number;
  } {
    const distanciaRepartidorRestaurante = this.calcularDistanciaKm(
      coordenadasRepartidor,
      coordenadasRestaurante
    );
    const distanciaRestauranteCliente = this.calcularDistanciaKm(
      coordenadasRestaurante,
      coordenadasCliente
    );

    const tiempoRepartidorARestaurante = this.estimarTiempoMinutos(distanciaRepartidorRestaurante);
    const tiempoRestauranteACliente = this.estimarTiempoMinutos(distanciaRestauranteCliente);

    // El repartidor puede llegar antes que esté listo el pedido, esperamos el mayor
    const tiempoEsperaEnRestaurante = Math.max(
      0,
      tiempoPreparacionRestauranteMin - tiempoRepartidorARestaurante
    );

    const tiempoTotal =
      tiempoRepartidorARestaurante + tiempoEsperaEnRestaurante + tiempoRestauranteACliente;

    return {
      tiempoRepartidorARestaurante,
      tiempoPreparacion: tiempoPreparacionRestauranteMin,
      tiempoRestauranteACliente,
      tiempoTotalMin: Math.max(tiempoTotal - 5, 10), // mínimo 10 min
      tiempoTotalMax: tiempoTotal + 10, // rango de +10 min
    };
  }

  // ============================================================
  // CÁLCULO DE COSTO DE ENVÍO
  // ============================================================

  /**
   * Calcula el costo de envío basado en distancia y zona de cobertura
   */
  calcularCostoEnvio(
    coordenadasRestaurante: Coordenadas,
    coordenadasCliente: Coordenadas,
    zonaId?: string
  ): {
    costoBase: number;
    costoPorDistancia: number;
    costoTotal: number;
    distanciaKm: number;
    aplicaDescuento: boolean;
  } {
    const distanciaKm = this.calcularDistanciaKm(coordenadasRestaurante, coordenadasCliente);

    let tarifaBase = 15; // precio base en pesos mexicanos
    let tarifaKm = 4; // precio por km adicional

    // Si hay zona configurada, usar sus tarifas
    if (zonaId && this.zonasCobertura.has(zonaId)) {
      const zona = this.zonasCobertura.get(zonaId)!;
      tarifaBase = zona.tarifaBase;
      tarifaKm = zona.tarifaKm;
    }

    // Los primeros 2 km van incluidos en la tarifa base
    const kmAdicionales = Math.max(0, distanciaKm - 2);
    const costoPorDistancia = kmAdicionales * tarifaKm;
    const costoTotal = tarifaBase + costoPorDistancia;

    // Descuento para pedidos en radio de 1km (entrega ultra rápida)
    const aplicaDescuento = distanciaKm <= 1;

    return {
      costoBase: tarifaBase,
      costoPorDistancia,
      costoTotal: aplicaDescuento ? costoTotal * 0.8 : costoTotal,
      distanciaKm,
      aplicaDescuento,
    };
  }

  // ============================================================
  // GESTIÓN DE UBICACIONES DE REPARTIDORES
  // ============================================================

  /**
   * Actualiza la ubicación de un repartidor en el mapa
   * Se llama desde el dispositivo del repartidor vía WebSocket
   */
  actualizarUbicacionRepartidor(
    repartidorId: string,
    coordenadas: Coordenadas,
    estado: UbicacionRepartidor['estadoEntrega'],
    pedidoActualId?: string
  ): void {
    const ubicacionAnterior = this.ubicacionesRepartidores.get(repartidorId);

    const nuevaUbicacion: UbicacionRepartidor = {
      repartidorId,
      coordenadas: {
        ...coordenadas,
        timestamp: new Date(),
      },
      estadoEntrega: estado,
      pedidoActualId,
      ultimaActualizacion: new Date(),
    };

    this.ubicacionesRepartidores.set(repartidorId, nuevaUbicacion);

    // Emitir evento para que los clientes suscritos reciban actualización en tiempo real
    this.emit('repartidor:ubicacion_actualizada', {
      repartidorId,
      ubicacion: nuevaUbicacion,
      ubicacionAnterior,
    });

    // Si hay un pedido activo, emitir evento específico del pedido
    if (pedidoActualId) {
      this.emit(`pedido:${pedidoActualId}:ubicacion`, {
        coordenadas: nuevaUbicacion.coordenadas,
        estadoEntrega: estado,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Obtiene la ubicación actual de un repartidor específico
   */
  obtenerUbicacionRepartidor(repartidorId: string): UbicacionRepartidor | null {
    const ubicacion = this.ubicacionesRepartidores.get(repartidorId);

    if (!ubicacion) return null;

    // Verificar que la ubicación no esté desactualizada (más de 2 minutos)
    const tiempoLimiteMs = 2 * 60 * 1000;
    const tiempoTranscurrido = Date.now() - ubicacion.ultimaActualizacion.getTime();

    if (tiempoTranscurrido > tiempoLimiteMs) {
      // Marcar como desconectado si no ha enviado ubicación recientemente
      ubicacion.estadoEntrega = 'desconectado';
      this.ubicacionesRepartidores.set(repartidorId, ubicacion);
    }

    return ubicacion;
  }

  /**
   * Encuentra los repartidores disponibles más cercanos a unas coordenadas
   * Optimizado para asignación rápida de pedidos
   */
  encontrarRepartidoresCercanos(
    coordenadas: Coordenadas,
    limite: number = 5,
    soloDisponibles: boolean = true
  ): RepartidorCercano[] {
    const repartidoresCercanos: RepartidorCercano[] = [];

    for (const [repartidorId, ubicacion] of this.ubicacionesRepartidores) {
      // Filtrar por estado si se requieren solo disponibles
      if (soloDisponibles && ubicacion.estadoEntrega !== 'disponible') {
        continue;
      }

      // Filtrar desconectados
      if (ubicacion.estadoEntrega === 'desconectado') {
        continue;
      }

      const distanciaKm = this.calcularDistanciaKm(coordenadas, ubicacion.coordenadas);

      // Solo incluir repartidores dentro del radio máximo de búsqueda
      if (distanciaKm <= this.config.radioMaxBusquedaRepartidoresKm) {
        repartidoresCercanos.push({
          repartidorId,
          distanciaKm,
          tiempoEstimadoMinutos: this.estimarTiempoMinutos(distanc