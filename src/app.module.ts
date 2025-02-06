import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThumbnailModule } from './thumbnail/thumbnail.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ThumbnailModule],
})
export class AppModule {}
