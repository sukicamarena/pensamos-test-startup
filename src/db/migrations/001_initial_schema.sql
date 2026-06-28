-- =============================================================================
-- Migración 001: Esquema inicial para pandunesiosss
-- Red social para parejas con sistema de reconciliación
-- =============================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABLA: users
-- Almacena la información de cada usuario de la plataforma
-- =============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    date_of_birth DATE,
    phone_number VARCHAR(20),
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    push_token TEXT, -- token para notificaciones push
    notification_preferences JSONB NOT NULL DEFAULT '{
        "push_enabled": true,
        "email_enabled": true,
        "sms_enabled": false
    }',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Índices para users
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_is_active ON users(is_active) WHERE deleted_at IS NULL;

-- =============================================================================
-- TABLA: couples
-- Representa el vínculo oficial entre dos usuarios como pareja
-- =============================================================================
CREATE TABLE couples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_one_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_two_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'paused', 'ended')),
    anniversary_date DATE, -- fecha de aniversario de la pareja
    couple_name VARCHAR(100), -- nombre que le ponen a su relación
    cover_photo_url TEXT,
    invitation_token UUID DEFAULT uuid_generate_v4(), -- token para invitar a la pareja
    invitation_expires_at TIMESTAMPTZ,
    invited_by UUID NOT NULL REFERENCES users(id),
    activated_at TIMESTAMPTZ, -- cuando la pareja aceptó la invitación
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Un usuario no puede tener dos parejas activas al mismo tiempo
    CONSTRAINT couples_no_duplicate CHECK (user_one_id <> user_two_id),
    CONSTRAINT couples_ordered CHECK (user_one_id < user_two_id)
);

-- Índices para couples
CREATE INDEX idx_couples_user_one ON couples(user_one_id);
CREATE INDEX idx_couples_user_two ON couples(user_two_id);
CREATE INDEX idx_couples_status ON couples(status);
CREATE INDEX idx_couples_invitation_token ON couples(invitation_token) WHERE status = 'pending';

-- Índice único para evitar que una pareja exista duplicada
CREATE UNIQUE INDEX idx_couples_unique_pair
    ON couples(user_one_id, user_two_id)
    WHERE status IN ('pending', 'active');

