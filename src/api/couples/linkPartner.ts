// src/api/couples/linkPartner.ts
// Módulo para vincular a dos usuarios como pareja en pandunesiosss
// Maneja la lógica de invitación, aceptación y creación del vínculo de pareja

import { Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";

// ─── Tipos y esquemas ────────────────────────────────────────────────────────

export interface Partner {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
}

export interface CoupleLink {
  coupleId: string;
  partnerA: Partner;
  partnerB: Partner;
  linkedAt: string;
  inviteToken: string;
  status: "pending" | "active" | "dissolved";
}

export interface LinkPartnerRequest {
  invitedEmail: string;
}

export interface AcceptLinkRequest {
  inviteToken: string;
}

export interface LinkPartnerResponse {
  success: boolean;
  message: string;
  coupleId?: string;
  inviteToken?: string;
  partner?: Partial<Partner>;
}

// Esquema de validación para enviar invitación
const SendInviteSchema = z.object({
  invitedEmail: z
    .string()
    .email("El correo de tu pareja no tiene un formato válido")
    .min(1, "El correo de tu pareja es obligatorio"),
});

// Esquema de validación para aceptar invitación
const AcceptInviteSchema = z.object({
  inviteToken: z
    .string()
    .min(32, "El token de invitación no es válido")
    .max(128, "El token de invitación no es válido"),
});

// ─── Base de datos simulada (en producción reemplazar con Prisma/Supabase) ────

// Almacén en memoria para el prototipo — reemplazar con DB real
const coupleLinks = new Map<string, CoupleLink>();
const pendingInvites = new Map<
  string,
  {
    inviteToken: string;
    invitedBy: Partner;
    invitedEmail: string;
    createdAt: Date;
    expiresAt: Date;
  }
>();

// Usuarios simulados — en producción vendrá del middleware de autenticación
const mockUsers = new Map<string, Partner>([
  [
    "user_001",
    {
      userId: "user_001",
      displayName: "Carlos",
      email: "carlos@example.com",
      avatarUrl: "https://api.dicebear.com/7.x/hearts/svg?seed=Carlos",
    },
  ],
  [
    "user_002",
    {
      userId: "user_002",
      displayName: "María",
      email: "maria@example.com",
      avatarUrl: "https://api.dicebear.com/7.x/hearts/svg?seed=María",
    },
  ],
]);

// ─── Utilidades ──────────────────────────────────────────────────────────────

/**
 * Genera un token único y seguro para la invitación de pareja
 */
const generateInviteToken = (): string => {
  return crypto.randomBytes(48).toString("hex");
};

/**
 * Genera un ID único para el vínculo de pareja
 */
const generateCoupleId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString("hex");
  return `couple_${timestamp}_${random}`;
};

/**
 * Verifica si un usuario ya tiene pareja activa
 */
