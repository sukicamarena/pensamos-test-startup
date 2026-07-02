// src/api/conflicts/reportAngry.ts
// Endpoint principal para reportar que un usuario está enojado con su pareja
// Dispara el flujo de envío de recuerdos y mensajes de amor a ambos miembros de la pareja

import { Request, Response } from "express";

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface AngryReportPayload {
  userId: string;
  coupleId: string;
}

interface AngryReportResult {
  success: boolean;
  message: string;
  conflictId?: string;
  memoriesSent?: number;
}

interface Memory {
  id: string;
  type: "photo" | "message" | "milestone";
  url?: string;
  text?: string;
  createdAt: string;
}

interface LoveMessage {
  text: string;
  emoji: string;
}

// ─── Mensajes de amor predefinidos ───────────────────────────────────────────
// Banco de mensajes positivos que se envían durante el conflicto
// para ayudar a la pareja a recordar lo que se quieren

const LOVE_MESSAGES: LoveMessage[] = [
  {
    text: "Recuerda que cada pelea es una oportunidad para entenderse mejor 💛",
    emoji: "💛",
  },
  {
    text: "Nada de esto cambia lo mucho que se quieren ❤️",
    emoji: "❤️",
  },
  {
    text: "Han superado tantas cosas juntos. Esto también lo van a superar 🌈",
    emoji: "🌈",
  },
  {
    text: "El enojo es temporal, el amor que construyeron es real 🕊️",
    emoji: "🕊️",
  },
  {
    text: "Respira. Tu persona favorita sigue siendo tu persona favorita 🫶",
    emoji: "🫶",
  },
  {
    text: "Las parejas que pelean honestamente son las que más se quieren 💪❤️",
    emoji: "💪",
  },
  {
    text: "Mira cuántos momentos bonitos han vivido juntos 📸✨",
    emoji: "📸",
  },
];

// ─── Utilidades ───────────────────────────────────────────────────────────────

/**
 * Selecciona un mensaje de amor aleatorio del banco de mensajes
 */
function pickRandomLoveMessage(): LoveMessage {
  const index = Math.floor(Math.random() * LOVE_MESSAGES.length);
  return LOVE_MESSAGES[index];
}

/**
 * Genera un ID único para el conflicto usando timestamp + random
 */
