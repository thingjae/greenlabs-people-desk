import {
  Body, CanActivate, Controller, ExecutionContext, Get, Injectable, Post, SetMetadata,
  UnauthorizedException, ForbiddenException, createParamDecorator, UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { one, q } from './db';

export type Role = 'PEOPLE' | 'INTERVIEWER' | 'EMPLOYEE';
export interface AuthUser { id: number; role: Role; name: string; employmentType?: string }

export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    if (req.path?.startsWith('/auth/login') || req.path === '/health') return true;
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) throw new UnauthorizedException('로그인이 필요합니다');
    try {
      req.user = await this.jwt.verifyAsync(token, { secret: process.env.JWT_SECRET });
    } catch {
      throw new UnauthorizedException('로그인이 만료되었습니다');
    }
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', [ctx.getHandler(), ctx.getClass()]);
    if (roles && !roles.includes(req.user.role)) throw new ForbiddenException('권한이 없습니다');
    return true;
  }
}

/** 면접관이 볼 수 있는 포지션 목록 (B1). 피플팀은 null = 전체 */
export async function allowedPositions(user: AuthUser): Promise<string[] | null> {
  if (user.role === 'PEOPLE') return null;
  if (user.role === 'INTERVIEWER') {
    const rows = await q(`SELECT DISTINCT position_id FROM position_interviewers WHERE user_id=$1`, [user.id]);
    return rows.map((r) => r.position_id);
  }
  return [];
}
export async function assertApplicantAccess(user: AuthUser, applicantId: string) {
  const a = await one(`SELECT * FROM applicants WHERE id=$1`, [applicantId]);
  if (!a) throw new ForbiddenException('지원자를 찾을 수 없습니다');
  const allowed = await allowedPositions(user);
  if (allowed && !allowed.includes(a.position_id)) throw new ForbiddenException('담당 포지션의 지원자만 볼 수 있습니다');
  return a;
}

@Controller('auth')
export class AuthController {
  constructor(private jwt: JwtService) {}
  @Post('login')
  async login(@Body() b: { email: string; password: string }) {
    const u = await one(`SELECT * FROM users WHERE email=$1`, [b.email]);
    if (!u || !(await bcrypt.compare(b.password || '', u.password_hash))) throw new UnauthorizedException('이메일 또는 비밀번호가 틀렸습니다');
    const payload: AuthUser = { id: u.id, role: u.role, name: u.name, employmentType: u.employment_type };
    return { token: await this.jwt.signAsync(payload, { secret: process.env.JWT_SECRET, expiresIn: '12h' }), user: { ...payload, title: u.title } };
  }
  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const u = await one(`SELECT id,name,email,role,employment_type,title FROM users WHERE id=$1`, [user.id]);
    const positions = await allowedPositions(user);
    return { ...u, positions };
  }
}