const userHasActivePartner = (userId: string): boolean => {
  for (const link of coupleLinks.values()) {
    if (
      link.status === "active" &&
      (link.partnerA.userId === userId || link.partnerB.userId === userId)
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Verifica si ya existe una invitación pendiente entre dos usuarios
 */
const pendingInviteExists = (
  inviterUserId: string,
  invitedEmail: string
): boolean => {
  for (const invite of pendingInvites.values()) {
    if (
      invite.invitedBy.userId === inviterUserId &&
      invite.invitedEmail === invitedEmail &&
      invite.expiresAt > new Date()
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Envía el correo de invitación con el enlace mágico
 * En producción integrar con Resend, SendGrid o similar
 */
const sendInvitationEmail = async (params: {
  toEmail: string;
  fromPartnerName: string;
  inviteToken: string;
  appBaseUrl: string;
}): Promise<void> => {
  const inviteUrl = `${params.appBaseUrl}/join?token=${params.inviteToken}`;

  // En producción: await resend.emails.send({ ... })
  console.log(`
    ─────────────────────────────────────────────
    📧 Correo de invitación de pareja enviado
    Para: ${params.toEmail}
    De parte de: ${params.fromPartnerName}
    Enlace de invitación: ${inviteUrl}
    ─────────────────────────────────────────────
  `);
};

// ─── Handler: Enviar invitación de pareja ────────────────────────────────────

/**
 * POST /api/couples/link/invite
 *
 * Permite a un usuario autenticado enviar una invitación a su pareja
 * para que se unan juntos en pandunesiosss
 */
export const sendPartnerInvite = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Obtener usuario autenticado del middleware (JWT/session)
    const currentUserId = req.headers["x-user-id"] as string;

    if (!currentUserId) {
      res.status(401).json({
        success: false,
        message: "Necesitas iniciar sesión para invitar a tu pareja 💔",
      } as LinkPartnerResponse);
      return;
    }

    // Buscar datos del usuario actual
    const currentUser = mockUsers.get(currentUserId);
    if (!currentUser) {
      res.status(404).json({
        success: false,
        message: "No encontramos tu perfil. Intenta cerrar sesión y volver a entrar.",
      } as LinkPartnerResponse);
      return;
    }

    // Validar el cuerpo de la petición
    const parseResult = SendInviteSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        message: parseResult.error.errors[0]?.message ?? "Datos de invitación inválidos",
      } as LinkPartnerResponse);
      return;
    }

    const { invitedEmail } = parseResult.data;

    // Evitar que un usuario se invite a sí mismo
    if (invitedEmail.toLowerCase() === currentUser.email.toLowerCase()) {
      res.status(400).json({
        success: false,
        message: "No puedes invitarte a ti mismo/a 😅 Ingresa el correo de tu pareja",
      } as LinkPartnerResponse);
      return;
    }

    // Verificar que el usuario no tenga ya una pareja activa
    if (userHasActivePartner(currentUserId)) {
      res.status(409).json({
        success: false,
        message: "Ya tienes una pareja vinculada en pandunesiosss. Desvincula primero si quieres cambiar.",
      } as LinkPartnerResponse);
      return;
    }

    // Verificar que no haya una invitación pendiente duplicada
    if (pendingInviteExists(currentUserId, invitedEmail)) {
      res.status(409).json({
        success: false,
        message: `Ya le enviaste una invitación a ${invitedEmail}. Espera a que la acepte o cancélala primero 💌`,
      } as LinkPartnerResponse);
      return;
    }

    // Generar token de invitación con expiración de 7 días
    const inviteToken = generateInviteToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Guardar invitación pendiente
    pendingInvites.set(inviteToken, {
      inviteToken,
      invitedBy: currentUser,
      invitedEmail: invitedEmail.toLowerCase(),
      createdAt: now,
      expiresAt,
    });

    // Enviar correo de invitación
    const appBaseUrl =
      process.env.APP_BASE_URL ?? "https://pandunesiosss.app";

    await sendInvitationEmail({
      toEmail: invitedEmail,
      fromPartnerName: currentUser.displayName,
      inviteToken,
      appBaseUrl,
    });

    res.status(201).json({
      success: true,
      message: `¡Invitación enviada! Le mandamos un correo a ${invitedEmail} para que se una contigo en pandunesiosss 💕`,
      inviteToken, // En producción NO devolver el token en la respuesta
    } as LinkPartnerResponse);
  } catch (error) {
    console.error("[linkPartner] Error al enviar invitación:", error);
    res.status(500).json({
      success: false,
      message: "Ups, algo salió mal al enviar la invitación. Intenta de nuevo en un momento.",
    } as LinkPartnerResponse);
  }
};

// ─── Handler: Aceptar invitación de pareja ───────────────────────────────────

/**
 * POST /api/couples/link/accept
 *
 * Permite al usuario invitado aceptar la invitación y crear
 * el vínculo de pareja en pandunesiosss
 */
export const acceptPartnerInvite = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Obtener usuario autenticado del middleware
    const currentUserId = req.headers["x-user-id"] as string;

    if (!currentUserId) {
      res.status(401).json({
        success: false,
        message: "Necesitas iniciar sesión para aceptar la invitación de tu pareja 💔",
      } as LinkPartnerResponse);
      return;
    }

    // Buscar datos del usuario actual
    const currentUser = mockUsers.get(currentUserId);
    if (!currentUser) {
      res.status(404).json({
        success: false,
        message: "No encontramos tu perfil. Crea una cuenta primero.",
      } as LinkPartnerResponse);
      return;
    }

    // Validar el token de la petición
    const parseResult = AcceptInviteSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        message: parseResult.error.errors[0]?.message ?? "Token de invitación inválido",
      } as LinkPartnerResponse);
      return;
    }

    const { inviteToken } = parseResult.data;

    // Buscar la invitación pendiente
    const invite = pendingInvites.get(inviteToken);
    if (!invite) {
      res.status(404).json({
        success: false,
        message: "No encontramos esta invitación. Puede que ya haya sido usada o no exista.",
      } as LinkPartnerResponse);
      return;
    }

    // Verificar que el token no haya expirado
    if (invite.expiresAt < new Date()) {
      pendingInvites.delete(inviteToken);
      res.status(410).json({
        success: false,
        message: "Esta invitación ya expiró 😢 Pídele a tu pareja que te envíe una nueva.",
      } as LinkPartnerResponse);
      return;
    }

    // Verificar que el correo del usuario que acepta coincida con el invitado
    if (
      currentUser.email.toLowerCase() !== invite.invitedEmail.toLowerCase()
    ) {
      res.status(403).json({
        success: false,
        message: "Esta invitación no es para tu cuenta. Asegúrate de usar el correo correcto.",
      } as LinkPartnerResponse);
      return;
    }

    // Evitar que alguien acepte su propia invitación
    if (invite.invitedBy.userId === currentUserId) {
      res.status(400).json({
        success: false,
        message: "No puedes aceptar tu propia invitación 😅",
      } as LinkPartnerResponse);
      return;
    }

    // Verificar que ninguno de los dos ya tenga pareja activa
    if (userHasActivePartner(currentUserId)) {
      res.status(409).json({
        success: false,
        message: "Ya tienes una pareja vinculada en pandunesiosss.",
      } as LinkPartnerResponse);
      return;
    }

    if (userHasActivePartner(invite.invitedBy.userId)) {
      res.status(409).json({
        success: false,
        message: `${invite.invitedBy.displayName} ya se vinculó con alguien más 💔`,
      } as LinkPartnerResponse);
      return;
    }

    // Crear el vínculo de pareja
    const coupleId = generateCoupleId();
    const newCoupleLink: CoupleLink = {
      coupleId,
      partnerA: invite.invitedBy,
      partnerB: currentUser,
      linkedAt: new Date().toISOString(),
      inviteToken,
      status: "active",
    };

    // Guardar el vínculo y eliminar la invitación usada
    coupleLinks.set(coupleId, newCoupleLink);
    pendingInvites.delete(inviteToken);

    console.log(
      `[linkPartner] ¡Nueva pareja vinculada! ${invite.invitedBy.displayName} ❤️ ${currentUser.displayName} — ID: ${coupleId}`
    );

    res.status(201).json({
      success: true,
      message: `¡Ahora están conectados! Bienvenidos a pandunesiosss, ${invite.invitedBy.displayName} y ${currentUser.displayName} ❤️`,
      coupleId,
      partner: {
        userId: invite.invitedBy.userId,
        displayName: invite.invitedBy.displayName,
        avatarUrl: invite.invitedBy.avatarUrl,
      },
    } as LinkPartnerResponse);
  } catch (error) {
    console.error("[linkPartner] Error al aceptar invitación:", error);
    res.status(500).json({
      success: false,
      message: "Ups, algo salió mal al vincular con tu pareja. Intenta de nuevo.",
    } as LinkPartnerResponse);
  }
};

// ─── Handler: Obtener estado del v