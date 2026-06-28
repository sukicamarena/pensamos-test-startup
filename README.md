# PanduneSiosss 💕

> Red social para parejas — porque hasta el amor necesita un recordatorio

---

## ¿Qué es esto?

**PanduneSiosss** es una aplicación móvil y web donde las parejas se conectan en un espacio privado compartido. Cuando hay una pelea o uno de los dos se siente molesto, puede presionar el botón **"Estoy Enojado/a"** y el sistema automáticamente envía a ambos una selección de fotos, mensajes y recuerdos compartidos para recordarles por qué se aman.

Sin terapeutas. Sin drama en redes. Solo ustedes dos y sus mejores momentos.

---

## El problema que resuelve

Las parejas pelean. Es normal. Pero en el calor del momento se olvidan de todo lo bueno que han construido juntos. PanduneSiosss actúa como ese amigo sabio que en el peor momento te dice: *"oye, ¿recuerdas esto?"*

---

## Cómo funciona

```
1. Pareja crea su espacio privado compartido
2. Suben fotos, mensajes, fechas especiales, notas de voz
3. Cuando alguno está enojado → presiona el botón rojo
4. El sistema les manda a LOS DOS notificaciones con recuerdos
5. El hielo se rompe. La conversación vuelve a empezar desde el amor.
```

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend Web | Next.js 14 + TypeScript |
| Mobile | React Native + Expo |
| Backend/API | Node.js + Express + TypeScript |
| Base de datos | PostgreSQL + Prisma ORM |
| Almacenamiento | AWS S3 (fotos, audios) |
| Notificaciones | Firebase Cloud Messaging |
| Autenticación | JWT + Refresh Tokens |
| Cache | Redis |
| Deploy | Railway (backend) + Vercel (frontend) |

---

## Estructura del proyecto

```
pandunesiosss/
├── apps/
│   ├── web/                    # Next.js — interfaz web
│   │   ├── src/
│   │   │   ├── app/            # App Router de Next.js 14
│   │   │   ├── components/     # Componentes reutilizables
│   │   │   ├── hooks/          # Custom hooks
│   │   │   ├── lib/            # Utilidades y configuración
│   │   │   └── types/          # Tipos TypeScript compartidos
│   │   └── package.json
│   │
│   └── mobile/                 # React Native + Expo
│       ├── src/
│       │   ├── screens/        # Pantallas de la app
│       │   ├── components/     # Componentes nativos
│       │   ├── navigation/     # React Navigation
│       │   └── services/       # Llamadas a la API
│       └── package.json
│
├── packages/
│   ├── api/                    # Backend Express + TypeScript
│   │   ├── src/
│   │   │   ├── routes/         # Endpoints REST
│   │   │   ├── controllers/    # Lógica de controladores
│   │   │   ├── services/       # Lógica de negocio
│   │   │   ├── middleware/     # Auth, validación, errores
│   │   │   ├── jobs/           # Tareas programadas (recordatorios)
│   │   │   └── lib/            # Prisma, Redis, S3, FCM
│   │   └── package.json
│   │
│   └── database/               # Prisma schema + migraciones
│       ├── prisma/
│       │   ├── schema.prisma   # Modelos de datos
│       │   └── migrations/     # Historial de migraciones
│       └── package.json
│
├── docker-compose.yml          # PostgreSQL + Redis local
├── turbo.json                  # Turborepo config
├── package.json                # Workspace raíz
└── README.md
```

---

## Entidades principales del modelo de datos

```
Couple (pareja)
  ├── User A ──────────┐
  ├── User B ──────────┤ → comparten un CoupleSpace
  └── invite code      │
                       ▼
               CoupleSpace
                  ├── Memories (fotos, notas, fechas)
                  ├── AngryEvents (historial del botón)
                  └── LoveMessages (mensajes personalizados)
```

---

## Flujo del botón "Estoy Enojado/a"

```
Usuario presiona botón
        │
        ▼
POST /api/couples/:coupleId/angry-event
        │
        ▼
AngryEventService.trigger()
        │
        ├── Registra el evento en BD
        ├── Selecciona 5 recuerdos aleatorios del CoupleSpace
        ├── Arma el payload de notificación
        └── Envía push notification a LOS DOS vía FCM
                │
                ▼
        Ambos reciben en su pantalla:
        "💕 [Nombre] te necesita. Recuerden esto..."
        [foto 1] [mensaje 2] [fecha especial 3]...
```

---

## Variables de entorno requeridas

Crea un archivo `.env` en `packages/api/` con:

```env
# Base de datos
DATABASE_URL="postgresql://user:password@localhost:5432/pandunesiosss"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="tu-secreto-super-seguro-minimo-32-chars"
JWT_REFRESH_SECRET="otro-secreto-para-refresh-tokens"

# AWS S3 — almacenamiento de fotos y audios
AWS_ACCESS_KEY_ID="tu-access-key"
AWS_SECRET_ACCESS_KEY="tu-secret-key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="pandunesiosss-media"

# Firebase — notificaciones push
FIREBASE_PROJECT_ID="pandunesiosss"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL="firebase-adminsdk@pandunesiosss.iam.gserviceaccount.com"

# App
NODE_ENV="development"
PORT=3001
FRONTEND_URL="http://localhost:3000"
```

---

## Instalación y desarrollo local

