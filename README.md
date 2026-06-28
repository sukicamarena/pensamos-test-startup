# RapidoApp 🚀

> Plataforma de delivery ultrarrápido — más veloz que Rappi

---

## ¿Qué es RapidoApp?

RapidoApp es una plataforma SaaS de delivery on-demand construida con arquitectura moderna y optimizada para velocidad de entrega. El objetivo es superar los tiempos de entrega estándar del mercado mediante:

- **Algoritmos de ruteo inteligente** en tiempo real
- **Red de dark stores** estratégicamente ubicadas
- **Sistema de despacho predictivo** basado en demanda histórica
- **App ultraliviana** con tiempo de carga < 1 segundo

---

## Stack Tecnológico

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Frontend Web | Next.js 14 + TypeScript | SSR, performance, SEO |
| App Móvil | React Native + Expo | Un solo codebase iOS/Android |
| Backend API | Node.js + Fastify + TypeScript | Throughput superior a Express |
| Base de Datos | PostgreSQL + PostGIS | Queries geoespaciales nativas |
| Cache | Redis 7 | Sesiones, colas, pub/sub |
| Cola de Mensajes | BullMQ | Jobs de despacho asincrónicos |
| Tiempo Real | Socket.io | Tracking en vivo del repartidor |
| ORM | Prisma | Type-safety end-to-end |
| Auth | JWT + Refresh Tokens | Stateless, escalable |
| Pagos | Stripe + MercadoPago | Cobertura LATAM completa |
| Maps | Google Maps Platform | Ruteo y geocoding |
| Storage | AWS S3 + CloudFront | Imágenes de productos/restaurantes |
| Infra | AWS ECS + RDS + ElastiCache | Auto-scaling productivo |
| CI/CD | GitHub Actions + Docker | Deploy automatizado |
| Monitoreo | Datadog + Sentry | Observabilidad completa |

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTES                              │
│  [App iOS]  [App Android]  [Web App]  [Admin Dashboard]     │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS / WebSocket
┌──────────────────────▼──────────────────────────────────────┐
│                    API GATEWAY                               │
│              (Rate Limiting + Auth + SSL)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│  Auth     │  │  Orders   │  │ Tracking  │
│  Service  │  │  Service  │  │  Service  │
└───────────┘  └─────┬─────┘  └───────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
┌───────────┐  ┌──────────┐  ┌────────┐
│ PostgreSQL│  │  Redis   │  │ BullMQ │
│ + PostGIS │  │  Cache   │  │ Queues │
└───────────┘  └──────────┘  └────────┘
```

---

## Módulos del Producto

### 👤 Usuarios & Auth
- Registro/login por email, Google, Apple, teléfono (OTP SMS)
- Perfiles de cliente, repartidor y comercio
- KYC básico para repartidores

### 🛒 Catálogo & Comercios
- Onboarding de restaurantes y tiendas
- Gestión de menú con variantes, modificadores y disponibilidad
- Horarios, zonas de cobertura y tiempos estimados

### 📦 Pedidos
- Carrito en tiempo real con validación de stock
- Checkout con múltiples métodos de pago
- Estados: `PENDING → CONFIRMED → PREPARING → PICKED_UP → DELIVERED`
- Cancelaciones y reembolsos automáticos

### 🏍️ Despacho & Ruteo
- Asignación automática de repartidor más cercano (PostGIS)
- Ruteo optimizado con Google Directions API
- Tracking en vivo cada 3 segundos via WebSocket
- Sistema de zonas calientes predictivas

### 💳 Pagos
- Procesamiento con Stripe (tarjetas internacionales)
- MercadoPago (LATAM: transferencias, efectivo, cuotas)
- Wallet interno con recarga
- Comisiones automáticas a comercios

### ⭐ Reviews & Calidad
- Rating post-entrega (cliente → comercio, cliente → repartidor)
- Sistema de reportes y moderación
- Dashboard de métricas para comercios

### 📊 Analytics & Admin
- Dashboard en tiempo real de pedidos activos
- Métricas de negocio: GMV, take-rate, tiempo promedio
- Mapa de calor de demanda por zona
- Gestión de usuarios, comercios y repartidores

---

## Estructura del Repositorio

```
rapidoapp/
├── apps/
│   ├── web/                    # Next.js — app del cliente
│   ├── mobile/                 # React Native — iOS & Android
│   ├── admin/                  # Next.js — panel de administración
│   └── rider/                  # React Native — app del repartidor
├── packages/
│   ├── api/                    # Fastify API principal
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── users/
│   │   │   │   ├── stores/
│   │   │   │   ├── products/
│   │   │   │   ├── orders/
│   │   │   │   ├── payments/
│   │   │   │   ├── dispatch/
│   │   │   │   └── tracking/
│   │   │   ├── shared/
│   │   │   │   ├── middleware/
│   │   │   │   ├── utils/
│   │   │   │   └── types/
│   │   │   └── server.ts
│   │   └── prisma/
│   │       └── schema.prisma
│   ├── shared-types/           # Tipos TypeScript compartidos
│   ├── ui-components/          # Design system compartido
│   └── config/                 # Configs compartidas (ESLint, TS)
├── infrastructure/
│   ├── docker/
│   ├── terraform/              # IaC para AWS
│   └── nginx/
├── scripts/
│   ├── seed.ts                 # Datos de prueba
│   └── migrate.ts
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── docker-compose.yml          # Entorno local completo
├── docker-compose.prod.yml
└── turbo.json                  # Monorepo con Turborepo
```

---

## Inicio Rápido (Desarrollo Local)

### Prerrequisitos

- Node.js >= 20.x
- Docker & Docker Compose
- pnpm >= 8.x

```bash
# Instalar pnpm si no lo tienes
npm install -g pnpm

