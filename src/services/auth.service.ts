import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuración de tokens
const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '30d';
const SALT_ROUNDS = 12;

// Tipos para el servicio de autenticación
export interface RegisterPayload {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  telefono: string;
  rol: 'cliente' | 'repartidor' | 'comercio';
}

export interface LoginPayload {
  email: string;
  password: string;
  deviceInfo?: {
    deviceId: string;
    plataforma: string;
    modelo: string;
  };
}

export interface TokenPayload {
  userId: string;
  email: string;
  rol: string;
  sessionId: string;
}

export interface AuthResponse {
  usuario: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
    telefono: string;
    rol: string;
    avatarUrl: string | null;
    verificado: boolean;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Genera un access token JWT de corta duración
const generarAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'rappi-veloz',
    audience: 'rappi-veloz-app',
  });
};

// Genera un refresh token JWT de larga duración
const generarRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    issuer: 'rappi-veloz',
    audience: 'rappi-veloz-app',
  });
};

// Genera un ID único para la sesión del usuario
const generarSessionId = (): string => {
  return crypto.randomUUID();
};

// Genera un código de verificación de 6 dígitos para email/SMS
const generarCodigoVerificacion = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Registra un nuevo usuario en la plataforma
export const registrarUsuario = async (
  datos: RegisterPayload
): Promise<AuthResponse> => {
  // Verificar si el email ya está registrado
  const usuarioExistente = await prisma.usuario.findUnique({
    where: { email: datos.email.toLowerCase().trim() },
  });

  if (usuarioExistente) {
    throw new Error('El email ya está registrado en la plataforma');
  }

  // Verificar si el teléfono ya está en uso
  const telefonoExistente = await prisma.usuario.findUnique({
    where: { telefono: datos.telefono },
  });

  if (telefonoExistente) {
    throw new Error('El número de teléfono ya está registrado');
  }

  // Hash de la contraseña con bcrypt
  const passwordHash = await bcrypt.hash(datos.password, SALT_ROUNDS);

  // Código de verificación de email
  const codigoVerificacion = generarCodigoVerificacion();
  const codigoExpiracion = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

  // Crear usuario y sesión en una transacción
  const sessionId = generarSessionId();

  const usuario = await prisma.$transaction(async (tx) => {
    // Crear el usuario
    const nuevoUsuario = await tx.usuario.create({
      data: {
        nombre: datos.nombre.trim(),
        apellido: datos.apellido.trim(),
        email: datos.email.toLowerCase().trim(),
        passwordHash,
        telefono: datos.telefono,
        rol: datos.rol,
        codigoVerificacion,
        codigoVerificacionExpira: codigoExpiracion,
        verificado: false,
      },
    });

    // Crear sesión activa
    await tx.sesionUsuario.create({
      data: {
        sessionId,
        usuarioId: nuevoUsuario.id,
        expiracion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
        activa: true,
      },
    });

    // Si es repartidor, crear perfil inicial
    if (datos.rol === 'repartidor') {
      await tx.perfilRepartidor.create({
        data: {
          usuarioId: nuevoUsuario.id,
          disponible: false,
          calificacion: 5.0,
          totalEntregas: 0,
          documentosVerificados: false,
        },
      });
    }

    // Si es comercio, crear perfil inicial
    if (datos.rol === 'comercio') {
      await tx.perfilComercio.create({
        data: {
          usuarioId: nuevoUsuario.id,
          nombreComercio: '',
          verificado: false,
          activo: false,
          calificacion: 5.0,
        },
      });
    }

    return nuevoUsuario;
  });

  // Construir payload del token
  const tokenPayload: TokenPayload = {
    userId: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
    sessionId,
  };

  const accessToken = generarAccessToken(tokenPayload);
  const refreshToken = generarRefreshToken(tokenPayload);

  // Guardar el refresh token hasheado en la base de datos
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await prisma.sesionUsuario.update({
    where: { sessionId },
    data: { refreshTokenHash },
  });

  return {
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      telefono: usuario.telefono,
      rol: usuario.rol,
      avatarUrl: usuario.avatarUrl,
      verificado: usuario.verificado,
    },
    accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutos en segundos
  };
};

