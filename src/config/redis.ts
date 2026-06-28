import { createClient, RedisClientType } from "redis";

// Configuración de Redis para caché de alta velocidad
// Optimizado para operaciones críticas de rapidez en entregas y pedidos

const REDIS_CONFIG = {
  // Tiempos de expiración en segundos para diferentes tipos de datos
  TTL: {
    RESTAURANTES_CERCANOS: 300,      // 5 minutos — se actualiza con frecuencia
    MENU_RESTAURANTE: 600,           // 10 minutos — cambia poco
    SESION_USUARIO: 86400,           // 24 horas — sesión activa
    UBICACION_REPARTIDOR: 15,        // 15 segundos — tiempo real
    ESTADO_PEDIDO: 30,               // 30 segundos — actualización frecuente
    CARRITO_USUARIO: 3600,           // 1 hora — persistencia temporal
    CATALOGO_PRODUCTOS: 1800,        // 30 minutos — inventario
    ZONA_COBERTURA: 3600,            // 1 hora — zonas geográficas
    PROMO_ACTIVA: 120,               // 2 minutos — promociones dinámicas
    RATE_LIMIT_API: 60,              // 1 minuto — control de abuso
  },

  // Prefijos de claves para evitar colisiones entre dominios
  PREFIJOS: {
    RESTAURANTE: "rest:",
    MENU: "menu:",
    USUARIO: "usr:",
    REPARTIDOR: "rep:",
    PEDIDO: "order:",
    CARRITO: "cart:",
    PRODUCTO: "prod:",
    ZONA: "zone:",
    PROMO: "promo:",
    RATE: "rate:",
    GEO: "geo:",
    LOCK: "lock:",
  },
} as const;

// Tipo para el cliente Redis con soporte de reconexión
type RedisCliente = RedisClientType;

let redisCliente: RedisCliente | null = null;
let intentosReconexion = 0;
const MAX_INTENTOS_RECONEXION = 10;

// Construye la URL de conexión desde variables de entorno
const construirUrlRedis = (): string => {
  const host = process.env.REDIS_HOST ?? "localhost";
  const puerto = process.env.REDIS_PORT ?? "6379";
  const password = process.env.REDIS_PASSWORD;
  const db = process.env.REDIS_DB ?? "0";
  const tls = process.env.REDIS_TLS === "true";

  const protocolo = tls ? "rediss" : "redis";

  if (password) {
    return `${protocolo}://:${password}@${host}:${puerto}/${db}`;
  }

  return `${protocolo}://${host}:${puerto}/${db}`;
};

// Inicializa y conecta el cliente Redis
export const inicializarRedis = async (): Promise<RedisCliente> => {
  if (redisCliente?.isOpen) {
    return redisCliente;
  }

  const urlRedis = construirUrlRedis();

  redisCliente = createClient({
    url: urlRedis,
    socket: {
      // Reconexión exponencial para alta disponibilidad
      reconnectStrategy: (intentos: number) => {
        intentosReconexion = intentos;

        if (intentos >= MAX_INTENTOS_RECONEXION) {
          console.error(
            `[Redis] Máximo de intentos de reconexión alcanzado (${MAX_INTENTOS_RECONEXION}). Abortando.`
          );
          return new Error("Redis: máximo de reconexiones alcanzado");
        }

        const espera = Math.min(intentos * 200, 5000);
        console.warn(
          `[Redis] Reintentando conexión en ${espera}ms (intento ${intentos + 1}/${MAX_INTENTOS_RECONEXION})`
        );
        return espera;
      },
      connectTimeout: 10000,
      keepAlive: 5000,
    },
    // Pool de comandos para alta concurrencia en pedidos simultáneos
    commandsQueueMaxLength: 5000,
  }) as RedisCliente;

  // Manejadores de eventos del ciclo de vida
  redisCliente.on("connect", () => {
    intentosReconexion = 0;
    console.log("[Redis] Conexión establecida correctamente");
  });

  redisCliente.on("ready", () => {
    console.log("[Redis] Cliente listo para recibir comandos");
  });

  redisCliente.on("error", (error: Error) => {
    console.error("[Redis] Error en cliente:", error.message);
  });

  redisCliente.on("reconnecting", () => {
    console.warn(
      `[Redis] Reconectando... intento ${intentosReconexion}`
    );
  });

  redisCliente.on("end", () => {
    console.log("[Redis] Conexión cerrada");
  });

  await redisCliente.connect();

  return redisCliente;
};

// Retorna el cliente activo o lanza error si no está inicializado
export const obtenerRedis = (): RedisCliente => {
  if (!redisCliente?.isOpen) {
    throw new Error(
      "[Redis] Cliente no inicializado. Llama inicializarRedis() primero."
    );
  }
  return redisCliente;
};

// Cierra la conexión de forma limpia (útil en shutdown graceful)
export const cerrarRedis = async (): Promise<void> => {
  if (redisCliente?.isOpen) {
    await redisCliente.quit();
    redisCliente = null;
    console.log("[Redis] Conexión cerrada de forma limpia");
  }
};

