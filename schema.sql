-- =====================================================
-- Schema de Base de Datos para RapidApp (como Rappi pero más rápido)
-- Motor: PostgreSQL 15+
-- Creado para producción con índices y constraints optimizados
-- =====================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- Para geolocalización
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para búsqueda de texto

-- =====================================================
-- TIPOS ENUMERADOS
-- =====================================================

CREATE TYPE user_role AS ENUM ('cliente', 'repartidor', 'comercio', 'admin');
CREATE TYPE order_status AS ENUM (
  'pendiente',
  'confirmado',
  'preparando',
  'listo_para_recoger',
  'en_camino',
  'entregado',
  'cancelado',
  'reembolsado'
);
CREATE TYPE payment_status AS ENUM ('pendiente', 'procesando', 'completado', 'fallido', 'reembolsado');
CREATE TYPE payment_method AS ENUM ('tarjeta_credito', 'tarjeta_debito', 'efectivo', 'billetera_digital', 'nequi', 'daviplata');
CREATE TYPE store_category AS ENUM (
  'restaurante',
  'supermercado',
  'farmacia',
  'licores',
  'mascotas',
  'electronica',
  'ropa',
  'flores',
  'panaderia',
  'helados',
  'otro'
);
CREATE TYPE delivery_status AS ENUM ('disponible', 'ocupado', 'desconectado', 'suspendido');
CREATE TYPE promotion_type AS ENUM ('porcentaje', 'monto_fijo', 'envio_gratis', '2x1');
CREATE TYPE notification_type AS ENUM ('orden', 'promocion', 'sistema', 'chat', 'pago');
CREATE TYPE vehicle_type AS ENUM ('bicicleta', 'moto', 'carro', 'patineta_electrica');

-- =====================================================
-- TABLA: ciudades
-- =====================================================
CREATE TABLE ciudades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(100) NOT NULL,
  pais VARCHAR(100) NOT NULL DEFAULT 'Colombia',
  codigo_pais CHAR(2) NOT NULL DEFAULT 'CO',
  zona_horaria VARCHAR(50) NOT NULL DEFAULT 'America/Bogota',
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ciudades_nombre ON ciudades(nombre);
CREATE INDEX idx_ciudades_activa ON ciudades(activa);

-- =====================================================
-- TABLA: usuarios
-- =====================================================
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  telefono VARCHAR(20) UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  rol user_role NOT NULL DEFAULT 'cliente',
  password_hash TEXT NOT NULL,
  fecha_nacimiento DATE,
  genero VARCHAR(20),
  ciudad_id UUID REFERENCES ciudades(id),
  activo BOOLEAN NOT NULL DEFAULT true,
  email_verificado BOOLEAN NOT NULL DEFAULT false,
  telefono_verificado BOOLEAN NOT NULL DEFAULT false,
  ultimo_login TIMESTAMPTZ,
  token_verificacion TEXT,
  token_recuperacion TEXT,
  token_recuperacion_expira TIMESTAMPTZ,
  refresh_token TEXT,
  push_token TEXT, -- Para notificaciones push
  idioma VARCHAR(10) NOT NULL DEFAULT 'es',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_telefono ON usuarios(telefono);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_ciudad ON usuarios(ciudad_id);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);

