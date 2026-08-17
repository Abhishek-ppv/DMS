import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { SalesEventService } from './sales-event.service';

@Module({
  controllers: [SalesController],
  providers: [SalesService, SalesEventService],
  exports: [SalesService, SalesEventService],
})
export class SalesModule {}
