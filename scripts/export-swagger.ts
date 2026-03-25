import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function exportSwagger(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });

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
            authorizationUrl: `${process.env.API_URL || 'http://localhost:3000'}/auth/google`,
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

  const outputDir = join(process.cwd(), 'docs');
  const outputPath = join(outputDir, 'openapi.json');

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');

  await app.close();

  console.log(`OpenAPI spec exported to: ${outputPath}`);
}

void exportSwagger();