// Autentica a un usuario existente
export const iniciarSesion = async (
  datos: LoginPayload
): Promise<AuthResponse> => {
  // Buscar usuario por email
  const usuario = await prisma.usuario.findUnique({
    where: { email: datos.email.toLowerCase().trim() },
  });

  if (!usuario) {
    // Mensaje genérico para no revelar si el email existe
    throw new Error('Credenciales inválidas');
  }

  // Verificar si la cuenta está bloqueada por intentos fallidos
  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
    const minutosRestantes = Math.ceil(
      (usuario.bloqueadoHasta.getTime() - Date.now()) / 60000
    );
    throw new Error(
      `Cuenta bloqueada temporalmente. Intenta en ${minutosRestantes} minutos`
    );
  }

  // Verificar contraseña
  const passwordValida = await bcrypt.compare(datos.password, usuario.passwordHash);

  if (!passwordValida) {
    // Incrementar intentos fallidos
    const intentosFallidos = (usuario.intentosFallidos || 0) + 1;
    const maxIntentos = 5;

    const updateData: any = { intentosFallidos };

    // Bloquear cuenta después de 5 intentos por 15 minutos
    if (intentosFallidos >= maxIntentos) {
      updateData.bloqueadoHasta = new Date(Date.now() + 15 * 60 * 1000);
      updateData.intentosFallidos = 0;
    }

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: updateData,
    });

    throw new Error('Credenciales inválidas');
  }

  // Resetear intentos fallidos al iniciar sesión exitosamente
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      intentosFallidos: 0,
      bloqueadoHasta: null,
      ultimoAcceso: new Date(),
    },
  });

  // Crear nueva sesión
  const sessionId = generarSessionId();

  await prisma.sesionUsuario.create({
    data: {
      sessionId,
      usuarioId: usuario.id,
      expiracion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      activa: true,
      deviceId: datos.deviceInfo?.deviceId,
      plataforma: datos.deviceInfo?.plataforma,
      modeloDispositivo: datos.deviceInfo?.modelo,
    },
  });

  const tokenPayload: TokenPayload = {
    userId: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
    sessionId,
  };

  const accessToken = generarAccessToken(tokenPayload);
  const refreshToken = generarRefreshToken(tokenPayload);

  // Guardar refresh token hasheado
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await prisma.sesionUsuario.update({
    where: { sessionId },
    data: { refreshTokenHash },
  });

  return {
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      telefono: usuario.telefono,
      rol: usuario.rol,
      avatarUrl: usuario.avatarUrl,
      verificado: usuario.verificado,
    },
    accessToken,
    refreshToken,
    expiresIn: 15 * 60,
  };
};

// Renueva el access token usando un refresh token válido
export const renovarTokens = async (
  refreshToken: string
): Promise<RefreshTokenResponse> => {
  let payload: TokenPayload;

  try {
    payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET, {
      issuer: 'rappi-veloz',
      audience: 'rappi-veloz-app',
    }) as TokenPayload;
  } catch (error) {
    throw new Error('Refresh token inválido o expirado');
  }

  // Verificar que la sesión existe y está activa
  const sesion = await prisma.sesionUsuario.findUnique({
    where: { sessionId: payload.sessionId },
    include: { usuario: true },
  });

  if (!sesion || !sesion.activa) {
    throw new Error('Sesión no encontrada o inactiva');
  }

  if (sesion.expiracion < new Date()) {
    // Marcar sesión como inactiva
    await prisma.sesionUsuario.update({
      where: { sessionId: payload.sessionId },
      data: { activa: false },
    });
    throw new Error('Sesión expirada. Por favor inicia sesión nuevamente');
  }

  // Verificar que el refresh token coincide con el almacenado
  if (!sesion.refreshTokenHash) {
    throw new Error('Sesión inválida');
  }

  const tokenValido = await bcrypt.compare(refreshToken, sesion.refreshTokenHash);
  if (!tokenValido) {
    // Posible robo de token — invalidar todas las sesiones del usuario
    await prisma.sesionUsuario.updateMany({
      where: { usuarioId: sesion.usuarioId },
      data: { activa: false },
    });
    throw new Error('Token comprometido. Todas las sesiones han sido cerradas');
  }

  // Generar nuevos tokens (rotación de refresh token)
  const nuevoSessionId = generarSessionId();

  const nuevoPayload: TokenPayload = {
    userId: sesion.usuario.id,
    email: sesion.usuario.email,
    rol: sesion.usuario.rol,
    sessionId: nuevoSessionId,
  };

  const nuevoAccessToken = generarAccessToken(nuevoPayload);
  const nuevoRefreshToken = generarRefreshToken(nuevoPayload);

  // Invalidar sesión anterior y crear nueva
  await prisma.$transaction(async (tx) => {
    await tx.sesionUsuario.update({
      where: { sessionId: payload.sessionId },
      data: { activa: false },
    });

    const nuevoRefreshTokenHash = await bcrypt.hash(nuevoRefreshToken, 10);

    await tx.sesionUsuario.create({
      data: {
        sessionId: nuevoSessionId,
        usuarioId: sesion.usuarioId,
        expiracion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        activa: true,
        refreshTokenHash: nuevoRefreshTokenHash,
        deviceId: sesion.deviceId,
        plataforma: sesion.plataforma,
        modeloDispositivo: sesion.modeloDispositivo,
      },
    });
  });

  return {
    accessToken: nuevoAccessToken,
    refreshToken: nuevoRefreshToken,
    expiresIn: 15 * 60,
  };
};

// Cierra la sesión del usuario invalidando sus tokens
export const cerrarSesion = async (sessionId: string): Promise<void> => {
  const sesion = await prisma.sesionUsuario.findUnique({
    where: { sessionId },
  });

  if (!sesion) {
    return; // Silencioso — la sesión ya no existe
  }

  await prisma.sesionUsuario.update({
    where: { sessionId },
    data: {
      activa: false,
      refreshTokenHash: null,
    },
  });
};

// Cierra todas las sesiones activas del usuario (logout en todos los dispositivos)
export const cerrarTodasLasSesiones = async (userId: string): Promise<void> => {
  await prisma.sesionUsuario.updateMany({
    where: {
      usuarioId: userId,
      activa: true,
    },
    data: {
      activa: false,
      refreshTokenHash: null,
    },
  });
};

// Verifica el email del usuario con el código enviado
export const verificarEmail = async (
  userId: string,
  codigo: string
): Promise<void> => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
  });

  if (!usuario) {
    throw new Error('Usuario no encontrado');
  }

  if (usuario.verificado) {
    throw new Error('El email ya está verificado');
  }

  if (!usuario.codigoVerificacion || !usuario.codigo