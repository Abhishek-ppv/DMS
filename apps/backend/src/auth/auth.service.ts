import {
  Inject,
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { RoleType, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService)
    private prisma: PrismaService,
    @Inject(JwtService)
    private jwtService: JwtService,
    @Inject(ConfigService)
    private configService: ConfigService,
  ) {}

  /**
   * Register a new user
   */
  async register(dto: RegisterDto) {
    // 1. Check duplicate email
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // 2. Determine target role (Prevent self-registration as ADMIN or SUPPLIER)
    let requestedRole: RoleType = dto.role || RoleType.DEALER;
    const isPrivileged = (requestedRole as string) === RoleType.ADMIN || (requestedRole as string) === RoleType.SUPPLIER;

    if (isPrivileged) {
      this.logger.warn(`Public registration attempt with privileged role '${requestedRole}' blocked for ${dto.email}`);
      requestedRole = RoleType.DEALER;
    }

    const roleRecord = await this.prisma.role.findUnique({
      where: { name: requestedRole },
    });

    if (!roleRecord) {
      throw new BadRequestException(`Role '${requestedRole}' does not exist`);
    }

    // 3. Partner Association & Scoping Validation
    let partnerId: string | null = dto.partnerId || null;

    if (!partnerId && !isPrivileged) {
      // If no partnerId supplied, default to existing seeded dealer or supplier partner
      const defaultPartner = await this.prisma.partner.findFirst({
        where: { type: requestedRole as any },
      });
      partnerId = defaultPartner ? defaultPartner.id : null;
    }

    if (partnerId) {
      const partnerExists = await this.prisma.partner.findUnique({
        where: { id: partnerId },
      });
      if (!partnerExists) {
        throw new BadRequestException(`Partner with ID '${partnerId}' does not exist`);
      }
    }

    // 4. Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // 5. Create User
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        roleId: roleRecord.id,
        partnerId,
        status: UserStatus.ACTIVE,
      },
      include: {
        role: true,
        partner: true,
      },
    });

    // 6. Generate Tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role.name, user.role.id, user.partnerId);

    return {
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
        partnerId: user.partnerId,
        status: user.status,
      },
      ...tokens,
    };
  }

  /**
   * Login user with email & password
   */
  async login(dto: LoginDto) {
    // 1. Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        role: true,
        partner: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 2. Verify password hash
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 3. Verify user account status
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(`User account is ${user.status.toLowerCase()}. Access denied.`);
    }

    // 4. Generate Tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role.name, user.role.id, user.partnerId);

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
        partnerId: user.partnerId,
        status: user.status,
      },
      ...tokens,
    };
  }

  /**
   * Refresh Access Token
   */
  async refresh(dto: RefreshDto) {
    try {
      const refreshSecret =
        this.configService.get<string>('REFRESH_TOKEN_SECRET') ||
        'super_secret_refresh_token_key_change_in_production';

      const payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: refreshSecret,
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { role: true },
      });

      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('User account is invalid or inactive');
      }

      const accessToken = await this.jwtService.signAsync(
        {
          sub: user.id,
          email: user.email,
          role: user.role.name,
          roleId: user.role.id,
          partnerId: user.partnerId,
        },
        {
          secret:
            this.configService.get<string>('JWT_SECRET') ||
            'super_secret_jwt_key_change_in_production',
          expiresIn: (this.configService.get<string>('JWT_EXPIRATION') || '86400s') as any,
        },
      );

      return { accessToken };
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Helper: Generate Access & Refresh tokens
   */
  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    roleId: string,
    partnerId: string | null,
  ) {
    const jwtSecret =
      this.configService.get<string>('JWT_SECRET') ||
      'super_secret_jwt_key_change_in_production';
    const jwtExpiration = (this.configService.get<string>('JWT_EXPIRATION') || '86400s') as any;

    const refreshSecret =
      this.configService.get<string>('REFRESH_TOKEN_SECRET') ||
      'super_secret_refresh_token_key_change_in_production';
    const refreshExpiration = (this.configService.get<string>('REFRESH_TOKEN_EXPIRATION') || '604800s') as any;

    const payload = { sub: userId, email, role, roleId, partnerId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        expiresIn: jwtExpiration,
      }),
      this.jwtService.signAsync(
        { ...payload, type: 'refresh' },
        {
          secret: refreshSecret,
          expiresIn: refreshExpiration,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * CRITICAL FEATURE: Partner-Level Query Scoping Helper
   * Enforces data isolation strictly derived from request.user.partnerId
   */
  getPartnerDataScope(user: { role: string; partnerId: string | null }) {
    if ((user.role as string) === RoleType.ADMIN || (user.role as string) === RoleType.SUPPLIER) {
      return {}; // Full access across partner orgs
    }

    if (!user.partnerId) {
      throw new ForbiddenException('User is not associated with an authorized partner organization');
    }

    return { partnerId: user.partnerId };
  }
}
