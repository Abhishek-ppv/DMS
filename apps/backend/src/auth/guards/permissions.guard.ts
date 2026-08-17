import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, RequiredPermission } from '../decorators/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly reflector: Reflector;

  constructor(
    @Inject(Reflector) reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {
    this.reflector = reflector || new Reflector();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<RequiredPermission>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: User authentication context missing');
    }

    // Dynamic database query against RolePermission table
    const permissionKey = `${user.role}:${requiredPermission.resource}:${requiredPermission.action}`;

    const hasPermission = await this.prisma.rolePermission.findFirst({
      where: {
        OR: [
          { permissionKey },
          {
            role: { name: user.role },
            resource: requiredPermission.resource,
            action: requiredPermission.action,
          },
        ],
      },
    });

    if (!hasPermission) {
      throw new ForbiddenException(
        `Access denied: Missing database permission '${requiredPermission.resource}:${requiredPermission.action}' for role '${user.role}'`,
      );
    }

    return true;
  }
}
