import Bull from "bull";
import { createClient } from "redis";
import nodemailer from "nodemailer";
import * as admin from "firebase-admin";

// ============================================================
// Tipos e interfaces para el worker de resolución de conflictos
// ============================================================

interface Pareja {
  id: string;
  usuario1Id: string;
  usuario2Id: string;
  nombreUsuario1: string;
  nombreUsuario2: string;
  emailUsuario1: string;
  emailUsuario2: string;
  pushTokenUsuario1?: string;
  pushTokenUsuario2?: string;
  fechaInicio: Date;
}

interface Recuerdo {
  id: string;
  parejaId: string;
  tipo: "foto" | "mensaje" | "lugar" | "fecha_especial";
  contenido: string;
  urlMedia?: string;
  fechaCreacion: Date;
  descripcion: string;
}

interface ConflictoJob {
  parejaId: string;
  usuarioEnojadoId: string;
  timestamp: string;
  intensidad: "leve" | "moderado" | "intenso";
}

interface MensajeAmor {
  texto: string;
  emoji: string;
  categoria: "recordatorio" | "motivacion" | "ternura" | "humor";
}

interface NotificacionPayload {
  titulo: string;
  cuerpo: string;
  urlImagen?: string;
  datos?: Record<string, string>;
}

// ============================================================
// Mensajes de amor predefinidos por categoría e intensidad
// ============================================================

const MENSAJES_AMOR: Record<string, MensajeAmor[]> = {
  leve: [
    {
      texto: "Oye, ¿recuerdas cuando nos reímos tanto que nos dolió la panza? Eso somos nosotros.",
      emoji: "😄",
      categoria: "recordatorio",
    },
    {
      texto: "Esta discusión es pequeña comparada con todo lo que hemos construido juntos. ❤️",
      emoji: "❤️",
      categoria: "motivacion",
    },
    {
      texto: "Incluso enojados, sigues siendo mi persona favorita en el mundo.",
      emoji: "🥰",
      categoria: "ternura",
    },
    {
      texto: "Peleamos porque nos importamos. Pero la verdad es que te extraño aunque estés a un mensaje de distancia.",
      emoji: "💌",
      categoria: "ternura",
    },
    {
      texto: "Nadie más en el mundo me pone tan loco/a... y también nadie más me hace tan feliz. 😅",
      emoji: "😅",
      categoria: "humor",
    },
  ],
  moderado: [
    {
      texto: "Recuerda ese día que pensamos que todo estaba perdido y al final resultó ser nuestra mejor historia. Esto también pasará.",
      emoji: "🌈",
      categoria: "motivacion",
    },
    {
      texto: "He guardado cada uno de nuestros momentos bonitos en mi corazón. Hoy necesito que recuerdes uno de ellos.",
      emoji: "💛",
      categoria: "recordatorio",
    },
    {
      texto: "Dos personas que se aman de verdad no se rinden en los momentos difíciles. Somos esas dos personas.",
      emoji: "🔥",
      categoria: "motivacion",
    },
    {
      texto: "Te elegí en mis mejores días. Te elijo también en estos. Siempre.",
      emoji: "💍",
      categoria: "ternura",
    },
    {
      texto: "Oye cabezota hermoso/a, te quiero mucho aunque ahora mismo no lo parezca. 😤❤️",
      emoji: "😤❤️",
      categoria: "humor",
    },
  ],
  intenso: [
    {
      texto: "Antes de que cualquier palabra pueda separarnos, quiero que veas todo lo que hemos construido. Eso vale más que cualquier pelea.",
      emoji: "🏠",
      categoria: "motivacion",
    },
    {
      texto: "Me enamoré de ti no una sola vez, sino cada día. Hoy, en medio de este dolor, me sigo enamorando.",
      emoji: "🕯️",
      categoria: "ternura",
    },
    {
      texto: "Los momentos más difíciles entre dos personas que se aman no los define la pelea, sino cómo deciden superarla juntos.",
      emoji: "🤝",
      categoria: "motivacion",
    },
    {
      texto: "Recuerda el día que me dijiste que me amabas por primera vez. Yo lo recuerdo perfectamente. Eso no desaparece.",
      emoji: "🌹",
      categoria: "recordatorio",
    },
    {
      texto: "El amor real no es la ausencia de conflictos. Es la decisión de quedarse cuando todo se pone difícil. Yo me quedo.",
      emoji: "⚓",
      categoria: "ternura",
    },
  ],
};

// ============================================================
// Configuración de conexiones externas
// ============================================================

// Cliente Redis para caché y control de rate limiting
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
  },
});

// Transportador de email
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Inicialización de Firebase Admin para push notifications
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

// ============================================================
// Cola de trabajo Bull para procesamiento asíncrono
// ============================================================

export const conflictResolutionQueue = new Bull<ConflictoJob>(
  "conflict-resolution",
  {
    redis: process.env.REDIS_URL || "redis://localhost:6379",
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  }
);

// ============================================================
// Funciones auxiliares de base de datos (simuladas con tipos reales)
// ============================================================

/**
 * Obtiene la información completa de una pareja desde la base de datos
 */
async function obtenerPareja(parejaId: string): Promise<Pareja | null> {
  // En producción, esto consulta PostgreSQL/Supabase
  // Ejemplo: SELECT p.*, u1.email as email1, u2.email as email2 FROM parejas p ...
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const resultado = await pool.query(
      `SELECT 
        p.id,
        p.usuario1_id as "usuario1Id",
        p.usuario2_id as "usuario2Id",
        u1.nombre as "nombreUsuario1",
        u2.nombre as "nombreUsuario2",
        u1.email as "emailUsuario1",
        u2.email as "emailUsuario2",
        u1.push_token as "pushTokenUsuario1",
        u2.push_token as "pushTokenUsuario2",
        p.fecha_inicio as "fechaInicio"
      FROM parejas p
      JOIN usuarios u1 ON u1.id = p.usuario1_id
      JOIN usuarios u2 ON u2.id = p.usuario2_id
      WHERE p.id = $1 AND p.activa = true`,
      [parejaId]
    );

    if (resultado.rows.length === 0) return null;
    return resultado.rows[0] as Pareja;
  } finally {
    await pool.end();
  }
}