# Clonar el repositorio
git clone https://github.com/tu-org/rapidoapp.git
cd rapidoapp

# Instalar dependencias de todo el monorepo
pnpm install

# Copiar variables de entorno
cp .env.example .env

# Levantar servicios de infraestructura (PostgreSQL, Redis)
docker-compose up -d postgres redis

# Ejecutar migraciones y seed inicial
pnpm db:migrate
pnpm db:seed

# Levantar todos los servicios en modo desarrollo
pnpm dev
```

### URLs en Desarrollo

| Servicio | URL |
|----------|-----|
| API REST | http://localhost:3001 |
| API Docs (Swagger) | http://localhost:3001/docs |
| Web App (Cliente) | http://localhost:3000 |
| Admin Dashboard | http://localhost:3002 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| BullMQ Dashboard | http://localhost:3001/queues |

---

## Variables de Entorno

```bash
# Base de datos
DATABASE_URL="postgresql://rapidoapp:password@localhost:5432/rapidoapp"
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="tu-secreto-muy-seguro-minimo-32-chars"
JWT_REFRESH_SECRET="otro-secreto-para-refresh-tokens"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="30d"

# Pagos
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
MERCADOPAGO_ACCESS_TOKEN="APP_USR-..."

# Google Maps
GOOGLE_MAPS_API_KEY="AIza..."

# AWS
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="us-east-1"
AWS_S3_BUCKET="rapidoapp-media"
AWS_CLOUDFRONT_URL="https://cdn.rapidoapp.com"

# SMS (verificación OTP)
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+1..."

# Email
RESEND_API_KEY="re_..."
EMAIL_FROM="noreply@rapidoapp.com"

# Monitoreo
SENTRY_DSN="https://...@sentry.io/..."
DATADOG_API_KEY="..."

# App Config
NODE_ENV="development"
PORT=3001
API_URL="http://localhost:3001"
WEB_URL="http://localhost:3000"
COMMISSION_RATE=0.18
```

---

## Scripts Disponibles

```bash
# Desarrollo
pnpm dev              # Inicia todos los servicios en modo watch
pnpm dev:api          # Solo el API
pnpm dev:web          # Solo la web app
pnpm dev:admin        # Solo el admin

# Build
pnpm build            # Build de producción de todo el monorepo
pnpm build:api        # Build solo del API

