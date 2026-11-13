import 'reflect-metadata';
import './env';
import { Module, Controller, Get } from '@nestjs/common';
import { NestFactory, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController, AuthGuard } from './auth';
import { ApplicantsController } from './applicants.controller';
import { HiringController } from './hiring.controller';
import { SupportController } from './support.controller';
import { seed } from './seed';
import { aiEnabled } from './ai';

@Controller()
class HealthController {
  @Get('health') health() { return { ok: true, ai: aiEnabled() }; }
}

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET || 'dev-secret' })],
  controllers: [HealthController, AuthController, ApplicantsController, HiringController, SupportController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
class AppModule {}

async function bootstrap() {
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'dev-secret';
  await seed(false); // 테이블 생성 + 비어 있으면 시드
  const fe = (process.env.FRONTEND_URL || '*').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
  // '*'는 모든 주소 허용. 그 외에는 적힌 주소만 허용 (끝의 / 는 무시)
  const app = await NestFactory.create(AppModule, { cors: { origin: fe.includes('*') ? true : fe, credentials: true } });
  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`backend on :${port} (AI ${aiEnabled() ? 'on' : 'off'})`);
}
bootstrap();
