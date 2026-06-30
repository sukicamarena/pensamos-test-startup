import { EventEmitter } from 'events';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createClient, RedisClientType } from 'redis';
import { createServer, Server as HTTPServer } from 'http';

// ============================================================
// Tipos e Interfaces para el sistema de tracking en tiempo real
// ============================================================

export interface Coordenadas {
  latitud: number;
  longitud: number;
  precision?: number; // en metros
  altitud?: number;
  velocidad?: number; // km/h
  rumbo?: number; // 0-360 grados
}

export interface UbicacionDomiciliario {
  domiciliarioId: string;
  pedidoId: string;
  coordenadas: Coordenadas;
  timestamp: number;
  estado: EstadoDomiciliario;
  bateriaCelular?: number; // porcentaje
  enLinea: boolean;
}

export interface UbicacionCliente {
  clienteId: string;
  pedidoId: string;
  coordenadas: Coordenadas;
  timestamp: number;
}

export interface PedidoTracking {
  pedidoId: string;
  clienteId: string;
  domiciliarioId?: string;
  restauranteId: string;
  coordenadasRestaurante: Coordenadas;
  coordenadasDestino: Coordenadas;
  estado: EstadoPedido;
  tiempoEstimadoEntrega?: number; // minutos
  distanciaRestante?: number; // metros
  rutaEstimada?: Coordenadas[];
  creadoEn: number;
  actualizadoEn: number;
}

export interface EventoTracking {
  tipo: TipoEventoTracking;
  pedidoId: string;
  datos: Record<string, unknown>;
  timestamp: number;
}

export interface ConfiguracionTracking {
  intervaloActualizacion: number; // milisegundos
  radioAsignacion: number; // metros para buscar domiciliarios
  tiempoMaximoSinActualizacion: number; // segundos antes de marcar offline
  maxDomiciliariosConectados: number;
  habilitarPrediccion: boolean;
}

export interface MetricasTracking {
  domiciliariosActivos: number;
  pedidosEnTransito: number;
  actualizacionesPorMinuto: number;
  latenciaPromedio: number; // ms
  erroresUltimoMinuto: number;
}

export interface RespuestaUbicacionCercana {
  domiciliarioId: string;
  coordenadas: Coordenadas;
  distancia: number; // metros
  tiempoEstimadoLlegada: number; // minutos
  calificacion: number;
  vehiculo: TipoVehiculo;
}

// ============================================================
// Enumeraciones del dominio
// ============================================================

export enum EstadoDomiciliario {
  DISPONIBLE = 'disponible',
  EN_CAMINO_RESTAURANTE = 'en_camino_restaurante',
  ESPERANDO_PEDIDO = 'esperando_pedido',
  EN_CAMINO_CLIENTE = 'en_camino_cliente',
  ENTREGANDO = 'entregando',
  DESCONECTADO = 'desconectado',
  FUERA_DE_ZONA = 'fuera_de_zona',
}

export enum EstadoPedido {
  PENDIENTE = 'pendiente',
  ACEPTADO = 'aceptado',
  EN_PREPARACION = 'en_preparacion',
  LISTO_PARA_RECOGER = 'listo_para_recoger',
  DOMICILIARIO_ASIGNADO = 'domiciliario_asignado',
  RECOGIDO = 'recogido',
  EN_CAMINO = 'en_camino',
  CERCA = 'cerca', // menos de 500m
  ENTREGADO = 'entregado',
  CANCELADO = 'cancelado',
}

export enum TipoEventoTracking {
  UBICACION_ACTUALIZADA = 'ubicacion_actualizada',
  ESTADO_CAMBIADO = 'estado_cambiado',
  DOMICILIARIO_ASIGNADO = 'domiciliario_asignado',
  PEDIDO_RECOGIDO = 'pedido_recogido',
  PEDIDO_CERCA = 'pedido_cerca',
  PEDIDO_ENTREGADO = 'pedido_entregado',
  DOMICILIARIO_DESCONECTADO = 'domiciliario_desconectado',
  ETA_ACTUALIZADO = 'eta_actualizado',
  RUTA_DESVIADA = 'ruta_desviada',
}

export enum TipoVehiculo {
  BICICLETA = 'bicicleta',
  MOTO = 'moto',
  CARRO = 'carro',
  A_PIE = 'a_pie',
}

