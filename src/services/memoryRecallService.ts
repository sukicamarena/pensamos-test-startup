// src/services/memoryRecallService.ts
// Servicio principal para recuperar y enviar recuerdos románticos a parejas en conflicto
// Parte del núcleo de pandunesioss - la red social que reconcilia corazones

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import * as OneSignal from '@onesignal/node-onesignal';

// ─────────────────────────────────────────────
// Tipos e interfaces
// ─────────────────────────────────────────────

export interface Couple {
  id: string;
  partner_a_id: string;
  partner_b_id: string;
  couple_name: string;
  anniversary_date: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  display_name: string;
  email: string;
  onesignal_player_id: string | null;
  avatar_url: string | null;
  preferred_language: 'es' | 'en';
}

export interface Memory {
  id: string;
  couple_id: string;
  uploaded_by: string;
  media_url: string;
  media_type: 'photo' | 'video' | 'note';
  caption: string | null;
  taken_at: string;
  emotion_tags: string[];
  is_favorite: boolean;
  created_at: string;
}

export interface AngerEvent {
  id: string;
  couple_id: string;
  triggered_by: string;
  triggered_at: string;
  status: 'pending' | 'memories_sent' | 'reconciled' | 'expired';
  memories_sent_count: number;
  reconciled_at: string | null;
}

export interface RecallPayload {
  couple: Couple;
  partnerA: UserProfile;
  partnerB: UserProfile;
  memories: Memory[];
  angerEvent: AngerEvent;
}

export interface RecallResult {
  success: boolean;
  angerEventId: string;
  memoriesSent: number;
  notificationsSent: {
    push: number;
    email: number;
  };
  errors: string[];
}

// Mensajes de amor personalizados por idioma
// Se seleccionan aleatoriamente para que cada experiencia sea única
const LOVE_MESSAGES_ES: string[] = [
  "¿Recuerdas este momento? Todo lo bueno que han vivido juntos vale más que cualquier pelea 💕",
  "Este recuerdo existe porque se eligieron. Y siguen eligiéndose, incluso hoy 🌹",
  "Las parejas que pelean también son las que más se aman. Aquí la prueba de lo que construyeron juntos ✨",
  "Un día de enojo no borra mil días de amor. Mira lo que tienen 💞",
  "Este momento fue real. Su amor también lo es. Respira y recuerda por qué empezaron ❤️",
  "Detrás de cada pelea hay dos personas que se importan demasiado. Este recuerdo te lo recuerda 🥰",
  "Las mejores historias tienen sus altibajos. La de ustedes es una de las mejores 💫",
  "Este instante quedó guardado porque fue especial. Como lo son tú y tu pareja 🌸",
];

const LOVE_MESSAGES_EN: string[] = [
  "Remember this moment? Everything good you've lived together is worth more than any fight 💕",
  "This memory exists because you chose each other. And you still do, even today 🌹",
  "Couples who fight are also the ones who love the most. Here's proof of what you built together ✨",
  "One day of anger doesn't erase a thousand days of love. Look at what you have 💞",
  "This moment was real. So is your love. Breathe and remember why you started ❤️",
];

// Número máximo de recuerdos a enviar por evento de enojo
const MAX_MEMORIES_TO_SEND = 5;

// Tiempo de expiración de un evento de enojo en horas
const ANGER_EVENT_EXPIRY_HOURS = 24;

// ─────────────────────────────────────────────
// Inicialización de clientes externos
// ─────────────────────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

const oneSignalConfig = OneSignal.createConfiguration({
  restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
});
const oneSignalClient = new OneSignal.DefaultApi(oneSignalConfig);

// ─────────────────────────────────────────────
// Funciones utilitarias internas
// ─────────────────────────────────────────────

/**
 * Selecciona un mensaje de amor aleatorio según el idioma preferido del usuario
 */
function seleccionarMensajeDeAmor(language: 'es' | 'en'): string {
  const mensajes = language === 'es' ? LOVE_MESSAGES_ES : LOVE_MESSAGES_EN;
  const indice = Math.floor(Math.random() * mensajes.length);
  return mensajes[indice];
}

/**
 * Mezcla un array de forma aleatoria (Fisher-Yates shuffle)
 * Se usa para que los recuerdos enviados sean sorpresivos
 */
function mezclarArray<T>(array: T[]): T[] {
  const mezclado = [...array];
  for (let i = mezclado.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mezclado[i], mezclado[j]] = [mezclado[j], mezclado[i]];
  }
  return mezclado;
}

/**
 * Prioriza los recuerdos favoritos para que aparezcan primero
 */
function priorizarFavoritos(memories: Memory[]): Memory[] {
  const favoritos = memories.filter((m) => m.is_favorite);
  const normales = memories.filter((m) => !m.is_favorite);
  return [...mezclarArray(favoritos), ...mezclarArray(normales)];
}

/**
 * Formatea una fecha de forma legible y emotiva
 */
function formatearFechaRecuerdo(dateString: string, language: 'es' | 'en'): string {
  const fecha = new Date(dateString);
  const opciones: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return fecha.toLocaleDateString(language === 'es' ? 'es-MX' : 'en-US', opciones);
}

// ─────────────────────────────────────────────
// Funciones de consulta a base de datos
// ─────────────────────────────────────────────

/**
 * Obtiene la información completa de una pareja por su ID
 */
async function obtenerPareja(coupleId: string): Promise<Couple> {
  const { data, error } = await supabase
    .from('couples')
    .select('*')
    .eq('id', coupleId)
    .single();

  if (error || !data) {
    throw new Error(`No se encontró la pareja con ID ${coupleId}: ${error?.message}`);
  }

  return data as Couple;
}

