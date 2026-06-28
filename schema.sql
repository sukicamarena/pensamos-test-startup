-- =============================================================================
-- pandunesiosss - Red Social para Parejas
-- Schema de Base de Datos PostgreSQL
-- =============================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABLA: usuarios
-- Almacena la información de cada usuario registrado en la plataforma
-- =============================================================================
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(50) NOT NULL UNIQUE,
    nombre_completo VARCHAR(150) NOT NULL,
    password_hash TEXT NOT NULL,
    foto_perfil_url TEXT,
    bio TEXT,
    fecha_nacimiento DATE,
    timezone VARCHAR(100) DEFAULT 'America/Mexico_City',
    esta_activo BOOLEAN DEFAULT TRUE,
    email_verificado BOOLEAN DEFAULT FALSE,
    token_verificacion_email UUID DEFAULT uuid_generate_v4(),
    ultimo_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para usuarios
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_username ON usuarios(username);
CREATE INDEX idx_usuarios_esta_activo ON usuarios(esta_activo);

-- =============================================================================
-- TABLA: parejas
-- Representa el vínculo oficial entre dos usuarios como pareja
-- =============================================================================
CREATE TABLE parejas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_solicitante_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    usuario_receptor_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'activa', 'en_pelea', 'pausada', 'disuelta')),
    apodo_pareja VARCHAR(100),
    fecha_aniversario DATE,
    fecha_inicio_relacion DATE,
    foto_pareja_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Un usuario no puede tener más de una pareja activa
    CONSTRAINT usuarios_distintos CHECK (usuario_solicitante_id <> usuario_receptor_id),
    CONSTRAINT pareja_unica UNIQUE (usuario_solicitante_id, usuario_receptor_id)
);

-- Índices para parejas
CREATE INDEX idx_parejas_solicitante ON parejas(usuario_solicitante_id);
CREATE INDEX idx_parejas_receptor ON parejas(usuario_receptor_id);
CREATE INDEX idx_parejas_estado ON parejas(estado);

