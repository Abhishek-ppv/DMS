import { Controller, Post, Get, Patch, Body, Param, UseGuards, Inject } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { DirectDealerOnboardDto } from './dto/direct-dealer-onboard.dto';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

@Controller('partners')
@UseGuards(RolesGuard, PermissionsGuard)
export class PartnersController {
  constructor(
    @Inject(PartnersService)
    private readonly partnersService: PartnersService,
  ) {}

  @Post()
  @RequirePermission('PARTNER', 'CREATE')
  async create(@CurrentUser() user: JwtPayloadUser, @Body() dto: CreatePartnerDto) {
    return this.partnersService.createPartner(user, dto);
  }

  @Post('direct-dealer/onboard')
  @RequirePermission('PARTNER', 'CREATE')
  async onboardDirectDealer(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: DirectDealerOnboardDto,
  ) {
    return this.partnersService.onboardDirectDealer(user, dto);
  }

  @Get()
  @RequirePermission('PARTNER', 'READ')
  async findAll(@CurrentUser() user: JwtPayloadUser) {
    return this.partnersService.listPartners(user);
  }

  @Get(':id')
  @RequirePermission('PARTNER', 'READ')
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.partnersService.getPartnerById(id, user);
  }

  @Get(':id/descendants')
  @RequirePermission('PARTNER', 'READ')
  async findDescendants(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.partnersService.getDescendants(id, user);
  }

  @Get(':id/ancestors')
  @RequirePermission('PARTNER', 'READ')
  async findAncestors(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.partnersService.getAncestors(id, user);
  }

  @Patch(':id')
  @RequirePermission('PARTNER', 'UPDATE')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: UpdatePartnerDto,
  ) {
    return this.partnersService.updatePartner(id, user, dto);
  }
}

