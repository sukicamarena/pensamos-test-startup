// Servicio de mensajes de amor para pandunesiosss
// Responsable de seleccionar y enviar mensajes personalizados cuando una pareja pelea

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Pareja {
  id: string;
  usuario1Id: string;
  usuario2Id: string;
  fechaAniversario: string;
  nombreMascota?: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  telefono?: string;
  pushToken?: string;
  preferenciasNotificacion: PreferenciasNotificacion;
}

export interface PreferenciasNotificacion {
  email: boolean;
  sms: boolean;
  push: boolean;
}

export interface Recuerdo {
  id: string;
  parejaId: string;
  tipo: TipoRecuerdo;
  url?: string;
  descripcion: string;
  fechaCreacion: string;
  metadata?: Record<string, unknown>;
}

export type TipoRecuerdo = 'foto' | 'video' | 'lugar' | 'fecha_especial' | 'nota';

export interface MensajeAmor {
  texto: string;
  categoria: CategoriasMensaje;
  intensidad: 'suave' | 'medio' | 'intenso';
}

export type CategoriasMensaje =
  | 'recordatorio_amor'
  | 'primer_encuentro'
  | 'logros_juntos'
  | 'promesas'
  | 'momentos_felices';

export interface PaqueteReconciliacion {
  parejaId: string;
  usuarioQueEnojo: string;
  recuerdos: Recuerdo[];
  mensajeAmor: MensajeAmor;
  timestamp: string;
}

export interface ResultadoEnvio {
  exitoso: boolean;
  canalesUsados: string[];
  errores: string[];
  paqueteId: string;
}

// ─── Banco de mensajes de amor ────────────────────────────────────────────────

const MENSAJES_AMOR: MensajeAmor[] = [
  {
    texto:
      'Las peleas son solo nubes pasajeras en el cielo de lo que construimos juntos. Te amo más de lo que las palabras pueden decir. 💕',
    categoria: 'recordatorio_amor',
    intensidad: 'suave',
  },
  {
    texto:
      'Recuerda por qué empezamos esto. Cada desacuerdo es una oportunidad de conocernos más profundo. Siempre estoy de tu lado. ❤️',
    categoria: 'recordatorio_amor',
    intensidad: 'medio',
  },
  {
    texto:
      'Nada de lo que digamos cuando estamos enojados vale más que todo lo que hemos vivido juntos. Respira, te adoro. 🌹',
    categoria: 'promesas',
    intensidad: 'intenso',
  },
  {
    texto:
      'Mira estos recuerdos y recuerda: este amor nuestro es más grande que cualquier tormenta. Siempre encontramos el camino de vuelta. 🌈',
    categoria: 'momentos_felices',
    intensidad: 'suave',
  },
  {
    texto:
      'El enojo se va, pero yo me quedo. Siempre me quedo. Porque lo que tenemos vale cada momento difícil. 💫',
    categoria: 'promesas',
    intensidad: 'intenso',
  },
  {
    texto:
      'Dos personas que se aman de verdad no siempre están de acuerdo, pero sí siempre se eligen. Te elijo hoy y todos los días. 🤍',
    categoria: 'recordatorio_amor',
    intensidad: 'medio',
  },
  {
    texto:
      'Cuando el enojo pase, aquí estaré, con los brazos abiertos y el corazón lleno de todo lo que somos juntos. 🫂',
    categoria: 'promesas',
    intensidad: 'suave',
  },
  {
    texto:
      'Estos momentos que vivimos juntos son la razón por la que vale la pena superar cada obstáculo. Nuestro amor es real y poderoso. ✨',
    categoria: 'logros_juntos',
    intensidad: 'medio',
  },
  {
    texto:
      'Recuerda ese primer momento en que supe que eras tú. Ese sentimiento nunca se ha ido y nunca se irá. 🌟',
    categoria: 'primer_encuentro',
    intensidad: 'intenso',
  },
  {
    texto:
      'Las parejas que pelean y se reconcilian construyen algo más sólido. Somos más fuertes después de cada tormenta. 💪❤️',
    categoria: 'logros_juntos',
    intensidad: 'medio',
  },
];

// ─── Configuración de clientes externos ──────────────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const transporterEmail = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const clienteTwilio = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ─── Funciones auxiliares ─────────────────────────────────────────────────────

/**
 * Selecciona un mensaje de amor aleatorio del banco de mensajes.
 * Puede filtrar por categoría o intensidad si se necesita personalización.
 */
const seleccionarMensajeAmor = (
  categoria?: CategoriasMensaje,
  intensidad?: MensajeAmor['intensidad']
): MensajeAmor => {
  let pool = [...MENSAJES_AMOR];

  if (categoria) {
    const filtradoCategoria = pool.filter((m) => m.categoria === categoria);
    if (filtradoCategoria.length > 0) pool = filtradoCategoria;
  }

  if (intensidad) {
    const filtradoIntensidad = pool.filter((m) => m.intensidad === intensidad);
    if (filtradoIntensidad.length > 0) pool = filtradoIntensidad;
  }

  const indice = Math.floor(Math.random() * pool.length);
  return pool[indice];
};

/**
 * Obtiene los datos completos de una pareja desde Supabase.
 */