// ─── Utilidades de caché específicas para el dominio de entregas rápidas ───

// Guarda un valor JSON con TTL automático según tipo
export const guardarEnCache = async <T>(
  clave: string,
  valor: T,
  ttlSegundos: number
): Promise<void> => {
  const cliente = obtenerRedis();
  await cliente.setEx(clave, ttlSegundos, JSON.stringify(valor));
};

// Recupera y deserializa un valor del caché
export const obtenerDeCache = async <T>(
  clave: string
): Promise<T | null> => {
  const cliente = obtenerRedis();
  const valor = await cliente.get(clave);

  if (!valor) return null;

  try {
    return JSON.parse(valor) as T;
  } catch {
    console.error(`[Redis] Error al parsear valor para clave: ${clave}`);
    return null;
  }
};

// Invalida múltiples claves por patrón (útil al actualizar menús)
export const invalidarPorPatron = async (patron: string): Promise<number> => {
  const cliente = obtenerRedis();
  const claves = await cliente.keys(patron);

  if (claves.length === 0) return 0;

  const eliminadas = await cliente.del(claves);
  console.log(
    `[Redis] Invalidadas ${eliminadas} claves con patrón: ${patron}`
  );
  return eliminadas;
};

// Lock distribuido para prevenir race conditions en asignación de repartidores
export const adquirirLock = async (
  recurso: string,
  ttlMs: number = 5000
): Promise<string | null> => {
  const cliente = obtenerRedis();
  const lockKey = `${REDIS_CONFIG.PREFIJOS.LOCK}${recurso}`;
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // SET NX con expiración atómica
  const resultado = await cliente.set(lockKey, token, {
    NX: true,
    PX: ttlMs,
  });

  return resultado === "OK" ? token : null;
};

// Libera el lock distribuido solo si el token coincide
export const liberarLock = async (
  recurso: string,
  token: string
): Promise<boolean> => {
  const cliente = obtenerRedis();
  const lockKey = `${REDIS_CONFIG.PREFIJOS.LOCK}${recurso}`;

  // Script Lua para operación atómica de verificación y eliminación
  const scriptLua = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  const resultado = await cliente.eval(scriptLua, {
    keys: [lockKey],
    arguments: [token],
  });

  return resultado === 1;
};

// Incrementa contador de rate limiting para APIs de pedidos
export const verificarRateLimit = async (
  identificador: string,
  limite: number,
  ventanaSegundos: number
): Promise<{ permitido: boolean; restantes: number; resetEn: number }> => {
  const cliente = obtenerRedis();
  const clave = `${REDIS_CONFIG.PREFIJOS.RATE}${identificador}`;

  const conteo = await cliente.incr(clave);

  if (conteo === 1) {
    // Primera petición en la ventana, establecer expiración
    await cliente.expire(clave, ventanaSegundos);
  }

  const ttl = await cliente.ttl(clave);
  const restantes = Math.max(0, limite - conteo);

  return {
    permitido: conteo <= limite,
    restantes,
    resetEn: ttl,
  };
};

// Actualiza ubicación de repartidor en tiempo real usando GEO
export const actualizarUbicacionRepartidor = async (
  repartidorId: string,
  latitud: number,
  longitud: number
): Promise<void> => {
  const cliente = obtenerRedis();
  const claveGeo = `${REDIS_CONFIG.PREFIJOS.GEO}repartidores`;

  await cliente.geoAdd(claveGeo, {
    longitude: longitud,
    latitude: latitud,
    member: repartidorId,
  });

  // También actualizar TTL de la clave de estado del repartidor
  const claveEstado = `${REDIS_CONFIG.PREFIJOS.REPARTIDOR}${repartidorId}:ubicacion`;
  await cliente.setEx(
    claveEstado,
    REDIS_CONFIG.TTL.UBICACION_REPARTIDOR,
    JSON.stringify({ latitud, longitud, timestamp: Date.now() })
  );
};

// Busca repartidores disponibles en radio dado (en kilómetros)
export const buscarRepartidoresCercanos = async (
  latitud: number,
  longitud: number,
  radioKm: number
): Promise<Array<{ id: string; distanciaKm: number }>> => {
  const cliente = obtenerRedis();
  const claveGeo = `${REDIS_CONFIG.PREFIJOS.GEO}repartidores`;

  const resultados = await cliente.geoSearchWith(
    claveGeo,
    { longitude: longitud, latitude: latitud },
    { radius: radioKm, unit: "km" },
    ["WITHCOORD", "WITHDIST", "COUNT", 20, "ASC"]
  );

  return resultados.map((r) => ({
    id: r.member as string,
    distanciaKm: parseFloat((r.distance ?? 0).toString()),
  }));
};

// Exporta configuración y cliente para uso en otros módulos
export { REDIS_CONFIG };
export type { RedisCliente };