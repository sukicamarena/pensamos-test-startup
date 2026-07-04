// Punto de entrada principal de la aplicación FastRappi
// Inicializa el servidor NestJS con todas las configuraciones necesarias

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import * as compression from 'compression';
import * as helmet from 'helmet';
import { json, urlencoded } from 'express';

async function bootstrap(): Promise<void> {
  const logger = new Logger('FastRappi::Bootstrap');

  // Crear la instancia de la aplicación NestJS
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');

  // Prefijo global para todas las rutas
  app.setGlobalPrefix(apiPrefix);

  // Seguridad HTTP con helmet
  app.use(
    (helmet as unknown as () => ReturnType<typeof helmet.default>)(),
  );

  // Compresión de respuestas para mejorar rendimiento
  app.use(compression());

  // Límites de tamaño para peticiones
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Configuración de CORS para el frontend y apps móviles
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGINS', '*').split(','),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-Device-Id',
      'X-App-Version',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
    credentials: true,
    maxAge: 86400, // 24 horas en segundos
  });

  // Validación global de DTOs con class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,             // Elimina propiedades no definidas en el DTO
      forbidNonWhitelisted: true,  // Lanza error si hay propiedades extra
      transform: true,             // Transforma automáticamente los tipos
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: nodeEnv === 'production',
    }),
  );

  // Documentación Swagger solo en entornos no productivos
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('FastRappi API')
      .setDescription(
        'API de FastRappi — Plataforma de delivery ultrarrápido. ' +
        'Conecta usuarios con tiendas y repartidores en tiempo real.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Token de autenticación JWT',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('auth', 'Autenticación y autorización')
      .addTag('users', 'Gestión de usuarios y perfiles')
      .addTag('stores', 'Tiendas y restaurantes disponibles')
      .addTag('products', 'Catálogo de productos')
      .addTag('orders', 'Creación y seguimiento de pedidos')
      .addTag('delivery', 'Gestión de repartidores y rutas')
      .addTag('payments', 'Procesamiento de pagos')
      .addTag('tracking', 'Rastreo en tiempo real')
      .addTag('promotions', 'Promociones y descuentos')
      .addTag('health', 'Estado del sistema')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });

    logger.log(`📚 Documentación disponible en: http://localhost:${port}/docs`);
  }

  // Iniciar el servidor HTTP
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 FastRappi corriendo en: http://localhost:${port}/${apiPrefix}`);
  logger.log(`🌍 Entorno: ${nodeEnv.toUpperCase()}`);
  logger.log(`⚡ Listo para recibir pedidos en tiempo récord`);

  // Manejo graceful de señales de apagado
  const shutdown = async (signal: string): Promise<void> => {
    logger.warn(`⚠️  Señal ${signal} recibida. Cerrando servidor...`);
    await app.close();
    logger.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Manejo de promesas no capturadas
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('❌ Promesa rechazada no manejada:', reason);
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error('❌ Excepción no capturada:', error.message, error.stack);
    process.exit(1);
  });
}

// Ejecutar el bootstrap
bootstrap().catch((error: Error) => {
  const logger = new Logger('FastRappi::Bootstrap');
  logger.error('❌ Error crítico al iniciar la aplicación:', error.message);
  logger.error(error.stack);
  process.exit(1);
});