const obtenerPareja = async (parejaId: string): Promise<Pareja> => {
  const { data, error } = await supabase
    .from('parejas')
    .select('*')
    .eq('id', parejaId)
    .single();

  if (error || !data) {
    throw new Error(`No se encontró la pareja con id ${parejaId}: ${error?.message}`);
  }

  return data as Pareja;
};

/**
 * Obtiene los datos de un usuario por su ID.
 */
const obtenerUsuario = async (usuarioId: string): Promise<Usuario> => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, email, telefono, push_token, preferencias_notificacion')
    .eq('id', usuarioId)
    .single();

  if (error || !data) {
    throw new Error(`No se encontró el usuario con id ${usuarioId}: ${error?.message}`);
  }

  return {
    id: data.id,
    nombre: data.nombre,
    email: data.email,
    telefono: data.telefono,
    pushToken: data.push_token,
    preferenciasNotificacion: data.preferencias_notificacion,
  } as Usuario;
};

/**
 * Recupera hasta 3 recuerdos aleatorios de la pareja desde Supabase.
 * Prioriza fotos y fechas especiales para mayor impacto emocional.
 */
const obtenerRecuerdosAleatorios = async (parejaId: string): Promise<Recuerdo[]> => {
  // Primero intentamos obtener fotos y fechas especiales
  const { data: recuerdosEspeciales } = await supabase
    .from('recuerdos')
    .select('*')
    .eq('pareja_id', parejaId)
    .in('tipo', ['foto', 'fecha_especial'])
    .order('fecha_creacion', { ascending: false })
    .limit(10);

  // Si no hay suficientes especiales, completamos con cualquier recuerdo
  const { data: todosRecuerdos } = await supabase
    .from('recuerdos')
    .select('*')
    .eq('pareja_id', parejaId)
    .order('fecha_creacion', { ascending: false })
    .limit(20);

  const pool = recuerdosEspeciales?.length
    ? recuerdosEspeciales
    : todosRecuerdos || [];

  if (pool.length === 0) return [];

  // Mezclar y tomar máximo 3
  const mezclados = pool.sort(() => Math.random() - 0.5).slice(0, 3);

  return mezclados.map((r) => ({
    id: r.id,
    parejaId: r.pareja_id,
    tipo: r.tipo as TipoRecuerdo,
    url: r.url,
    descripcion: r.descripcion,
    fechaCreacion: r.fecha_creacion,
    metadata: r.metadata,
  }));
};

/**
 * Construye el HTML del email de reconciliación con estilos inline
 * para máxima compatibilidad con clientes de correo.
 */
const construirEmailHTML = (
  destinatario: Usuario,
  recuerdos: Recuerdo[],
  mensaje: MensajeAmor,
  nombrePareja: string
): string => {
  const recuerdosHTML = recuerdos
    .map((r) => {
      if (r.tipo === 'foto' && r.url) {
        return `
          <div style="margin-bottom: 16px; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <img
              src="${r.url}"
              alt="${r.descripcion}"
              style="width: 100%; max-height: 300px; object-fit: cover; display: block;"
            />
            <p style="margin: 0; padding: 12px 16px; background: #fff0f5; font-size: 14px; color: #666; font-style: italic;">
              ${r.descripcion}
            </p>
          </div>
        `;
      }
      return `
        <div style="margin-bottom: 16px; padding: 16px; background: #fff0f5; border-radius: 12px; border-left: 4px solid #ff6b9d;">
          <p style="margin: 0; font-size: 15px; color: #444; line-height: 1.5;">
            💝 ${r.descripcion}
          </p>
          <p style="margin: 6px 0 0; font-size: 12px; color: #999;">
            ${new Date(r.fechaCreacion).toLocaleDateString('es-MX', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Un momento para recordar lo que tienen 💕</title>
    </head>
    <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #ffe0eb 0%, #ffd6e7 100%); font-family: 'Helvetica Neue', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" style="max-width: 560px; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 8px 32px rgba(255, 107, 157, 0.2);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #ff6b9d 0%, #ff4785 100%); padding: 40px 32px; text-align: center;">
                  <p style="margin: 0 0 8px; font-size: 40px;">💕</p>
                  <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; line-height: 1.3;">
                    Hola, ${destinatario.nombre}
                  </h1>
                  <p style="margin: 12px 0 0; color: rgba(255,255,255,0.9); font-size: 15px; line-height: 1.5;">
                    A veces necesitamos recordar por qué este amor vale todo
                  </p>
                </td>
              </tr>

              <!-- Mensaje principal -->
              <tr>
                <td style="padding: 32px 32px 24px;">
                  <div style="background: linear-gradient(135deg, #fff0f5 0%, #ffe8f2 100%); border-radius: 16px; padding: 24px; text-align: center;">
                    <p style="margin: 0; font-size: 17px; color: #333; line-height: 1.7; font-style: italic; font-weight: 500;">
                      "${mensaje.texto}"
                    </p>
                  </div>
                </td>
              </tr>

              <!-- Recuerdos -->
              ${
                recuerdos.length > 0
                  ? `
              <tr>
                <td style="padding: 0 32px 24px;">
                  <h2 style="margin: 0 0 16px; font-size: 18px; color: #ff4785; font-weight: 700;">
                    ✨ Sus momentos juntos
                  </h2>
                  ${recuerdosHTML}
                </td>
              </tr>
              `
                  : ''
              }

              <!-- Nombre de la pareja -->
              <tr>
                <td style="padding: 0 32px 32px; text