-- =============================================================================
-- TABLA: estados_pelea
-- Registra cada vez que uno o ambos miembros de la pareja activan el botón
-- "estoy enojado/a". Es el corazón del producto.
-- =============================================================================
CREATE TABLE estados_pelea (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pareja_id UUID NOT NULL REFERENCES parejas(id) ON DELETE CASCADE,
    usuario_que_reporta_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

    -- Nivel de enojo del 1 (leve) al 5 (muy enojado)
    nivel_enojo SMALLINT NOT NULL DEFAULT 3
        CHECK (nivel_enojo BETWEEN 1 AND 5),

    -- Nota opcional que puede dejar el usuario al apretar el botón
    nota_personal TEXT,

    -- Momento en que el otro integrante también confirmó que está enojado
    confirmado_por_pareja_at TIMESTAMPTZ,

    -- Cuándo se resolvió la pelea
    resuelto_at TIMESTAMPTZ,

    -- Quién marcó la resolución
    resuelto_por_usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,

    -- Estado interno del flujo de la pelea
    estado VARCHAR(30) NOT NULL DEFAULT 'activo'
        CHECK (estado IN ('activo', 'ambos_confirmados', 'resuelto', 'cancelado')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NOT DEFAULT NOW()
);

-- Índices para estados_pelea
CREATE INDEX idx_estados_pelea_pareja ON estados_pelea(pareja_id);
CREATE INDEX idx_estados_pelea_usuario ON estados_pelea(usuario_que_reporta_id);
CREATE INDEX idx_estados_pelea_estado ON estados_pelea(estado);
CREATE INDEX idx_estados_pelea_created ON estados_pelea(created_at DESC);

-- =============================================================================
-- TABLA: recuerdos
-- Fotos, mensajes, fechas especiales y momentos que la pareja sube a la app.
-- Estos se usan para enviar cuando hay una pelea.
-- =============================================================================
CREATE TABLE recuerdos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pareja_id UUID NOT NULL REFERENCES parejas(id) ON DELETE CASCADE,
    subido_por_usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

    tipo VARCHAR(30) NOT NULL
        CHECK (tipo IN ('foto', 'video', 'texto', 'audio', 'fecha_especial')),

    titulo VARCHAR(200),
    descripcion TEXT,

    -- URL del archivo multimedia (foto, video, audio)
    archivo_url TEXT,
    archivo_thumbnail_url TEXT,
    archivo_duracion_segundos INTEGER,

    -- Para recuerdos de tipo texto o mensajes de amor escritos
    contenido_texto TEXT,

    -- Fecha real del recuerdo (ej: cuando fue tomada la foto)
    fecha_recuerdo DATE,

    -- Tags emocionales para categorizar el recuerdo
    tags TEXT[] DEFAULT '{}',

    -- Si puede ser enviado automáticamente en peleas
    permitir_envio_automatico BOOLEAN DEFAULT TRUE,

    -- Cuántas veces fue enviado como "recordatorio de amor"
    veces_enviado INTEGER DEFAULT 0,

    -- Solo visible para la pareja, no público
    es_privado BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para recuerdos
CREATE INDEX idx_recuerdos_pareja ON recuerdos(pareja_id);
CREATE INDEX idx_recuerdos_subido_por ON recuerdos(subido_por_usuario_id);
CREATE INDEX idx_recuerdos_tipo ON recuerdos(tipo);
CREATE INDEX idx_recuerdos_envio_automatico ON recuerdos(permitir_envio_automatico) WHERE permitir_envio_automatico = TRUE;
CREATE INDEX idx_recuerdos_tags ON recuerdos USING GIN(tags);

-- =============================================================================
-- TABLA: envios_recuerdos
-- Log de cada vez que el sistema envió un recuerdo durante una pelea.
-- Permite rastrear qué se envió, cuándo y con qué mensaje.
-- =============================================================================
CREATE TABLE envios_recuerdos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estado_pelea_id UUID NOT NULL REFERENCES estados_pelea(id) ON DELETE CASCADE,
    recuerdo_id UUID NOT NULL REFERENCES recuerdos(id) ON DELETE CASCADE,
    pareja_id UUID NOT NULL REFERENCES parejas(id) ON DELETE CASCADE,

    -- Mensaje de amor generado automáticamente o personalizado que acompaña el recuerdo
    mensaje_amor TEXT NOT NULL,

    -- Si el mensaje fue generado por IA o es predefinido
    mensaje_generado_por VARCHAR(20) NOT NULL DEFAULT 'predefinido'
        CHECK (mensaje_generado_por IN ('predefinido', 'ia', 'personalizado')),

    -- A quién fue enviado (puede ser a los dos o solo a uno)
    enviado_a_usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

    -- Cuándo lo leyó el usuario destino
    leido_at TIMESTAMPTZ,

    -- Reacción del usuario al recibir el recuerdo
    reaccion VARCHAR(20)
        CHECK (reaccion IN ('corazon', 'llanto', 'sonrisa', 'nostalgia', 'ninguna')),

    -- Nota de reacción opcional
    nota_reaccion TEXT,

    enviado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para envios_recuerdos
CREATE INDEX idx_envios_estado_pelea ON envios_recuerdos(estado_pelea_id);
CREATE INDEX idx_envios_recuerdo ON envios_recuerdos(recuerdo_id);
CREATE INDEX idx_envios_pareja ON envios_recuerdos(pareja_id);
CREATE INDEX idx_envios_usuario ON envios_recuerdos(enviado_a_usuario_id);
CREATE INDEX idx_envios_leido ON envios_recuerdos(leido_at) WHERE leido_at IS NULL;

-- =============================================================================
-- TABLA: mensajes_amor_predefinidos
-- Banco de mensajes de amor del sistema que se envían durante las peleas.
-- Pueden ser por categoría y nivel de enojo.
-- =============================================================================
CREATE TABLE mensajes_amor_predefinidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contenido TEXT NOT NULL,

    -- Categoría del mensaje
    categoria VARCHAR(50) NOT NULL DEFAULT 'general'
        CHECK (categoria IN (
            'general', 'nostalgia', 'perdon', 'te_amo',
            'recuerdo_especial', 'humor', 'motivacional', 'romantico'
        )),

    -- Para qué nivel de enojo es más apropiado (NULL = todos)
    nivel_enojo_max SMALLINT CHECK (nivel_enojo_max BETWEEN 1 AND 5),

    -- Idioma del mensaje
    idioma VARCHAR(10) DEFAULT 'es',

    -- Cuántas veces fue usado
    veces_usado INTEGER DEFAULT 0,

    -- Rating promedio de efectividad (si los usuarios lo califican)
    rating_efectividad DECIMAL(3,2) DEFAULT 0.0
        CHECK (rating_efectividad BETWEEN 0.0 AND 5.0),

    esta_activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para mensajes_amor_predefinidos
CREATE INDEX idx_mensajes_categoria ON mensajes_amor_predefinidos(categoria);
CREATE INDEX idx_mensajes_activo ON mensajes_amor_predefinidos(esta_activo) WHERE esta_activo = TRUE;
CREATE INDEX idx_mensajes_idioma ON mensajes_amor_predefinidos(idioma);

-- =============================================================================
-- TABLA: notificaciones
-- Registro de todas las notificaciones push/email enviadas a los usuarios
-- =============================================================================
CREATE TABLE notificaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_destino_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    pareja_id UUID REFERENCES parejas(id) ON DELETE CASCADE,

    tipo VARCHAR(50) NOT NULL
        CHECK (tipo IN (
            'solicitud_pareja',
            'pareja_aceptada',
            'alerta_pelea',
            'pareja_tambien_enojada',
            'recuerdo_enviado',
            'pelea_resuelta',
            'aniversario',
            'fecha_especial',
            'mensaje_amor'
        )),

    titulo VARCHAR(200) NOT NULL,
    cuerpo TEXT NOT NULL,

    -- Datos extra en JSON para el cliente (deep links, ids, etc.)
    metadata JSONB DEFAULT '{}',

    canal VARCHAR(20) NOT NULL DEFAULT 'push'
        CHECK (canal IN ('push', 'email', 'sms', 'in_app')),

    leida BOOLEAN DEFAULT FALSE,
    leida_at TIMESTAMPTZ,

    enviada BOOLEAN DEFAULT FALSE,
    enviada_at TIMESTAMPTZ,

    -- Para reintentos
    intentos_envio SMALLINT DEFAULT 0,
    ultimo_error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para notificaciones
CREATE INDEX idx_notificaciones_usuario ON notificaciones(usuario_destino_id);
CREATE INDEX idx_notificaciones_no_leidas ON notificaciones(usuario_destino_id, leida) WHERE leida = FALSE;
CREATE INDEX idx_notificaciones_tipo ON notificaciones(tipo);
CREATE INDEX idx_notificaciones_created ON notificaciones(created_at DESC);

-- =============================================================================
-- TABLA: dispositivos_push
-- Tokens de dispositivos para notificaciones push (iOS, Android, Web)
-- =============================================================================
CREATE TABLE dispositivos_push (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    plataforma VARCHAR(20) NOT NULL
        CHECK (plataforma IN ('ios', 'android', 'web')),
    esta_activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT token_usuario_unico UNIQUE (usuario_id, token)
);

-- Índices para dispositivos_push
CREATE INDEX idx_dispositivos_usuario ON dispositivos_push(usuario_id);
CREATE INDEX idx_dispositivos_activos ON dispositivos_push(usuario_id, esta_activo) WHERE esta_activo = TRUE;

-- =============================================================================
-- TABLA: estadisticas_pareja
-- Métricas y estadísticas divertidas de la relación para gamificación
-- =============================================================================
CREATE TABLE estadisticas_pareja (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pareja_id UUID NOT NULL UNIQUE REFERENCES parejas(id) ON DELETE CASCADE,

    -- Contadores de peleas
    total_peleas INTEGER DEFAULT 0,
    peleas_este_mes INTEGER DEFAULT 0,
    pelea_mas_larga_horas DECIMAL(10,2) DEFAULT 0,
    pelea_promedio_horas DECIMAL(10,2) DEFAULT 0,

    -- Contadores de reconciliaciones
    total_reconciliaciones INTEGER DEFAULT 0,
    tiempo_promedio_reconciliacion_minutos INTEGER DEFAULT 0,

    -- Recuerdos
    total_recuerdos_subidos INTEGER DEFAULT 0,
    total_recuerdos_enviados_en_peleas INTEGER DEFAULT 0,
    recuerdo_mas_efectivo_id UUID REFERENCES recuerdos(id) ON DELETE SET NULL,

    -- Racha sin peleas (en días)
    racha_actual_sin_pelea_dias INTEGER DEFAULT 0,
    mejor_racha_sin_pelea_dias INTEGER DEFAULT 0,

    -- Fecha de última pelea
    ultima_pelea_at TIMESTAMPTZ,
    ultima_reconciliacion_at TIMESTAMPTZ,

    -- Puntaje de "amor" gamificado
    puntos_amor INTEGER DEFAULT 100,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para estadisticas_pareja
CREATE INDEX idx_estadisticas_pareja_id ON estadisticas_pareja(pareja_id);
CREATE INDEX idx_estadisticas_puntos ON estadisticas_pareja(puntos_amor DESC);

-- =============================================================================
-- TABLA: logros
-- Sistema de logros/badges para gamificación de la relación