/**
 * Obtiene el perfil de un usuario por su ID
 */
async function obtenerPerfilUsuario(userId: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, display_name, email, onesignal_player_id, avatar_url, preferred_language')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error(`No se encontró el perfil del usuario ${userId}: ${error?.message}`);
  }

  return data as UserProfile;
}

/**
 * Obtiene los recuerdos de una pareja, priorizando favoritos y los más emotivos
 * Excluye recuerdos ya enviados en eventos recientes para evitar repetición
 */
async function obtenerRecuerdosPareja(
  coupleId: string,
  excluirMemoriaIds: string[] = []
): Promise<Memory[]> {
  let query = supabase
    .from('memories')
    .select('*')
    .eq('couple_id', coupleId)
    .order('is_favorite', { ascending: false })
    .order('taken_at', { ascending: false });

  if (excluirMemoriaIds.length > 0) {
    query = query.not('id', 'in', `(${excluirMemoriaIds.join(',')})`);
  }

  const { data, error } = await query.limit(50);

  if (error) {
    throw new Error(`Error al obtener recuerdos de la pareja ${coupleId}: ${error.message}`);
  }

  return (data || []) as Memory[];
}

/**
 * Obtiene los IDs de recuerdos enviados en los últimos eventos para evitar repetición
 */
async function obtenerRecuerdosRecientementeEnviados(coupleId: string): Promise<string[]> {
  const hace7Dias = new Date();
  hace7Dias.setDate(hace7Dias.getDate() - 7);

  const { data, error } = await supabase
    .from('anger_event_memories')
    .select('memory_id')
    .eq('couple_id', coupleId)
    .gte('sent_at', hace7Dias.toISOString());

  if (error || !data) return [];

  return data.map((r: { memory_id: string }) => r.memory_id);
}

/**
 * Crea un registro del evento de enojo en la base de datos
 */
async function crearEventoEnojo(
  coupleId: string,
  triggeredBy: string
): Promise<AngerEvent> {
  const { data, error } = await supabase
    .from('anger_events')
    .insert({
      couple_id: coupleId,
      triggered_by: triggeredBy,
      triggered_at: new Date().toISOString(),
      status: 'pending',
      memories_sent_count: 0,
      reconciled_at: null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Error al crear evento de enojo: ${error?.message}`);
  }

  return data as AngerEvent;
}

/**
 * Actualiza el estado del evento de enojo después de enviar recuerdos
 */
async function actualizarEventoEnojo(
  angerEventId: string,
  memoriesSentCount: number
): Promise<void> {
  const { error } = await supabase
    .from('anger_events')
    .update({
      status: 'memories_sent',
      memories_sent_count: memoriesSentCount,
    })
    .eq('id', angerEventId);

  if (error) {
    throw new Error(`Error al actualizar evento de enojo ${angerEventId}: ${error.message}`);
  }
}

/**
 * Registra qué recuerdos fueron enviados en este evento para evitar repetición futura
 */
async function registrarRecuerdosEnviados(
  angerEventId: string,
  coupleId: string,
  memorias: Memory[]
): Promise<void> {
  const registros = memorias.map((memoria) => ({
    anger_event_id: angerEventId,
    couple_id: coupleId,
    memory_id: memoria.id,
    sent_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('anger_event_memories').insert(registros);

  if (error) {
    // Error no crítico: no detenemos el flujo pero lo registramos
    console.error(`[memoryRecallService] Error al registrar recuerdos enviados: ${error.message}`);
  }
}

// ─────────────────────────────────────────────
// Funciones de notificación
// ─────────────────────────────────────────────

/**
 * Genera el HTML del correo de recuerdos románticos
 * Diseño emotivo, mobile-first, con los recuerdos de la pareja
 */
function generarEmailHTML(
  destinatario: UserProfile,
  pareja: Couple,
  memorias: Memory[],
  mensajeAmor: string
): string {
  const memoriaItems = memorias
    .slice(0, 3)
    .map((memoria) => {
      const fechaFormateada = formatearFechaRecuerdo(
        memoria.taken_at,
        destinatario.preferred_language
      );
      const esImagen = memoria.media_type === 'photo';
      const esVideo = memoria.media_type === 'video';

      return `
      <div style="
        background: #fff;
        border-radius: 16px;
        overflow: hidden;
        margin-bottom: 20px;
        box-shadow: 0 4px 20px rgba(255,105,135,0.15);
      ">
        ${
          esImagen
            ? `<img
                src="${memoria.media_url}"
                alt="Recuerdo especial"
                style="width:100%;max-height:300px;object-fit:cover;display:block;"
              />`
            : esVideo
            ? `<video
                src="${memoria.media_url}"
                controls
                style="width:100%;max-height:300px;display:block;"
              ></video>`
            : `<div style="
                padding:30px;
                background:linear-gradient(135deg,#fff0f3,#ffe4ed);
                font-size:20px;
                color:#c2185b;
                text-align:center;
                font-style:italic;
              ">"${memoria.caption || 'Un momento sin palabras'}"</div>`
        }
        <div style="padding:16px;">
          <p style="margin:0;font-size:13px;color:#e91e63;font-weight:600;">📅 ${fechaFormateada}</p>
          ${
            memoria.caption
              ? `<p style="margin:8px 0 0;font-size:15px;color:#555;line-height:1.5;">"${memoria.caption}"</p>`
              : ''
          }
        </div>
      </div>
    `;
    })
    .join('');

  return `
  <!DOCTYPE html>
  <html lang="${destinatario.preferred_language}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Un recuerdo para ti 💕</title>
  </head>
  <body style="
    margin:0;
    padding:0;
    background-color:#fff5f7;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;