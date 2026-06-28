// src/auth.ts
// Módulo de autenticación para la plataforma de delivery rápido (estilo Rappi mejorado)
// Maneja registro, login, tokens JWT y roles de usuario (cliente, repartidor, restaurante, admin)

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ─── Tipos y Enums ────────────────────────────────────────────────────────────

export type UserRole = "cliente" | "repartidor" | "restaurante" | "admin";

export interface UserPayload {
  id: string;
  email: string;
  role: UserRole;
  nombre: string;
  verificado: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterInput {
  nombre: string;
  email: string;
  password: string;
  telefono: string;
  role: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  usuario: UserPayload;
  tokens: TokenPair;
}

export interface RefreshTokenRecord {
  token: string;
  userId: string;
  expiresAt: Date;
  revocado: boolean;
}

// ─── Configuración ────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutos en segundos
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 días en segundos
const BCRYPT_ROUNDS = 12;

// Validación temprana de variables de entorno críticas
if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error(
    "[Auth] JWT_SECRET y JWT_REFRESH_SECRET son requeridos en las variables de entorno"
  );
}

// ─── Store en memoria para refresh tokens (reemplazar con Redis en producción) ─

const refreshTokenStore = new Map<string, RefreshTokenRecord>();

// ─── Utilidades de contraseña ─────────────────────────────────────────────────

/**
 * Hashea una contraseña usando bcrypt con salt rounds configurados
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres");
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verifica que una contraseña en texto plano coincida con el hash almacenado
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Valida que la contraseña cumpla con los requisitos mínimos de seguridad
 */
export function validarFortalezaPassword(password: string): {
  valida: boolean;
  errores: string[];
} {
  const errores: string[] = [];

  if (password.length < 8) errores.push("Mínimo 8 caracteres");
  if (!/[A-Z]/.test(password)) errores.push("Al menos una letra mayúscula");
  if (!/[a-z]/.test(password)) errores.push("Al menos una letra minúscula");
  if (!/[0-9]/.test(password)) errores.push("Al menos un número");
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
    errores.push("Al menos un carácter especial");

  return { valida: errores.length === 0, errores };
}

// ─── Generación y verificación de tokens JWT ─────────────────────────────────

/**
 * Genera un par de tokens (access + refresh) para el usuario autenticado
 */
export function generarTokens(usuario: UserPayload): TokenPair {
  const accessToken = jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      role: usuario.role,
      nombre: usuario.nombre,
      verificado: usuario.verificado,
    },
    JWT_SECRET as string,
    {
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: "delivery-rapido-app",
      audience: "delivery-rapido-users",
    }
  );

  const refreshToken = crypto.randomBytes(64).toString("hex");

  // Almacenar refresh token con metadata
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);
  refreshTokenStore.set(refreshToken, {
    token: refreshToken,
    userId: usuario.id,
    expiresAt,
    revocado: false,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL,
  };
}

/**
 * Verifica y decodifica un access token JWT
 */
export function verificarAccessToken(token: string): UserPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string, {
      issuer: "delivery-rapido-app",
      audience: "delivery-rapido-users",
    }) as UserPayload & jwt.JwtPayload;

    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      nombre: decoded.nombre,
      verificado: decoded.verificado,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Token de acceso expirado");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Token de acceso inválido");
    }
    throw new Error("Error al verificar el token");
  }
}

/**
 * Rota el refresh token: invalida el anterior y genera un nuevo par
 */
export async function rotarRefreshToken(
  refreshToken: string,
  obtenerUsuarioPorId: (id: string) => Promise<UserPayload | null>
): Promise<TokenPair> {
  const record = refreshTokenStore.get(refreshToken);

  if (!record) {
    throw new Error("Refresh token no encontrado");
  }

  if (record.revocado) {
    // Posible reutilización de token — revocar todos los tokens del usuario como medida de seguridad
    revocarTodosLosTokensDeUsuario(record.userId);
    throw new Error(
      "Refresh token ya fue utilizado. Posible intento de robo de sesión"
    );
  }

  if (new Date() > record.expiresAt) {
    refreshTokenStore.delete(refreshToken);
    throw new Error("Refresh token expirado, por favor inicia sesión nuevamente");
  }

  // Marcar el token actual como revocado (rotación segura)
  record.revocado = true;
  refreshTokenStore.set(refreshToken, record);

  const usuario = await obtenerUsuarioPorId(record.userId);
  if (!usuario) {
    throw new Error("Usuario no encontrado");
  }

  return generarTokens(usuario);
}

/**
 * Revoca un refresh token específico (logout de un dispositivo)
 */
export function revocarRefreshToken(refreshToken: string): void {
  const record = refreshTokenStore.get(refreshToken);
  if (record) {
    record.revocado = true;
    refreshTokenStore.set(refreshToken, record);
  }
}

/**
 * Revoca todos los refresh tokens de un usuario (logout global / cuenta comprometida)
 */
export function revocarTodosLosTokensDeUsuario(userId: string): void {
  for (const [key, record] of refreshTokenStore.entries()) {
    if (record.userId === userId) {
      record.revocado = true;
      refreshTokenStore.set(key, record);
    }
  }
}

// ─── Tokens de verificación de email y reset de contraseña ───────────────────

/**
 * Genera un token seguro para verificación de email o reset de contraseña
 */
