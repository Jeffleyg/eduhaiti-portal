import { ValidationPipe } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix("api")
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  )
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? "*",
  })
  await app.listen(process.env.APP_PORT ?? 3000)
}
bootstrap();
