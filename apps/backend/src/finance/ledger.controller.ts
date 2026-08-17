import {
  Controller,
  Get,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';

@Controller('ledger')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class LedgerController {
  constructor(
    @Inject(LedgerService)
    private readonly ledgerService: LedgerService,
  ) {}

  @Get()
  async getLedger(@CurrentUser() user: JwtPayloadUser) {
    return this.ledgerService.getLedger(user);
  }
}