-- =====================================================
-- TABLA: sesiones_usuario (para manejo de múltiples dispositivos)
-- =====================================================
CREATE TABLE sesiones_usuario (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL UNIQUE,
  dispositivo VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  activa BOOLEAN NOT NULL DEFAULT true,
  expira_en TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sesiones_usuario_id ON sesiones_usuario(usuario_id);
CREATE INDEX idx_sesiones_token ON sesiones_usuario(refresh_token);
CREATE INDEX idx_sesiones_expira ON sesiones_usuario(expira_en);

-- =====================================================
-- TABLA: direcciones_usuario
-- =====================================================
CREATE TABLE direcciones_usuario (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL, -- "Casa", "Oficina", etc.
  direccion_linea1 VARCHAR(255) NOT NULL,
  direccion_linea2 VARCHAR(255),
  barrio VARCHAR(100),
  ciudad_id UUID NOT NULL REFERENCES ciudades(id),
  codigo_postal VARCHAR(20),
  instrucciones_entrega TEXT,
  latitud DECIMAL(10, 8) NOT NULL,
  longitud DECIMAL(11, 8) NOT NULL,
  ubicacion GEOGRAPHY(POINT, 4326), -- PostGIS para cálculos geoespaciales
  es_principal BOOLEAN NOT NULL DEFAULT false,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_direcciones_usuario_id ON direcciones_usuario(usuario_id);
CREATE INDEX idx_direcciones_ubicacion ON direcciones_usuario USING GIST(ubicacion);
CREATE INDEX idx_direcciones_principal ON direcciones_usuario(usuario_id, es_principal);

-- =====================================================
-- TABLA: comercios (tiendas/restaurantes)
-- =====================================================
CREATE TABLE comercios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  propietario_id UUID NOT NULL REFERENCES usuarios(id),
  nombre VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE, -- URL amigable
  descripcion TEXT,
  categoria store_category NOT NULL,
  subcategoria VARCHAR(100),
  logo_url TEXT,
  banner_url TEXT,
  telefono VARCHAR(20),
  email VARCHAR(255),
  ciudad_id UUID NOT NULL REFERENCES ciudades(id),
  direccion VARCHAR(255) NOT NULL,
  barrio VARCHAR(100),
  latitud DECIMAL(10, 8) NOT NULL,
  longitud DECIMAL(11, 8) NOT NULL,
  ubicacion GEOGRAPHY(POINT, 4326),
  radio_entrega_km DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
  tiempo_preparacion_min INTEGER NOT NULL DEFAULT 20, -- Tiempo promedio en minutos
  costo_envio_base DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  pedido_minimo DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  calificacion_promedio DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
  total_calificaciones INTEGER NOT NULL DEFAULT 0,
  total_ordenes INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  verificado BOOLEAN NOT NULL DEFAULT false,
  destacado BOOLEAN NOT NULL DEFAULT false,
  acepta_efectivo BOOLEAN NOT NULL DEFAULT true,
  tiempo_entrega_min_min INTEGER NOT NULL DEFAULT 20, -- Estimado mínimo entrega
  tiempo_entrega_max_min INTEGER NOT NULL DEFAULT 45, -- Estimado máximo entrega
  tags TEXT[], -- ["rápido", "económico", "popular"]
  nit VARCHAR(20), -- Número de identificación tributaria
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comercios_propietario ON comercios(propietario_id);
CREATE INDEX idx_comercios_ciudad ON comercios(ciudad_id);
CREATE INDEX idx_comercios_categoria ON comercios(categoria);
CREATE INDEX idx_comercios_activo ON comercios(activo);
CREATE INDEX idx_comercios_destacado ON comercios(destacado);
CREATE INDEX idx_comercios_calificacion ON comercios(calificacion_promedio DESC);
CREATE INDEX idx_comercios_ubicacion ON comercios USING GIST(ubicacion);
CREATE INDEX idx_comercios_slug ON comercios(slug);
CREATE INDEX idx_comercios_nombre_trgm ON comercios USING GIN(nombre gin_trgm_ops);

-- =====================================================
-- TABLA: horarios_comercio
-- =====================================================
CREATE TABLE horarios_comercio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comercio_id UUID NOT NULL REFERENCES comercios(id) ON DELETE CASCADE,
  dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=Domingo, 6=Sábado
  hora_apertura TIME NOT NULL,
  hora_cierre TIME NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(comercio_id, dia_semana)
);

CREATE INDEX idx_horarios_comercio_id ON horarios_comercio(comercio_id);

-- =====================================================
-- TABLA: categorias_menu (categorías de productos dentro de un comercio)
-- =====================================================
CREATE TABLE categorias_menu (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comercio_id UUID NOT NULL REFERENCES comercios(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  orden INTEGER NOT NULL DEFAULT 0,
  activa BOOLEAN NOT NULL DEFAULT true,
  disponible_desde TIME, -- Disponible solo en ciertos horarios
  disponible_hasta TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categorias_menu_comercio ON categorias_menu(comercio_id);
CREATE INDEX idx_categorias_menu_orden ON categorias_menu(comercio_id, orden);

-- =====================================================
-- TABLA: productos
-- =====================================================
CREATE TABLE productos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comercio_id UUID NOT NULL REFERENCES comercios(id) ON DELETE CASCADE,
  categoria_menu_id UUID REFERENCES categorias_menu(id) ON DELETE SET NULL,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  imagenes_urls TEXT[], -- Múltiples imágenes
  precio DECIMAL(10, 2) NOT NULL CHECK (precio >= 0),
  precio_original DECIMAL(10, 2), -- Para mostrar descuentos
  sku VARCHAR(100),
  codigo_barras VARCHAR(100),
  disponible BOOLEAN NOT NULL DEFAULT true,
  destacado BOOLEAN NOT NULL DEFAULT false,
  es_nuevo BOOLEAN NOT NULL DEFAULT false,
  stock INTEGER, -- NULL = ilimitado
  calorias INTEGER,
  tiempo_preparacion_min INTEGER,
  orden INTEGER NOT NULL DEFAULT 0,
  calificacion_promedio DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
  total_calificaciones INTEGER NOT NULL DEFAULT 0,
  total_vendidos INTEGER NOT NULL DEFAULT 0,
  etiquetas TEXT[], -- ["vegetariano", "sin gluten", "picante"]
  informacion_nutricional JSONB,
  alergenos TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_productos_comercio ON productos(comercio_id);
CREATE INDEX idx_productos_categoria ON productos(categoria_menu_id);
CREATE INDEX idx_productos_disponible ON productos(disponible);
CREATE INDEX idx_productos_destacado ON productos(destacado);
CREATE INDEX idx_productos_precio ON productos(precio);
CREATE INDEX idx_productos_nombre_trgm ON productos USING GIN(nombre gin_trgm_ops);

-- =====================================================
-- TABLA: opciones_producto (personalizaciones: tamaño, sabor, etc.)
-- =====================================================
CREATE TABLE grupos_opciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL, -- "Tamaño", "Salsa", "Extras"
  descripcion TEXT,
  requerido BOOLEAN NOT NULL DEFAULT false,
  seleccion_multiple BOOLEAN NOT NULL DEFAULT false,
  min_selecciones INTEGER NOT NULL DEFAULT 0,
  max_selecciones INTEGER NOT NULL DEFAULT 1,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_grupos_opciones_producto ON grupos_opciones(producto_id);

CREATE TABLE opciones_producto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grupo_id UUID NOT NULL REFERENCES grupos_opciones(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL, -- "Grande", "BBQ", "Queso extra"
  precio_adicional DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  disponible BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_opciones_grupo ON opciones_producto(grupo_id);

-- =====================================================
-- TABLA: repartidores
-- =====================================================
CREATE TABLE repartidores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  ciudad_id UUID NOT NULL REFERENCES ciudades(id),
  tipo_vehiculo vehicle_type NOT NULL DEFAULT 'moto',
  placa_vehiculo VARCHAR(20),
  numero_licencia VARCHAR(50),
  foto_licencia_url TEXT,
  foto_vehiculo_url TEXT,
  cedula VARCHAR(20) NOT NULL UNIQUE,
  foto_cedula_url TEXT,
  estado delivery_status NOT NULL DEFAULT 'desconectado',
  latitud_actual DECIMAL(10, 8),
  longitud_actual DECIMAL(11, 8),
  ubicacion_actual GEOGRAPHY(POINT, 4326),
  ultima_actualizacion_ubicacion TIMESTAMPTZ,
  calificacion_promedio DECIMAL(3, 2) NOT NULL DEFAULT 5.00,
  total_calificaciones INTEGER NOT NULL DEFAULT 0,
  total_entregas INTEGER NOT NULL DEFAULT 0,
  total_ganancias DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  verificado BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true,
  radio_operacion_km DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
  numero_cuenta_bancaria VARCHAR(50),
  banco VARCHAR(100),
  tipo_cuenta VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repartidores_usuario ON repartidores(usuario_id);
CREATE INDEX idx_repartidores_ciudad ON repartidores(ciudad_id);
CREATE INDEX idx_repartidores_estado ON repartidores(estado);
CREATE INDEX idx_repartidores_ubicacion ON repartidores USING