import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  // Swagger / OpenAPI setup
  const config = new DocumentBuilder()
    .setTitle('nestjs-starter API')
    .setDescription('nestjs-starter API documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT',
    )
    .addOAuth2(
      {
        type: 'oauth2',
        flows: {
          implicit: {
            authorizationUrl: `${process.env.API_URL || 'http://localhost:3000'}/api/auth/google`,
            scopes: {
              'email profile': 'Get email and profile info',
            },
          },
        },
      },
      'google-oauth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      initOAuth: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        usePkceWithAuthorizationCodeGrant: true,
      },
    },
  });

  await app.init();
  return app.getHttpServer();
}

// For local development
if (process.env.NODE_ENV !== 'production') {
  bootstrap().then(server => {
    const port = process.env.PORT ?? 3000;
    server.listen(port);
    console.log(`Application is running on: http://localhost:${port}`);
  });
}

// Export the handler for Vercel
export default async (req: any, res: any) => {
  const server = await bootstrap();
  return server(req, res);
};
