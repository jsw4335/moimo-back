import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, JwtFromRequestFunction } from 'passport-jwt';

interface JwtPayload {
  id: number;
  username: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtFromRequest: JwtFromRequestFunction =
      ExtractJwt.fromAuthHeaderAsBearerToken();
    super({
      jwtFromRequest, // Authorization 헤더에서 토큰 추출
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'SECRET_KEY', // 환경변수로 관리 권장
    });
  }

  validate(payload: JwtPayload): { id: number; username: string } {
    // payload는 JWT에 담긴 데이터 (예: { id: 1, username: 'youngjae' })
    return { id: payload.id, username: payload.username };
  }
}