export function generarTokenSeguro(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Genera el hash de un token para almacenarlo de forma segura en la base de datos
 */
export function hashearToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ─── Validaciones de input ────────────────────────────────────────────────────

/**
 * Valida y sanitiza el input de registro de nuevo usuario
 */
export function validarInputRegistro(input: RegisterInput): {
  valido: boolean;
  errores: string[];
} {
  const errores: string[] = [];

  // Validar nombre
  if (!input.nombre || input.nombre.trim().length < 2) {
    errores.push("El nombre debe tener al menos 2 caracteres");
  }

  // Validar email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!input.email || !emailRegex.test(input.email)) {
    errores.push("Email inválido");
  }

  // Validar teléfono (formato Colombia/Latinoamérica)
  const telefonoRegex = /^\+?[1-9]\d{7,14}$/;
  if (!input.telefono || !telefonoRegex.test(input.telefono.replace(/\s/g, ""))) {
    errores.push("Teléfono inválido (incluye código de país, ej: +573001234567)");
  }

  // Validar contraseña
  const { errores: erroresPassword } = validarFortalezaPassword(input.password);
  errores.push(...erroresPassword);

  // Validar rol
  const rolesPermitidos: UserRole[] = ["cliente", "repartidor", "restaurante"];
  if (!rolesPermitidos.includes(input.role)) {
    errores.push(`Rol inválido. Debe ser: ${rolesPermitidos.join(", ")}`);
  }

  return { valido: errores.length === 0, errores };
}

/**
 * Valida el input de login
 */
export function validarInputLogin(input: LoginInput): {
  valido: boolean;
  errores: string[];
} {
  const errores: string[] = [];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!input.email || !emailRegex.test(input.email)) {
    errores.push("Email inválido");
  }

  if (!input.password || input.password.length < 1) {
    errores.push("La contraseña es requerida");
  }

  return { valido: errores.length === 0, errores };
}

// ─── Autorización por roles ───────────────────────────────────────────────────

/**
 * Verifica si un usuario tiene el rol requerido para acceder a un recurso
 */
export function tienePermiso(
  usuario: UserPayload,
  rolesPermitidos: UserRole[]
): boolean {
  return rolesPermitidos.includes(usuario.role);
}

/**
 * Permisos predefinidos para las funcionalidades principales del delivery
 */
export const PERMISOS = {
  verPedidos: ["cliente", "repartidor", "restaurante", "admin"] as UserRole[],
  crearPedido: ["cliente"] as UserRole[],
  tomarPedido: ["repartidor"] as UserRole[],
  gestionarMenu: ["restaurante", "admin"] as UserRole[],
  verAnaliticas: ["restaurante", "admin"] as UserRole[],
  gestionarUsuarios: ["admin"] as UserRole[],
  verTodasLasOrdenes: ["admin"] as UserRole[],
  actualizarEstadoPedido: ["repartidor", "restaurante", "admin"] as UserRole[],
} as const;

// ─── Rate limiting en memoria (reemplazar con Redis en producción) ─────────────

interface RateLimitRecord {
  intentos: number;
  primerIntento: Date;
  bloqueadoHasta?: Date;
}

const loginAttempts = new Map<string, RateLimitRecord>();

const MAX_INTENTOS_LOGIN = 5;
const VENTANA_TIEMPO_MS = 15 * 60 * 1000; // 15 minutos
const TIEMPO_BLOQUEO_MS = 30 * 60 * 1000; // 30 minutos

/**
 * Verifica si un email o IP puede intentar hacer login (protección contra fuerza bruta)
 */
export function verificarRateLimit(identificador: string): {
  permitido: boolean;
  intentosRestantes: number;
  bloqueadoHasta?: Date;
} {
  const ahora = new Date();
  const record = loginAttempts.get(identificador);

  if (!record) {
    return { permitido: true, intentosRestantes: MAX_INTENTOS_LOGIN };
  }

  // Si está bloqueado, verificar si ya pasó el tiempo de bloqueo
  if (record.bloqueadoHasta && ahora < record.bloqueadoHasta) {
    return {
      permitido: false,
      intentosRestantes: 0,
      bloqueadoHasta: record.bloqueadoHasta,
    };
  }

  // Si pasó la ventana de tiempo, resetear
  const tiempoPasado = ahora.getTime() - record.primerIntento.getTime();
  if (tiempoPasado > VENTANA_TIEMPO_MS) {
    loginAttempts.delete(identificador);
    return { permitido: true, intentosRestantes: MAX_INTENTOS_LOGIN };
  }

  const intentosRestantes = MAX_INTENTOS_LOGIN - record.intentos;
  return { permitido: intentosRestantes > 0, intentosRestantes };
}

/**
 * Registra un intento fallido de login
 */
export function registrarIntentoFallido(identificador: string): void {
  const ahora = new Date();
  const record = loginAttempts.get(identificador);

  if (!record) {
    loginAttempts.set(identificador, {
      intentos: 1,
      primerIntento: ahora,
    });
    return;
  }

  record.intentos += 1;

  if (record.intentos >= MAX_INTENTOS_LOGIN) {
    record.bloqueadoHasta = new Date(ahora.getTime() + TIEMPO_BLOQUEO_MS);
  }

  loginAttempts.set(identificador, record);
}

/**
 * Limpia los intentos fallidos al hacer login exitoso
 */
export function limpiarIntentosFallidos(identificador: string): void {
  loginAttempts.delete(identificador);
}

// ─── Limpieza periódica de tokens expirados ───────────────────────────────────

/**
 * Elimina refresh tokens expirados del store (ejecutar periódicamente con