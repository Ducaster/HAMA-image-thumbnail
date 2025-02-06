import { Module } from '@nestjs/common';
import { ThumbnailService } from './thumbnail.service';
import { ThumbnailController } from './thumbnail.controller';

@Module({
  providers: [ThumbnailService],
  controllers: [ThumbnailController],
})
export class ThumbnailModule {}
