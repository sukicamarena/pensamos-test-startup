// src/api/auth/register.ts
// Endpoint de registro para pandunesiosss - Red social para parejas

import { z } from "zod";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { db } from "../../lib/db";
import { sendWelcomeEmail } from "../../lib/mailer";
import { generateToken } from "../../lib/jwt";
import { rateLimit } from "../../lib/rateLimit";
import type { Request, Response, NextFunction } from "express";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface RegisterRequestBody {
  nombre: string;
  email: string;
  password: string;
  fechaNacimiento: string;
  codigoPareja?: string; // Si ya existe una pareja que los invitó
}

export interface RegisterResponse {
  success: boolean;
  mensaje: string;
  data?: {
    userId: string;
    nombre: string;
    email: string;
    token: string;
    parejaVinculada: boolean;
    codigoInvitacion: string; // Para invitar a su pareja
  };
  errores?: z.ZodIssue[];
}

// ─── Esquema de validación ────────────────────────────────────────────────────

const RegisterSchema = z.object({
  nombre: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(60, "El nombre no puede exceder 60 caracteres")
    .trim(),

  email: z
    .string()
    .email("El email no es válido")
    .toLowerCase()
    .trim(),

  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
    .regex(/[0-9]/, "Debe contener al menos un número"),

  fechaNacimiento: z
    .string()
    .refine((fecha) => {
      const nacimiento = new Date(fecha);
      const hoy = new Date();
      const edad = hoy.getFullYear() - nacimiento.getFullYear();
      return edad >= 18 && edad <= 120;
    }, "Debes ser mayor de 18 años para registrarte"),

  codigoPareja: z
    .string()
    .uuid("El código de pareja no es válido")
    .optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Genera un código único de invitación para que el usuario invite a su pareja.
 * Este código se usa para vincular dos cuentas como pareja en pandunesiosss.
 */
function generarCodigoInvitacion(): string {
  return uuidv4();
}

/**
 * Verifica si el código de pareja existe y está disponible (sin vincular todavía).
 */
async function validarCodigoPareja(
  codigo: string
): Promise<{ valido: boolean; usuarioId?: string }> {
  const resultado = await db.query(
    `SELECT u.id, u.nombre
     FROM usuarios u
     WHERE u.codigo_invitacion = $1
       AND u.pareja_id IS NULL
       AND u.activo = true
     LIMIT 1`,
    [codigo]
  );

  if (resultado.rows.length === 0) {
    return { valido: false };
  }

  return { valido: true, usuarioId: resultado.rows[0].id };
}

/**
 * Vincula dos usuarios como pareja en la plataforma.
 * También crea el registro de la relación con fecha de inicio.
 */
async function vincularPareja(
  usuarioId: string,
  parejaId: string
): Promise<void> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Actualizar ambos usuarios con referencia mutua
    await client.query(
      `UPDATE usuarios SET pareja_id = $1 WHERE id = $2`,
      [parejaId, usuarioId]
    );

    await client.query(
      `UPDATE usuarios SET pareja_id = $1 WHERE id = $2`,
      [usuarioId, parejaId]
    );

    // Crear registro de la relación
    await client.query(
      `INSERT INTO relaciones (id, usuario_1_id, usuario_2_id, fecha_inicio, estado)
       VALUES ($1, $2, $3, NOW(), 'activa')`,
      [uuidv4(), usuarioId, parejaId]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function registerHandler(
  req: Request<{}, RegisterResponse, RegisterRequestBody>,
  res: Response<RegisterResponse>,
  next: NextFunction
): Promise<void> {
  try {
    // Aplicar rate limiting: máximo 5 registros por IP cada 15 minutos
    const limitExcedido = await rateLimit(req.ip, "register", 5, 900);
    if (limitExcedido) {
      res.status(429).json({
        success: false,
        mensaje:
          "Demasiados intentos de registro. Por favor espera unos minutos.",
      });
      return;
    }

    // Validar datos de entrada
    const validacion = RegisterSchema.safeParse(req.body);
    if (!validacion.success) {
      res.status(400).json({
        success: false,
        mensaje: "Los datos ingresados no son válidos",
        errores: validacion.error.issues,
      });
      return;
    }

    const { nombre, email, password, fechaNacimiento, codigoPareja } =
      validacion.data;

    // Verificar que el email no esté registrado
    const emailExistente = await db.query(
      `SELECT id FROM usuarios WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (emailExistente.rows.length > 0) {
      res.status(409).json({
        success: false,
        mensaje:
          "Este email ya está registrado. ¿Ya tienes cuenta en pandunesiosss?",
      });
      return;
    }

    // Validar código de pareja si fue proporcionado
    let parejaEncontradaId: string | undefined;
    if (codigoPareja) {
      const validacionPareja = await validarCodigoPareja(codigoPareja);
      if (!validacionPareja.valido) {
        res.status(400).json({
          success: false,
          mensaje:
            "El código de pareja no es válido o ya fue utilizado. Pídele a tu pareja que te envíe su código nuevamente.",
        });
        return;
      }
      parejaEncontradaId = validacionPareja.usuarioId;
    }

    // Hashear la contraseña con bcrypt (12 rondas para producción)
    const passwordHash = await bcrypt.hash(password, 12);

    // Generar identificadores únicos
    const userId = uuidv4();
    const codigoInvitacion = generarCodigoInvitacion();

    // Insertar usuario en la base de datos
    await db.query(
      `INSERT INTO usuarios (
        id,
        nombre,
        email,
        password_hash,
        fecha_nacimiento,
        codigo_invitacion,
        pareja_id,
        activo,
        fecha_registro,
        ultimo_estado_emocional,
        notificaciones_activas
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        NULL, true, NOW(), 'feliz', true
      )`,
      [userId, nombre, email, passwordHash, fechaNacimiento, codigoInvitacion]
    );

    // Si hay código de pareja válido, vincularlos automáticamente
    if (codigoPareja && parejaEncontradaId) {
      await vincularPareja(userId, parejaEncontradaId);
    }

    // Generar JWT para autenticación inmediata
    const token = generateToken({
      userId,
      email,
      nombre,
    });

    // Enviar email de bienvenida con instrucciones para invitar a la pareja
    await sendWelcomeEmail({
      destinatario: email,
      nombre,
      codigoInvitacion,
      yaVinculado: !!parejaEncontradaId,
    });

    // Respuesta exitosa
    res.status(201).json({
      success: true,
      mensaje: parejaEncontradaId
        ? `¡Bienvenido/a a pandunesiosss, ${nombre}! Ya quedaste vinculado/a con tu pareja. 💑`
        : `¡Bienvenido/a a pandunesiosss, ${nombre}! Comparte tu código con tu pareja para comenzar. 💌`,
      data: {
        userId,
        nombre,
        email,
        token,
        parejaVinculada: !!parejaEncontradaId,
        codigoInvitacion,
      },
    });
  } catch (error) {
    // Pasar errores no controlados al middleware de manejo de errores
    next(error);
  }
}

// ─── Exportación del router (para uso con Express Router) ─────────────────────

import { Router } from "express";

const router = Router();

/**
 * POST /api/auth/register
 * Registra un nuevo usuario en pandunesiosss.
 * Opcionalmente vincula con su pareja si se provee codigoPareja.
 */
router.post("/register", registerHandler);

export default router;