### Prerrequisitos

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker y Docker Compose

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/pandunesiosss/app.git
cd pandunesiosss

# 2. Instalar dependencias (monorepo con pnpm workspaces)
pnpm install

# 3. Levantar PostgreSQL y Redis con Docker
docker-compose up -d

# 4. Copiar variables de entorno
cp packages/api/.env.example packages/api/.env
# Editar .env con tus credenciales reales

# 5. Ejecutar migraciones de base de datos
pnpm db:migrate

# 6. Poblar con datos de prueba (opcional)
pnpm db:seed

# 7. Iniciar todos los servicios en paralelo
pnpm dev
```

Después de esto tendrás corriendo:

- 🌐 Web → http://localhost:3000
- 🔌 API → http://localhost:3001
- 📱 Mobile → Expo DevTools en http://localhost:19002

---

## Scripts disponibles

```bash
# Desarrollo
pnpm dev              # Inicia web + api + mobile en paralelo
pnpm dev:web          # Solo el frontend web
pnpm dev:api          # Solo el backend
pnpm dev:mobile       # Solo la app móvil

# Base de datos
pnpm db:migrate       # Ejecuta migraciones pendientes
pnpm db:migrate:dev   # Crea nueva migración en desarrollo
pnpm db:seed          # Puebla con datos de prueba
pnpm db:studio        # Abre Prisma Studio (GUI de la BD)
pnpm db:reset         # Reset completo de la BD (solo desarrollo)

# Build
pnpm build            # Build de producción de todos los paquetes
pnpm build:web        # Solo build del frontend
pnpm build:api        # Solo build del backend

# Calidad de código
pnpm lint             # ESLint en todo el monorepo
pnpm lint:fix         # Fix automático de lint
pnpm typecheck        # Verificación de tipos TypeScript
pnpm test             # Ejecuta todos los tests
pnpm test:watch       # Tests en modo watch
pnpm test:coverage    # Tests con reporte de cobertura

# Producción
pnpm start:api        # Inicia el backend compilado
pnpm start:web        # Inicia el frontend compilado
```

---

## Endpoints principales de la API

```
AUTH
  POST   /api/auth/register          # Crear cuenta
  POST   /api/auth/login             # Iniciar sesión
  POST   /api/auth/refresh           # Renovar access token
  POST   /api/auth/logout            # Cerrar sesión

PAREJAS
  POST   /api/couples/create         # Crear espacio de pareja
  POST   /api/couples/join           # Unirse con código de invitación
  GET    /api/couples/:id            # Obtener info de la pareja
  DELETE /api/couples/:id/leave      # Salir del espacio compartido

RECUERDOS
  GET    /api/couples/:id/memories          # Listar recuerdos
  POST   /api/couples/:id/memories          # Subir nuevo recuerdo
  PUT    /api/couples/:id/memories/:memId   # Editar recuerdo
  DELETE /api/couples/:id/memories/:memId   # Eliminar recuerdo

EL BOTÓN ❤️‍🔥
  POST   /api/couples/:id/angry             # PRESIONAR EL BOTÓN
  GET    /api/couples/:id/angry/history     # Historial de eventos
  POST   /api/couples/:id/angry/:eventId/resolve  # Marcar como resuelto

MENSAJES DE AMOR
  GET    /api/couples/:id/love-messages     # Ver mensajes configurados
  POST   /api/couples/:id/love-messages     # Agregar mensaje personalizado
  DELETE /api/couples/:id/love-messages/:msgId # Eliminar mensaje
```

---

## Filosofía del producto

**PanduneSiosss no es una app de mensajería.** No tiene chat. No tiene feed. No tiene likes ni comentarios públicos.

Es un espacio íntimo y privado. Los únicos que lo ven son los dos. El objetivo no es añadir más ruido digital a la relación sino exactamente lo contrario: en el momento de más tensión, hacer que el ruido desaparezca y solo queden los recuerdos que importan.

El botón no manda mensajes de texto. No abre una conversación. Solo envía recuerdos. El resto lo hacen ellos.

---

## Roadmap

### v1.0 — MVP (en construcción)
- [x] Estructura del proyecto y monorepo
- [ ] Autenticación y creación de parejas
- [ ] Subida de fotos y mensajes al espacio compartido
- [ ] El botón "Estoy Enojado/a" con notificaciones push
- [ ] App móvil funcional (iOS + Android)
- [ ] Web app funcional

### v1.1 — Mejoras post-lanzamiento
- [ ] Notas de voz como recuerdos
- [ ] Fechas especiales con recordatorios automáticos (aniversarios, etc.)
- [ ] Estadísticas privadas: "llevan 47 días sin pelear" 🎉
- [ ] Modo "sorpresa": programa recuerdos para enviar en momentos random

### v2.0 — Crecimiento
- [ ] Suscripción premium (más almacenamiento, más tipos de recuerdos)
- [ ] Integración con calendario para importar fechas especiales
- [ ] Widgets para pantalla de inicio del celular
- [ ] Apple Watch / Wear OS support

---

## Contribuir

Por ahora este es un proyecto privado de **pandunesiosss**. Si llegaste aquí y quieres unirte al equipo, escríbenos.

---

## Licencia

Copyright © 2024 PanduneSiosss. Todos los derechos reservados.

---

*Hecho con 💕 para las parejas que pelean bonito*