-- =============================================================================
-- TABLA: memories
-- Recuerdos que las parejas suben: fotos, mensajes, lugares especiales
-- Se usan para enviar cuando alguno presiona el botón de "estoy enojado"
-- =============================================================================
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    type VARCHAR(20) NOT NULL
        CHECK (type IN ('photo', 'video', 'text', 'audio', 'location')),
    title VARCHAR(200),
    description TEXT,
    media_url TEXT, -- URL en S3/CDN para fotos, videos o audios
    thumbnail_url TEXT, -- miniatura para videos
    love_message TEXT, -- mensaje de amor asociado a este recuerdo
    location_name VARCHAR(200), -- nombre del lugar (ej: "donde nos conocimos")
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    memory_date DATE, -- fecha en que ocurrió el recuerdo
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    times_sent INTEGER NOT NULL DEFAULT 0, -- cuántas veces se envió este recuerdo
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Índices para memories
CREATE INDEX idx_memories_couple_id ON memories(couple_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_memories_uploaded_by ON memories(uploaded_by);
CREATE INDEX idx_memories_type ON memories(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_memories_is_favorite ON memories(couple_id, is_favorite) WHERE deleted_at IS NULL;
CREATE INDEX idx_memories_active ON memories(couple_id, is_active) WHERE deleted_at IS NULL;

-- =============================================================================
-- TABLA: fight_events
-- Registra cada vez que alguien presiona el botón de "estoy enojado"
-- El corazón del producto pandunesiosss
-- =============================================================================
CREATE TABLE fight_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    triggered_by UUID NOT NULL REFERENCES users(id), -- quién presionó el botón
    partner_id UUID NOT NULL REFERENCES users(id), -- la otra persona de la pareja
    status VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (status IN (
            'active',       -- pelea activa, se están enviando recuerdos
            'reconciled',   -- ya se reconciliaron
            'expired',      -- pasó mucho tiempo sin reconciliación
            'cancelled'     -- quien lo inició lo canceló
        )),
    intensity_level INTEGER NOT NULL DEFAULT 1
        CHECK (intensity_level BETWEEN 1 AND 5), -- nivel de enojo del 1 al 5
    trigger_note TEXT, -- nota opcional de por qué están enojados (privada)
    memories_sent_count INTEGER NOT NULL DEFAULT 0,
    reconciled_at TIMESTAMPTZ,
    reconciled_by UUID REFERENCES users(id), -- quién inició la reconciliación
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para fight_events
CREATE INDEX idx_fight_events_couple_id ON fight_events(couple_id);
CREATE INDEX idx_fight_events_triggered_by ON fight_events(triggered_by);
CREATE INDEX idx_fight_events_status ON fight_events(status);
CREATE INDEX idx_fight_events_active ON fight_events(couple_id, status)
    WHERE status = 'active';
CREATE INDEX idx_fight_events_created_at ON fight_events(created_at DESC);

-- =============================================================================
-- TABLA: fight_memory_sends
-- Registra cada recuerdo enviado durante una pelea
-- Evita repetir el mismo recuerdo muy seguido
-- =============================================================================
CREATE TABLE fight_memory_sends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fight_event_id UUID NOT NULL REFERENCES fight_events(id) ON DELETE CASCADE,
    memory_id UUID NOT NULL REFERENCES memories(id),
    couple_id UUID NOT NULL REFERENCES couples(id),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed')),
    -- reacciones de cada miembro al recuerdo enviado
    user_one_reaction VARCHAR(20)
        CHECK (user_one_reaction IN ('loved', 'smiled', 'cried', 'none')),
    user_two_reaction VARCHAR(20)
        CHECK (user_two_reaction IN ('loved', 'smiled', 'cried', 'none')),
    user_one_reacted_at TIMESTAMPTZ,
    user_two_reacted_at TIMESTAMPTZ,
    notification_ids JSONB DEFAULT '{}' -- IDs de notificaciones push enviadas
);

-- Índices para fight_memory_sends
CREATE INDEX idx_fms_fight_event_id ON fight_memory_sends(fight_event_id);
CREATE INDEX idx_fms_memory_id ON fight_memory_sends(memory_id);
CREATE INDEX idx_fms_couple_id ON fight_memory_sends(couple_id);
CREATE INDEX idx_fms_sent_at ON fight_memory_sends(sent_at DESC);

-- =============================================================================
-- TABLA: love_messages
-- Mensajes de amor predefinidos y personalizados para enviar durante peleas
-- Se mezclan con los recuerdos al presionar el botón
-- =============================================================================
CREATE TABLE love_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID REFERENCES couples(id) ON DELETE CASCADE, -- NULL = mensaje global del sistema
    created_by UUID REFERENCES users(id), -- NULL = mensaje del sistema
    message TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general'
        CHECK (category IN (
            'general',
            'apology',      -- disculpas
            'reminder',     -- recordatorio de por qué se aman
            'funny',        -- mensajes chistosos para quitar tensión
            'romantic',     -- mensajes románticos
            'custom'        -- creados por la pareja
        )),
    language VARCHAR(10) NOT NULL DEFAULT 'es',
    is_system_message BOOLEAN NOT NULL DEFAULT FALSE,
    times_used INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para love_messages
CREATE INDEX idx_love_messages_couple_id ON love_messages(couple_id) WHERE is_active = TRUE;
CREATE INDEX idx_love_messages_system ON love_messages(is_system_message, language) WHERE is_active = TRUE;
CREATE INDEX idx_love_messages_category ON love_messages(category) WHERE is_active = TRUE;

-- =============================================================================
-- TABLA: reconciliation_actions
-- Acciones específicas que puede hacer cada quien para reconciliarse
-- Dentro de un evento de pelea activo
-- =============================================================================
CREATE TABLE reconciliation_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fight_event_id UUID NOT NULL REFERENCES fight_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL
        CHECK (action_type IN (
            'sent_hug',         -- envió un abrazo virtual
            'sent_kiss',        -- envió un beso virtual
            'wrote_apology',    -- escribió una disculpa
            'reacted_to_memory', -- reaccionó a un recuerdo
            'pressed_makeup',   -- presionó botón de "ya me pasó"
            'sent_voice_note'   -- envió nota de voz de disculpa
        )),
    message TEXT, -- mensaje opcional con la acción
    media_url TEXT, -- URL si la acción incluye media (nota de voz)
    seen_by_partner BOOLEAN NOT NULL DEFAULT FALSE,
    seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para reconciliation_actions
CREATE INDEX idx_reconciliation_fight_id ON reconciliation_actions(fight_event_id);
CREATE INDEX idx_reconciliation_user_id ON reconciliation_actions(user_id);
CREATE INDEX idx_reconciliation_type ON reconciliation_actions(action_type);

-- =============================================================================
-- TABLA: couple_stats
-- Estadísticas de la relación para que las parejas vean su progreso
-- =============================================================================
CREATE TABLE couple_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL UNIQUE REFERENCES couples(id) ON DELETE CASCADE,
    total_fights INTEGER NOT NULL DEFAULT 0,
    total_reconciliations INTEGER NOT NULL DEFAULT 0,
    average_reconciliation_minutes INTEGER NOT NULL DEFAULT 0, -- promedio en minutos
    fastest_reconciliation_minutes INTEGER, -- récord más rápido
    slowest_reconciliation_minutes INTEGER,
    total_memories_uploaded INTEGER NOT NULL DEFAULT 0,
    total_love_messages_sent INTEGER NOT NULL DEFAULT 0,
    longest_streak_days INTEGER NOT NULL DEFAULT 0, -- días seguidos sin pelea
    current_streak_days INTEGER NOT NULL DEFAULT 0,
    last_fight_at TIMESTAMPTZ,
    last_reconciliation_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para couple_stats
CREATE INDEX idx_couple_stats_couple_id ON couple_stats(couple_id);
CREATE INDEX idx_couple_stats_streak ON couple_stats(current_streak_days DESC);

-- =============================================================================
-- TABLA: notifications_log
-- Log de todas las notificaciones enviadas (push, email, SMS)
-- =============================================================================
CREATE TABLE notifications_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    couple_id UUID REFERENCES couples(id),
    fight_event_id UUID REFERENCES fight_events(id),
    type VARCHAR(20) NOT NULL
        CHECK (type IN ('push', 'email', 'sms', 'in_app')),
    category VARCHAR(50) NOT NULL
        CHECK (category IN (
            'fight_started',
            'memory_sent',
            'partner_reacted',
            'reconciliation_action',
            'reconciled',
            'anniversary_reminder',
            'streak_milestone',
            'partner_invitation'
        )),
    title VARCHAR(200),
    body TEXT,
    data JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
    external_id TEXT, -- ID del proveedor externo (FCM, SendGrid, etc.)
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para notifications_log
CREATE INDEX idx_notifications_user_id ON notifications_log(user_id);
CREATE INDEX idx_notifications_fight_event ON notifications_log(fight_event_id);
CREATE INDEX idx_notifications_status ON notifications_log(status) WHERE status = 'pending';
CREATE INDEX idx_notifications_created_at ON notifications_log(created_at DESC);

-- =============================================================================
-- TABLA: sessions
-- Gestión de sesiones de usuario (tokens JWT refresh)
-- =============================================================================
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL UNIQUE,
    device_type VARCHAR(20)
        CHECK (device_type IN ('ios', 'android', 'web', 'unknown')),
    device_name VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at