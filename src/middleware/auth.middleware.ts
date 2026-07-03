import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Redis } from 'ioredis';

// Cliente Redis para verificar tokens revocados (logout activo)
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

// Tipos de roles disponibles en la plataforma
export type UserRole = 'cliente' | 'repartidor' | 'restaurante' | 'admin';

// Payload decodificado del JWT
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  sessionId: string;
  iat: number;
  exp: number;
}

// Extensión del Request de Express para incluir el usuario autenticado
export interface AuthRequest extends Request {
  user?: JwtPayload;
  token?: string;
}

// Configuración de tiempos de expiración por rol
const TOKEN_EXPIRY_BY_ROLE: Record<UserRole, number> = {
  cliente: 7 * 24 * 60 * 60,       // 7 días
  repartidor: 12 * 60 * 60,         // 12 horas (seguridad operativa)
  restaurante: 24 * 60 * 60,        // 24 horas
  admin: 8 * 60 * 60,               // 8 horas (alta seguridad)
};

/**
 * Extrae el token Bearer del header Authorization
 */
const extraerToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;

  if (!authHeader) return null;

  const partes = authHeader.split(' ');
  if (partes.length !== 2 || partes[0].toLowerCase() !== 'bearer') return null;

  return partes[1] || null;
};

/**
 * Verifica si el token fue revocado (usuario hizo logout)
 * Usa Redis para verificación O(1) sin consultar base de datos
 */
const esTokenRevocado = async (sessionId: string): Promise<boolean> => {
  try {
    const revocado = await redis.get(`revoked:session:${sessionId}`);
    return revocado !== null;
  } catch (error) {
    // Si Redis falla, se permite el acceso para no bloquear el servicio
    console.error('[Auth] Error verificando token revocado en Redis:', error);
    return false;
  }
};

/**
 * Middleware principal de autenticación JWT
 * Valida token, verifica revocación y adjunta usuario al request
 */
export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extraerToken(req);

    if (!token) {
      res.status(401).json({
        success: false,
        codigo: 'TOKEN_REQUERIDO',
        mensaje: 'Se requiere autenticación para acceder a este recurso',
      });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[Auth] JWT_SECRET no configurado en variables de entorno');
      res.status(500).json({
        success: false,
        codigo: 'CONFIG_ERROR',
        mensaje: 'Error de configuración del servidor',
      });
      return;
    }

    // Decodificar y verificar firma + expiración
    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, secret) as JwtPayload;
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          success: false,
          codigo: 'TOKEN_EXPIRADO',
          mensaje: 'Tu sesión ha expirado. Por favor vuelve a iniciar sesión',
          expiradoEn: jwtError.expiredAt,
        });
        return;
      }

      if (jwtError instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          success: false,
          codigo: 'TOKEN_INVALIDO',
          mensaje: 'Token de autenticación inválido',
        });
        return;
      }

      throw jwtError;
    }

    // Verificar que el token no fue revocado por logout activo
    const revocado = await esTokenRevocado(payload.sessionId);
    if (revocado) {
      res.status(401).json({
        success: false,
        codigo: 'SESION_CERRADA',
        mensaje: 'Esta sesión fue cerrada. Por favor vuelve a iniciar sesión',
      });
      return;
    }

    // Validar que el rol es válido en el sistema
    const rolesValidos: UserRole[] = ['cliente', 'repartidor', 'restaurante', 'admin'];
    if (!rolesValidos.includes(payload.role)) {
      res.status(403).json({
        success: false,
        codigo: 'ROL_INVALIDO',
        mensaje: 'El rol de usuario no es válido',
      });
      return;
    }

    // Adjuntar usuario y token al request para uso en controladores
    req.user = payload;
    req.token = token;

    next();
  } catch (error) {
    console.error('[Auth] Error inesperado en middleware de autenticación:', error);
    res.status(500).json({
      success: false,
      codigo: 'ERROR_INTERNO',
      mensaje: 'Error interno de autenticación',
    });
  }
};

/**
 * Factory para middleware de autorización por roles
 * Uso: router.get('/admin', authMiddleware, requireRole('admin'), handler)
 */
export const requireRole = (...rolesPermitidos: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        codigo: 'NO_AUTENTICADO',
        mensaje: 'Usuario no autenticado',
      });
      return;
    }

    if (!rolesPermitidos.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        codigo: 'SIN_PERMISOS',
        mensaje: `Esta acción requiere rol: ${rolesPermitidos.join(' o ')}`,
        rolActual: req.user.role,
      });
      return;
    }

    next();
  };
};

/**
 * Middleware específico para rutas de repartidores activos
 * Verifica además que el repartidor tenga sesión de turno activa
 */
export const requireRepartidorActivo = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user || req.user.role !== 'repartidor') {
    res.status(403).json({
      success: false,
      codigo: 'SIN_PERMISOS',
      mensaje: 'Solo repartidores pueden acceder a este recurso',
    });
    return;
  }

  try {
    // Verificar turno activo en Redis (clave seteada al iniciar turno)
    const turnoActivo = await redis.get(`repartidor:turno:${req.user.userId}`);

    if (!turnoActivo) {
      res.status(403).json({
        success: false,
        codigo: 'TURNO_INACTIVO',
        mensaje: 'Debes iniciar tu turno para recibir pedidos',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('[Auth] Error verificando turno de repartidor:', error);
    // Si Redis falla, permitir acceso para no bloquear operaciones
    next();
  }
};

/**
 * Middleware opcional: no bloquea pero adjunta usuario si hay token válido
 * Útil para rutas públicas que tienen comportamiento diferente si estás logueado
 */
export const authOpcional = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extraerToken(req);

    if (!token) {
      next();
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      next();
      return;
    }

    const payload = jwt.verify(token, secret) as JwtPayload;
    const revocado = await esTokenRevocado(payload.sessionId);

    if (!revocado) {
      req.user = payload;
      req.token = token;
    }
  } catch {
    // Token inválido en ruta pública: simplemente continuar sin usuario
  }

  next();
};

/**
 * Revoca una sesión específica (llamado desde el servicio de logout)
 * Almacena en Redis con TTL igual al tiempo restante del token
 */
export const revocarSesion = async (
  sessionId: string,
  tokenExpiry: number
): Promise<void> => {
  const ahora = Math.floor(Date.now() / 1000);
  const ttl = tokenExpiry - ahora;

  if (ttl > 0) {
    await redis.setex(`revoked:session:${sessionId}`, ttl, '1');
  }
};

/**
 * Revoca todas las sesiones de un usuario (cambio de contraseña, cuenta comprometida)
 */
export const revocarTodasLasSesiones = async (userId: string): Promise<void> => {
  const maxExpiry = Math.max(...Object.values(TOKEN_EXPIRY_BY_ROLE));
  await redis.setex(`revoked:user:${userId}`, maxExpiry, Date.now().toString());
};

export default authMiddleware;