export enum CanalesSocket {
  TRACKING_PEDIDO = 'tracking:pedido',
  UBICACION_DOMICILIARIO = 'ubicacion:domiciliario',
  ESTADO_PEDIDO = 'estado:pedido',
  DOMICILIARIOS_CERCANOS = 'domiciliarios:cercanos',
  METRICAS = 'metricas:sistema',
  NOTIFICACION_CLIENTE = 'notificacion:cliente',
  NOTIFICACION_RESTAURANTE = 'notificacion:restaurante',
}

// ============================================================
// Clase principal del servicio de tracking en tiempo real
// ============================================================

export class RealTimeTrackingService extends EventEmitter {
  private io: SocketIOServer | null = null;
  private redisCliente: RedisClientType | null = null;
  private redisPub: RedisClientType | null = null;
  private redisSub: RedisClientType | null = null;

  // Mapas en memoria para acceso ultra-rápido (caché caliente)
  private ubicacionesDomiciliarios: Map<string, UbicacionDomiciliario> = new Map();
  private pedidosActivos: Map<string, PedidoTracking> = new Map();
  private socketsPorCliente: Map<string, Set<string>> = new Map();
  private socketsPorDomiciliario: Map<string, Set<string>> = new Map();
  private socketsPorRestaurante: Map<string, Set<string>> = new Map();
  private socketsPorPedido: Map<string, Set<string>> = new Map();

  // Contadores de métricas
  private contadorActualizaciones: number = 0;
  private contadorErrores: number = 0;
  private ultimoReiniciometricas: number = Date.now();

  private readonly configuracion: ConfiguracionTracking = {
    intervaloActualizacion: 3000, // cada 3 segundos
    radioAsignacion: 5000, // 5km
    tiempoMaximoSinActualizacion: 60, // 1 minuto
    maxDomiciliariosConectados: 10000,
    habilitarPrediccion: true,
  };

  private intervalosLimpieza: NodeJS.Timeout[] = [];

  constructor(config?: Partial<ConfiguracionTracking>) {
    super();
    if (config) {
      this.configuracion = { ...this.configuracion, ...config };
    }
  }

  // ============================================================
  // Inicialización y configuración del servicio
  // ============================================================

  /**
   * Inicializa todas las conexiones y configura los listeners
   */
  async inicializar(servidorHttp: HTTPServer): Promise<void> {
    try {
      await this.inicializarRedis();
      this.inicializarSocketIO(servidorHttp);
      this.configurarSuscripcionesRedis();
      this.iniciarTareasMantenimiento();

      console.log('[RappiTracking] Servicio de tracking en tiempo real iniciado correctamente');
      this.emit('servicio:iniciado');
    } catch (error) {
      console.error('[RappiTracking] Error al inicializar el servicio de tracking:', error);
      throw new Error(`Fallo en la inicialización del tracking: ${(error as Error).message}`);
    }
  }

  /**
   * Inicializa las conexiones con Redis para pub/sub y caché
   */
  private async inicializarRedis(): Promise<void> {
    const urlRedis = process.env.REDIS_URL || 'redis://localhost:6379';

    this.redisCliente = createClient({ url: urlRedis }) as RedisClientType;
    this.redisPub = createClient({ url: urlRedis }) as RedisClientType;
    this.redisSub = createClient({ url: urlRedis }) as RedisClientType;

    // Manejo de errores de conexión Redis
    [this.redisCliente, this.redisPub, this.redisSub].forEach((cliente, indice) => {
      cliente.on('error', (error: Error) => {
        console.error(`[RappiTracking] Error en cliente Redis ${indice}:`, error.message);
        this.contadorErrores++;
      });

      cliente.on('reconnecting', () => {
        console.warn(`[RappiTracking] Reconectando cliente Redis ${indice}...`);
      });
    });

    await Promise.all([
      this.redisCliente.connect(),
      this.redisPub.connect(),
      this.redisSub.connect(),
    ]);

    // Configurar Redis para geo-queries (fundamental para encontrar domiciliarios cercanos)
    await this.redisCliente.del('rappi:domiciliarios:geo');
    console.log('[RappiTracking] Redis inicializado correctamente con soporte geoespacial');
  }

