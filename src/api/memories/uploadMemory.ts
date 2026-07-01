// src/api/memories/uploadMemory.ts
// Módulo para subir recuerdos de pareja en Pandunesiosos
// Los recuerdos son el corazón del sistema de reconciliación automática

import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { z } from 'zod';

// ─── Tipos específicos del dominio ───────────────────────────────────────────

export type MemoryType = 'photo' | 'video' | 'note' | 'audio';

export type MemoryEmotion =
  | 'love'
  | 'funny'
  | 'adventure'
  | 'calm'
  | 'proud'
  | 'grateful';

export interface UploadedMemory {
  id: string;
  coupleId: string;
  uploadedBy: string; // userId de quien sube el recuerdo
  partnerUserId: string; // userId de la pareja
  type: MemoryType;
  emotion: MemoryEmotion;
  caption: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  fileSizeBytes: number;
  mimeType: string;
  originalFileName: string;
  takenAt: Date | null; // fecha en que se tomó la foto/video (no cuando se subió)
  createdAt: Date;
  metadata: MemoryMetadata;
}

export interface MemoryMetadata {
  width?: number;
  height?: number;
  durationSeconds?: number;
  location?: {
    lat: number;
    lng: number;
    placeName?: string;
  };
}

export interface UploadMemoryResponse {
  success: boolean;
  memory: UploadedMemory;
  message: string;
}

export interface UploadMemoryErrorResponse {
  success: false;
  error: string;
  details?: Record<string, string[]>;
}

// ─── Esquema de validación con Zod ───────────────────────────────────────────

const uploadMemorySchema = z.object({
  coupleId: z
    .string()
    .uuid('El ID de pareja debe ser un UUID válido'),

  emotion: z.enum(['love', 'funny', 'adventure', 'calm', 'proud', 'grateful'], {
    errorMap: () => ({
      message:
        'La emoción debe ser: love, funny, adventure, calm, proud o grateful',
    }),
  }),

  caption: z
    .string()
    .min(1, 'El caption no puede estar vacío')
    .max(500, 'El caption no puede superar 500 caracteres')
    .trim(),

  takenAt: z
    .string()
    .datetime({ message: 'La fecha debe ser un ISO 8601 válido' })
    .optional()
    .nullable(),

  locationLat: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)), 'Latitud inválida')
    .optional(),

  locationLng: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)), 'Longitud inválida')
    .optional(),

  locationPlaceName: z
    .string()
    .max(200, 'El nombre del lugar no puede superar 200 caracteres')
    .optional(),
});

// ─── Configuración de almacenamiento con Multer ───────────────────────────────

const ALLOWED_MIME_TYPES: Record<string, MemoryType> = {
  'image/jpeg': 'photo',
  'image/png': 'photo',
  'image/webp': 'photo',
  'image/heic': 'photo',
  'video/mp4': 'video',
  'video/quicktime': 'video',
  'video/webm': 'video',
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
};

const MAX_FILE_SIZES: Record<MemoryType, number> = {
  photo: 20 * 1024 * 1024,   // 20 MB
  video: 200 * 1024 * 1024,  // 200 MB
  audio: 50 * 1024 * 1024,   // 50 MB
  note: 1 * 1024 * 1024,     // 1 MB
};

// Directorio temporal para procesar antes de enviar a storage cloud
const TEMP_DIR = path.join(process.cwd(), 'tmp', 'memories');

const multerStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await fs.mkdir(TEMP_DIR, { recursive: true });
      cb(null, TEMP_DIR);
    } catch (err) {
      cb(err as Error, TEMP_DIR);
    }
  },
  filename: (_req, file, cb) => {
    // Nombre único para evitar colisiones en el directorio temporal
    const ext = path.extname(file.originalname).toLowerCase();
    const tempName = `${uuidv4()}${ext}`;
    cb(null, tempName);
  },
});

const multerFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_MIME_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Tipo de archivo no permitido: ${file.mimetype}. ` +
          'Solo se aceptan imágenes (JPEG, PNG, WEBP, HEIC), videos (MP4, MOV, WEBM) y audios (MP3, WAV, OGG).'
      )
    );
  }
};

export const memoryUploadMiddleware = multer({
  storage: multerStorage,
  fileFilter: multerFileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024, // Límite máximo global: 200 MB (el más alto)
    files: 1, // Solo un archivo por request
  },
}).single('file');

// ─── Servicio de Storage (abstracción para S3 / GCS / local) ─────────────────

interface StorageUploadResult {
  fileUrl: string;
  thumbnailUrl: string | null;
}

/**
 * Sube el archivo a cloud storage y genera thumbnail si es imagen.
 * En producción esto conecta con S3, GCS o Cloudflare R2.
 */
async function uploadToCloudStorage(
  localFilePath: string,
  memoryId: string,
  coupleId: string,
  mimeType: string
): Promise<StorageUploadResult> {
  const memoryType = ALLOWED_MIME_TYPES[mimeType];
  const ext = path.extname(localFilePath);

  // Ruta lógica dentro del bucket: couples/{coupleId}/memories/{memoryId}/original.ext
  const objectKey = `couples/${coupleId}/memories/${memoryId}/original${ext}`;
  const thumbnailKey = `couples/${coupleId}/memories/${memoryId}/thumbnail.webp`;

  let thumbnailUrl: string | null = null;

  // Generar thumbnail optimizado para imágenes antes de subir
  if (memoryType === 'photo') {
    const thumbnailLocalPath = path.join(TEMP_DIR, `${memoryId}_thumb.webp`);
    await sharp(localFilePath)
      .resize(400, 400, {
        fit: 'cover',
        position: 'attention', // sharp detecta el punto focal automáticamente
      })
      .webp({ quality: 80 })
      .toFile(thumbnailLocalPath);

    // Aquí iría el upload real del thumbnail al bucket
    // await s3Client.putObject({ Bucket: BUCKET_NAME, Key: thumbnailKey, Body: ... });
    thumbnailUrl = `${process.env.CDN_BASE_URL}/${thumbnailKey}`;

    // Limpiar thumbnail temporal
    await fs.unlink(thumbnailLocalPath).catch(() => {
      // No lanzar error si el archivo ya no existe
    });
  }

  // Aquí iría el upload real del archivo original al bucket
  // await s3Client.putObject({ Bucket: BUCKET_NAME, Key: objectKey, Body: ... });

  const fileUrl = `${process.env.CDN_BASE_URL}/${objectKey}`;

  return { fileUrl, thumbnailUrl };
}

// ─── Servicio de base de datos ────────────────────────────────────────────────

/**
 * Persiste el recuerdo en la base de datos y devuelve el registro completo.
 * Aquí se integra con Prisma / Drizzle / Supabase según el stack elegido.
 */
async function saveMemoryToDatabase(
  memory: Omit<UploadedMemory, 'createdAt'>
): Promise<UploadedMemory> {
  // Ejemplo con Prisma:
  // const saved = await prisma.memory.create({ data: { ...memory } });
  // return saved;

  // Implementación temporal que simula la persistencia con tipos correctos
  const saved: UploadedMemory = {
    ...memory,
    createdAt: new Date(),
  };

  return saved;
}

/**
 * Verifica que el usuario autenticado pertenezca a la pareja indicada
 * y devuelve el userId del partner para enviar notificaciones.
 */
async function validateCoupleOwnership(
  coupleId: string,
  requestingUserId: string
): Promise<{ isValid: boolean; partnerUserId: string | null }> {
  // Ejemplo con Prisma:
  // const couple = await prisma.couple.findUnique({
  //   where: { id: coupleId },
  //   select: { user1Id: true, user2Id: true },
  // });
  // if (!couple) return { isValid: false, partnerUserId: null };
  // if (couple.user1Id !== requestingUserId && couple.user2Id !== requestingUserId) {
  //   return { isValid: false, partnerUserId: null };
  // }
  // const partnerUserId = couple.user1Id === requestingUserId ? couple.user2Id : couple.user1Id;
  // return { isValid: true, partnerUserId };

  // Stub temporal — reemplazar con consulta real
  return { isValid: true, partnerUserId: 'partner-user-id-placeholder' };
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

/**
 * Extrae metadatos de imágenes usando sharp para enriquecer el recuerdo.
 */
async function extractImageMetadata(
  filePath: string
): Promise<Pick<MemoryMetadata, 'width' | 'height'>> {
  try {
    const meta = await sharp(filePath).metadata();
    return {
      width: meta.width,
      height: meta.height,
    };
  } catch {
    return {};
  }
}

/**
 * Determina el tipo de recuerdo a partir del mimeType del archivo subido.
 */
function resolveMemoryType(mimeType: string): MemoryType {
  return ALLOWED_MIME_TYPES[mimeType] ?? 'photo';
}

/**
 * Valida que el archivo no supere el límite específico para su tipo.
 */
function validateFileSizeForType(
  fileSizeBytes: number,
  memoryType: MemoryType
): boolean {
  return fileSizeBytes <= MAX_FILE_SIZES[memoryType];
}

/**
 * Limpia archivos temporales del disco después de procesar.
 */
async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // No propagar error de limpieza, es no crítico
    console.warn(`[uploadMemory] No se pudo eliminar archivo temporal: ${filePath}`);
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

/**
 * Handler para POST /api/memories/upload
 *
 * Flujo completo:
 * 1. Multer procesa el multipart y guarda el archivo en /tmp
 * 2. Se validan los campos del body con Zod
 * 3. Se verifica que el usuario pertenece a la pareja
 * 4. Se valida el tamaño específico según el tipo de archivo
 * 5. Se extraen metadatos (dimensiones para fotos)
 * 6. Se sube el archivo a cloud storage con thumbnail si aplica
 * 7. Se persiste el recuerdo en base de datos
 * 8. Se limpia el archivo temporal
 * 9. Se devuelve el recuerdo completo al cliente
 */
export async function uploadMemoryHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  const tempFilePath = req.file?.path ?? null;

  try {
    // ── Validar que se recibió un archivo ──────────────────────────────────
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'Se requiere un archivo. Envía el campo "file" en el multipart form.',
      } satisfies UploadMemoryErrorResponse);
      return;
    }

    // ── Validar que el usuario está autenticado (middleware previo lo pone en req.user) ──
    const requestingUserId = (req as Request & { user?: { id: string } }).user?.id;
    if (!requestingUserId) {
      res.status(401).json({
        success: false,
        error: 'No autenticado. Debes iniciar sesión para subir recuerdos.',
      } satisfies UploadMemoryErrorResponse);
      return;
    }

    // ── Validar campos del body con Zod ────────────────────────────────────
    const bodyValidation = uploadMemorySchema.safeParse(req.body);
    if (!bodyValidation.success) {
      const fieldErrors: Record<string, string[]> = {};
      bodyValidation.error.issues.forEach((issue) => {
        const field = issue.path.join('.') || 'general';
        if (!fieldErrors[field]) fieldErrors[field] = [];
        fieldErrors[field].push(issue.message);
      });

      res.status(422).json({
        success: false,
        error: 'Los datos enviados son inválidos.',
        details: fieldErrors,
      } satisfies UploadMemoryErrorResponse);
      return;
    }

    const {
      coupleId,
      emotion,
      caption,
      takenAt,
      locationLat,
      locationLng,
      locationPlaceName,
    } = bodyValidation.data;

    // ── Verificar que el usuario pertenece a esta pareja ───────────────────
    const { isValid, partnerUserId } = await validateCoupleOwnership(
      coupleId,
      requestingUserId
    );

    if (!isValid || !partnerUserId) {