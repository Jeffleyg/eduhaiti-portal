import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
  });
  // Student hand-ins stored before assignment files became private must not
  // stay public: they are served only by GET /api/assignments/.../file.
  app.use('/uploads', (req: any, res: any, next: () => void) => {
    if (/^\/submission-/i.test(req.path)) {
      res.status(404).end();
      return;
    }
    next();
  });
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });
  await app.listen(process.env.APP_PORT ?? 3000);
}
bootstrap();
