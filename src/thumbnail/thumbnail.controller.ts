import { Controller, Post, Body } from '@nestjs/common';
import { ThumbnailService } from './thumbnail.service';

@Controller('thumbnail')
export class ThumbnailController {
  constructor(private readonly thumbnailService: ThumbnailService) {}

  @Post()
  async generateThumbnails(@Body('imageUrls') imageUrls: string[]) {
    console.log(`🔹 Received image URLs:`, imageUrls);

    const thumbnailUrls = await Promise.all(
      imageUrls.map((url) => this.thumbnailService.generateThumbnail(url)),
    );

    return { thumbnails: thumbnailUrls };
  }
}