# Base de datos
pnpm db:migrate       # Ejecuta migraciones pendientes
pnpm db:migrate:dev   # Crea nueva migración en desarrollo
pnpm db:seed          # Carga datos de prueba
pnpm db:studio        # Abre Prisma Studio (GUI de BD)
pnpm db:reset         # Resetea la BD completamente

# Testing
pnpm test             # Tests unitarios e integración
pnpm test:e2e         # Tests end-to-end
pnpm test:coverage    # Reporte de cobertura

# Calidad de código
pnpm lint             # ESLint en todo el monorepo
pnpm lint:fix         # Fix automático
pnpm typecheck        # TypeScript check sin compilar
pnpm format           # Prettier en todo el monorepo

# Infraestructura
pnpm docker:up        # Levanta infraestructura local
pnpm docker:down      # Baja contenedores
pnpm docker:logs      # Logs de contenedores
```

---

## Modelo de Datos (Entidades Principales)

```
User (cliente/repartidor/admin)
 └── Address (múltiples por usuario)
 └── Order (historial de pedidos)
 └── PaymentMethod (tarjetas guardadas)

Store (comercio/restaurante)
 └── StoreCategory
 └── Product
     └── ProductVariant
     └── ProductModifier
 └── StoreSchedule
 └── StoreCoverage (polígono PostGIS)

Order
 └── OrderItem
 └── OrderStatusHistory
 └── Payment
 └── Delivery
     └── DeliveryTracking (coordenadas GPS en tiempo real)

Rider (repartidor)
 └── RiderLocation (actualización continua)
 └── RiderStats
 └── RiderEarnings
```

---

## Flujo de un Pedido

```
1. Cliente abre app → ve comercios disponibles en su zona
2. Agrega productos al carrito
3. Selecciona dirección de entrega
4. Elige método de pago → checkout
5. Order creada en estado PENDING
6. Sistema notifica al comercio → CONFIRMED
7. Comercio acepta y prepara → PREPARING
8. Algoritmo asigna repartidor disponible más cercano
9. Repartidor va al comercio → PICKED_UP
10. Tracking en vivo activado cada 3 segundos
11. Repartidor entrega → DELIVERED
12. Cliente califica pedido y repartidor
13. Comisión descontada automáticamente al comercio
14. Repartidor recibe pago en wallet
```

---

## Métricas Objetivo (KPIs)

| Métrica | Objetivo |
|---------|----------|
| Tiempo de entrega promedio | < 25 minutos |
| Tiempo de asignación de repartidor | < 60 segundos |
| Uptime del API | 99.9% |
| Latencia P95 del API | < 200ms |
| Tasa de cancelación | < 5% |
| Rating promedio de entregas | > 4.5/5 |
| Take rate (comisión plataforma) | 18% |

---

## Roadmap

### Fase 1 — MVP (Mes 1-2)
- [ ] Auth completo (email + teléfono OTP)
- [ ] Onboarding de comercios
- [ ] Catálogo de productos
- [ ] Flujo de pedido completo
- [ ] Pago con tarjeta (Stripe)
- [ ] Tracking básico del repartidor
- [ ] App móvil iOS y Android

### Fase 2 — Crecimiento (Mes 3-4)
- [ ] MercadoPago + wallet interno
- [ ] Algoritmo de ruteo optimizado
- [ ] Sistema de reviews
- [ ] Notificaciones push
- [ ] Dashboard de métricas para comercios
- [ ] Programa de referidos

### Fase 3 — Escala (Mes 5-6)
- [ ] Despacho predictivo con ML
- [ ] Dark stores propias
- [ ] Suscripción premium (delivery gratis)
- [ ] API pública para integraciones
- [ ] Expansión multi-ciudad

---

## Contribuir

1. Crea un branch desde `main`: `git checkout -b feature/nombre-feature`
2. Commits en español con formato convencional: `feat: agregar módulo de pagos`
3. Abre Pull Request con descripción detallada
4. Requiere al menos 1 review aprobado para mergear
5. CI debe pasar (tests + lint + typecheck)

### Convención de Commits

```
feat:     Nueva funcionalidad
fix:      Corrección de bug
refactor: Refact