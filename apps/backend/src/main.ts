import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { resolveCorsOrigin } from './common/cors-origin';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  // Security headers. Uploaded images are embedded by the SPA from another
  // origin, so resources must stay loadable cross-origin.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.enableCors({
    origin: resolveCorsOrigin(process.env),
    // Lets the SPA read the file name of downloads (CSV/PDF exports).
    exposedHeaders: ['Content-Disposition'],
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