function generateConflictId(): string {
  return `conflict_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Valida que el payload tenga los campos requeridos
 */
function validatePayload(body: unknown): body is AngryReportPayload {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.userId === "string" &&
    b.userId.trim().length > 0 &&
    typeof b.coupleId === "string" &&
    b.coupleId.trim().length > 0
  );
}

// ─── Servicios simulados (reemplazar con DB real) ─────────────────────────────

/**
 * Obtiene los recuerdos de la pareja desde la base de datos
 * En producción esto consulta la tabla `memories` filtrada por coupleId
 */
async function fetchCoupleMemories(coupleId: string): Promise<Memory[]> {
  // TODO-DB: SELECT * FROM memories WHERE couple_id = $1 ORDER BY RANDOM() LIMIT 5
  // Por ahora retornamos datos de ejemplo tipados correctamente
  const _coupleId = coupleId; // usado cuando se conecte la DB
  void _coupleId;

  return [
    {
      id: "mem_001",
      type: "photo",
      url: "https://storage.pandunesiosss.com/memories/couple_photo_1.jpg",
      text: "Su primera foto juntos 📸",
      createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "mem_002",
      type: "milestone",
      text: "El día que se dieron su primer beso 💋",
      createdAt: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "mem_003",
      type: "message",
      text: "Cuando dijeron 'te quiero' por primera vez ❤️",
      createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

/**
 * Obtiene los IDs de ambos miembros de la pareja
 * En producción consulta la tabla `couples`
 */
async function fetchCouplePartners(
  coupleId: string
): Promise<{ partner1Id: string; partner2Id: string } | null> {
  // TODO-DB: SELECT user1_id, user2_id FROM couples WHERE id = $1 AND status = 'active'
  const _coupleId = coupleId;
  void _coupleId;

  // Simulación: retorna partners ficticios
  return {
    partner1Id: "user_abc123",
    partner2Id: "user_xyz789",
  };
}

/**
 * Registra el evento de conflicto en la base de datos
 * En producción inserta en la tabla `conflicts`
 */
async function saveConflictEvent(
  conflictId: string,
  userId: string,
  coupleId: string
): Promise<void> {
  // TODO-DB: INSERT INTO conflicts (id, reported_by, couple_id, status, created_at)
  //          VALUES ($1, $2, $3, 'active', NOW())
  console.log(
    `[pandunesiosss] Conflicto registrado: ${conflictId} | Usuario: ${userId} | Pareja: ${coupleId}`
  );
}

/**
 * Envía las notificaciones push y en la app a ambos miembros de la pareja
 * En producción usa FCM / APNs / WebPush
 */
async function sendMemoriesNotification(
  userId: string,
  memories: Memory[],
  loveMessage: LoveMessage
): Promise<void> {
  // TODO-NOTIF: Integrar con Firebase Cloud Messaging o servicio similar
  // POST https://fcm.googleapis.com/v1/projects/pandunesiosss/messages:send
  console.log(
    `[pandunesiosss] Enviando ${memories.length} recuerdos al usuario ${userId}`
  );
  console.log(`[pandunesiosss] Mensaje de amor: "${loveMessage.text}"`);
}

/**
 * Envía un correo de amor con los recuerdos (como respaldo a la notificación push)
 * En producción usa Resend / SendGrid
 */
async function sendLoveEmail(
  userId: string,
  memories: Memory[],
  loveMessage: LoveMessage
): Promise<void> {
  // TODO-EMAIL: Integrar con Resend o SendGrid
  // Plantilla: emails/love-reminder.tsx (React Email)
  console.log(
    `[pandunesiosss] Email de recuerdos enviado al usuario ${userId} con mensaje: ${loveMessage.emoji}`
  );
  void memories;
}

/**
 * Verifica si la pareja ya tiene un conflicto activo reciente
 * para evitar spam del botón de enojo
 */
async function hasRecentActiveConflict(coupleId: string): Promise<boolean> {
  // TODO-DB: SELECT id FROM conflicts
  //          WHERE couple_id = $1
  //            AND status = 'active'
  //            AND created_at > NOW() - INTERVAL '30 minutes'
  //          LIMIT 1
  void coupleId;
  return false; // Simulación: no hay conflicto reciente
}

// ─── Handler principal ────────────────────────────────────────────────────────

/**
 * POST /api/conflicts/reportAngry
 *
 * Flujo completo cuando un usuario presiona el botón "Estoy enojado/a":
 * 1. Valida el payload
 * 2. Verifica que la pareja existe y no tiene un conflicto muy reciente
 * 3. Registra el evento de conflicto en la DB
 * 4. Obtiene los recuerdos más bonitos de la pareja
 * 5. Selecciona un mensaje de amor aleatorio
 * 6. Envía notificaciones y emails a AMBOS miembros de la pareja
 * 7. Retorna confirmación al cliente
 */
export async function reportAngry(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    // ── 1. Validación del payload ────────────────────────────────────────────
    if (!validatePayload(req.body)) {
      return res.status(400).json({
        success: false,
        message:
          "Faltan datos requeridos: userId y coupleId son obligatorios.",
      } as AngryReportResult);
    }

    const { userId, coupleId } = req.body as AngryReportPayload;

    // ── 2. Verificar que la pareja existe ────────────────────────────────────
    const partners = await fetchCouplePartners(coupleId);

    if (!partners) {
      return res.status(404).json({
        success: false,
        message:
          "No encontramos tu pareja en pandunesiosss. ¿Están vinculados correctamente?",
      } as AngryReportResult);
    }

    // Verificar que el userId pertenece a esta pareja
    const { partner1Id, partner2Id } = partners;
    if (userId !== partner1Id && userId !== partner2Id) {
      return res.status(403).json({
        success: false,
        message: "No tienes permiso para reportar un conflicto en esta pareja.",
      } as AngryReportResult);
    }

    // ── 3. Verificar cooldown de conflictos (evitar spam) ────────────────────
    const hasRecentConflict = await hasRecentActiveConflict(coupleId);

    if (hasRecentConflict) {
      return res.status(429).json({
        success: false,
        message:
          "Ya enviamos recuerdos hace menos de 30 minutos. Deja que el amor haga su magia 💛",
      } as AngryReportResult);
    }

    // ── 4. Generar ID del conflicto y registrarlo ────────────────────────────
    const conflictId = generateConflictId();
    await saveConflictEvent(conflictId, userId, coupleId);

    // ── 5. Obtener recuerdos de la pareja ────────────────────────────────────
    const memories = await fetchCoupleMemories(coupleId);

    // ── 6. Seleccionar mensaje de amor aleatorio ─────────────────────────────
    const loveMessage = pickRandomLoveMessage();

    // ── 7. Enviar notificaciones a AMBOS miembros de la pareja ───────────────
    // Enviamos en paralelo para mayor eficiencia
    await Promise.all([
      // Notificación push + email al partner 1
      sendMemoriesNotification(partner1Id, memories, loveMessage),
      sendLoveEmail(partner1Id, memories, loveMessage),

      // Notificación push + email al partner 2
      sendMemoriesNotification(partner2Id, memories, loveMessage),
      sendLoveEmail(partner2Id, memories, loveMessage),
    ]);

    console.log(
      `[pandunesiosss] ✅ Flujo de reconciliación completado para pareja ${coupleId}`
    );

    // ── 8. Respuesta exitosa al cliente ──────────────────────────────────────
    return res.status(200).json({
      success: true,
      message:
        "Les enviamos sus recuerdos más bonitos a los dos 💌 El amor siempre gana.",
      conflictId,
      memoriesSent: memories.length,
    } as AngryReportResult);
  } catch (error) {
    // Manejo de errores inesperados
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";

    console.error(
      `[pandunesiosss] ❌ Error en reportAngry: ${errorMessage}`,
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Algo salió mal de nuestro lado. Intenta de nuevo en un momento 💔",
    } as AngryReportResult);
  }
}