/**
 * Obtiene recuerdos de la pareja filtrados por tipo y aleatorizados
 */
async function obtenerRecuerdosAleatorios(
  parejaId: string,
  cantidad: number = 3
): Promise<Recuerdo[]> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const resultado = await pool.query(
      `SELECT 
        r.id,
        r.pareja_id as "parejaId",
        r.tipo,
        r.contenido,
        r.url_media as "urlMedia",
        r.fecha_creacion as "fechaCreacion",
        r.descripcion
      FROM recuerdos r
      WHERE r.pareja_id = $1 
        AND r.visible = true
      ORDER BY RANDOM()
      LIMIT $2`,
      [parejaId, cantidad]
    );

    return resultado.rows as Recuerdo[];
  } finally {
    await pool.end();
  }
}

/**
 * Registra el conflicto y su resolución en la base de datos para análisis
 */
async function registrarConflicto(
  parejaId: string,
  usuarioEnojadoId: string,
  intensidad: string,
  notificacionesEnviadas: boolean
): Promise<void> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await pool.query(
      `INSERT INTO conflictos_registros 
        (pareja_id, usuario_enojado_id, intensidad, notificaciones_enviadas, created_at)
      VALUES ($1, $2, $3, $4, NOW())`,
      [parejaId, usuarioEnojadoId, intensidad, notificacionesEnviadas]
    );
  } finally {
    await pool.end();
  }
}

// ============================================================
// Control de rate limiting para evitar spam de notificaciones
// ============================================================

/**
 * Verifica si la pareja ya recibió notificaciones en las últimas 2 horas
 * para evitar bombardearlos con mensajes si siguen presionando el botón
 */
async function verificarRateLimit(parejaId: string): Promise<boolean> {
  const clave = `conflict:ratelimit:${parejaId}`;

  try {
    await redisClient.connect();
    const valor = await redisClient.get(clave);

    if (valor) {
      console.log(
        `[conflictResolutionWorker] Rate limit activo para pareja ${parejaId}`
      );
      return false; // No enviar, está en cooldown
    }

    // Establecer cooldown de 2 horas
    await redisClient.setEx(clave, 7200, "activo");
    return true; // Puede enviar
  } finally {
    await redisClient.disconnect();
  }
}

// ============================================================
// Funciones de envío de notificaciones
// ============================================================

/**
 * Envía notificación push via Firebase Cloud Messaging
 */
async function enviarPushNotification(
  pushToken: string,
  payload: NotificacionPayload
): Promise<boolean> {
  try {
    const mensaje: admin.messaging.Message = {
      token: pushToken,
      notification: {
        title: payload.titulo,
        body: payload.cuerpo,
        imageUrl: payload.urlImagen,
      },
      data: payload.datos || {},
      android: {
        priority: "high",
        notification: {
          sound: "amor_notification",
          channelId: "pandunesiosss_reconciliacion",
          color: "#FF6B9D",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "amor_notification.caf",
            badge: 1,
          },
        },
      },
    };

    await admin.messaging().send(mensaje);
    console.log(
      `[conflictResolutionWorker] Push enviado exitosamente a token ${pushToken.substring(0, 10)}...`
    );
    return true;
  } catch (error) {
    console.error(
      `[conflictResolutionWorker] Error enviando push notification:`,
      error
    );
    return false;
  }
}

/**
 * Genera el HTML del email de reconciliación con recuerdos de la pareja
 */
function generarHtmlEmail(
  nombreDestinatario: string,
  nombrePareja: string,
  mensajeAmor: MensajeAmor,
  recuerdos: Recuerdo[]
): string {
  const recuerdosHtml = recuerdos
    .map(
      (recuerdo) => `
      <div style="
        background: linear-gradient(135deg, #FFF0F6 0%, #FFF9FC 100%);
        border-left: 4px solid #FF6B9D;
        border-radius: 12px;
        padding: 16px 20px;
        margin: 12px 0;
        box-shadow: 0 2px 8px rgba(255, 107, 157, 0.1);
      ">
        ${
          recuerdo.urlMedia
            ? `<img src="${recuerdo.urlMedia}" alt="Recuerdo especial" style="
            width: 100%;
            max-height: 200px;
            object-fit: cover;
            border-radius: 8px;
            margin-bottom: 12px;
          "/>`
            : ""
        }
        <p style="
          font-size: 14px;
          color: #555;
          margin: 0 0 8px 0;
          font-style: italic;
        ">${recuerdo.tipo === "foto" ? "📸 Foto especial" : recuerdo.tipo === "mensaje" ? "💬 Mensaje guardado" : recuerdo.tipo === "lugar" ? "📍 Lugar especial" : "🗓️ Fecha especial"}</p>
        <p style="
          font-size: 16px;
          color: #333;
          margin: 0;
          line-height: 1.6;
        ">${recuerdo.contenido || recuerdo.descripcion}</p>
        ${
          recuerdo.fechaCreacion
            ? `<p style="font-size: 12px; color: #999; margin: 8px 0 0 0;">
          ${new Date(recuerdo.fechaCreacion).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}
        </p>`
            : ""
        }
      </div>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width