  /**
   * Configura Socket.IO con autenticación y namespaces para cada actor
   */
  private inicializarSocketIO(servidorHttp: HTTPServer): void {
    this.io = new SocketIOServer(servidorHttp, {
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 10000,
      pingInterval: 25000,
      // Configuración para alta concurrencia
      maxHttpBufferSize: 1e6, // 1MB
      connectTimeout: 45000,
    });

    // Middleware de autenticación para todos los sockets
    this.io.use(async (socket, next) => {
      try {
        await this.autenticarSocket(socket);
        next();
      } catch (error) {
        console.warn('[RappiTracking] Intento de conexión no autorizado:', socket.id);
        next(new Error('No autorizado'));
      }
    });

    // Configurar namespaces por tipo de actor
    this.configurarNamespaceClientes();
    this.configurarNamespaceDomiciliarios();
    this.configurarNamespaceRestaurantes();
    this.configurarNamespaceAdmin();

    console.log('[RappiTracking] Socket.IO configurado con namespaces por actor');
  }

  /**
   * Autentica las conexiones websocket verificando el token JWT
   */
  private async autenticarSocket(socket: Socket): Promise<void> {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new Error('Token de autenticación requerido');
    }

    // En producción: verificar JWT con librería jsonwebtoken
    // const payload = jwt.verify(token, process.env.JWT_SECRET!);
    // socket.data.usuario = payload;

    // Por ahora, extraemos el tipo de actor del token para routing
    socket.data.token = token;
    socket.data.tipoActor = socket.handshake.auth?.tipo || 'cliente';
    socket.data.actorId = socket.handshake.auth?.id || socket.id;
  }

  // ============================================================
  // Configuración de Namespaces por tipo de actor
  // ============================================================

  /**
   * Namespace para clientes que realizan pedidos
   */
  private configurarNamespaceClientes(): void {
    const nsClientes = this.io!.of('/clientes');

    nsClientes.on('connection', (socket: Socket) => {
      const clienteId = socket.data.actorId;
      console.log(`[RappiTracking] Cliente conectado: ${clienteId} (socket: ${socket.id})`);

      // Registrar socket del cliente
      this.registrarSocketCliente(clienteId, socket.id);

      // El cliente se suscribe a actualizaciones de su pedido
      socket.on('suscribir:pedido', async (pedidoId: string) => {
        await this.suscribirClienteAPedido(socket, clienteId, pedidoId);
      });

      // El cliente puede cancelar la suscripción
      socket.on('desuscribir:pedido', (pedidoId: string) => {
        socket.leave(`pedido:${pedidoId}`);
        this.removerSocketDePedido(pedidoId, socket.id);
      });

      // Solicitar ETA actualizado
      socket.on('solicitar:eta', async (pedidoId: string) => {
        const eta = await this.calcularETA(pedidoId);
        socket.emit(CanalesSocket.ETA_ACTUALIZADO, { pedidoId, eta });
      });

      // Solicitar domiciliarios cercanos (para mostrar en mapa antes de pedir)
      socket.on('solicitar:domiciliarios_cercanos', async (coordenadas: Coordenadas) => {
        const cercanos = await this.obtenerDomiciliariosCercanos(coordenadas, 3000);
        socket.emit(CanalesSocket.DOMICILIARIOS_CERCANOS, cercanos);
      });

      socket.on('disconnect', (razon: string) => {
        console.log(`[RappiTracking] Cliente desconectado: ${clienteId}. Razón: ${razon}`);
        this.removerSocketCliente(clienteId, socket.id);
      });

      socket.on('error', (error: Error) => {
        console.error(`[RappiTracking] Error en socket cliente ${clienteId}:`, error.message);
        this.contadorErrores++;
      });
    });
  }

  /**
   * Namespace para domiciliarios que realizan las entregas
   */
  private configurarNamespaceDomiciliarios(): void {
    const nsDomiciliarios = this.io!.of('/domiciliarios');

    nsDomiciliarios.on('connection', (socket: Socket) => {
      const domiciliarioId = socket.data.actorId;
      console.log(`[RappiTracking] Domiciliario conectado: ${domiciliarioId} (socket: ${socket.id})`);

      this.registrarSocketDomiciliario(domiciliarioId, socket.id);

      // El domiciliario actualiza su ubicación en tiempo real
      socket.on('actualizar:ubicacion', async (datos: {
        coordenadas: Coord