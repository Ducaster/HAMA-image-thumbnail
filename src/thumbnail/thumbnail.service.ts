import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import * as sharp from 'sharp';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class ThumbnailService {
  private s3Original: S3Client;
  private s3Thumbnail: S3Client;
  private originalBucket: string;
  private thumbnailBucket: string;

  constructor() {
    this.s3Original = new S3Client({
      region: process.env.AWS_ORIGINAL_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'defaultAccessKeyId',
        secretAccessKey:
          process.env.AWS_SECRET_ACCESS_KEY ?? 'defaultSecretAccessKey',
      },
    });

    this.s3Thumbnail = new S3Client({
      region: process.env.AWS_THUMBNAIL_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'defaultAccessKeyId',
        secretAccessKey:
          process.env.AWS_SECRET_ACCESS_KEY ?? 'defaultSecretAccessKey',
      },
    });

    this.originalBucket =
      process.env.AWS_ORIGINAL_BUCKET_NAME ?? 'defaultOriginalBucketName';
    this.thumbnailBucket =
      process.env.AWS_THUMBNAIL_BUCKET_NAME ?? 'defaultThumbnailBucketName';
  }

  async generateThumbnail(imageUrl: string): Promise<string> {
    try {
      // 🔹 1️⃣ 원본 이미지 다운로드
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
      });

      const imageBuffer = Buffer.from(response.data);

      // 🔹 2️⃣ sharp로 썸네일 생성 (300x300, JPEG 압축)
      const thumbnailBuffer = await sharp(imageBuffer)
        .resize({ width: 300 })
        .jpeg({ quality: 80 })
        .toBuffer();

      // 🔹 3️⃣ S3에 업로드할 키 설정
      const imageKey = imageUrl.split('/').pop();
      const thumbnailKey = `thumbnails/${imageKey}`;

      // 🔹 4️⃣ 새 S3 버킷에 업로드
      await this.s3Thumbnail.send(
        new PutObjectCommand({
          Bucket: this.thumbnailBucket,
          Key: thumbnailKey,
          Body: thumbnailBuffer,
          ContentType: 'image/jpeg',
        }),
      );

      // 🔹 5️⃣ 새 썸네일 URL 반환
      return `https://${this.thumbnailBucket}.s3.${process.env.AWS_THUMBNAIL_REGION}.amazonaws.com/${thumbnailKey}`;
    } catch (error) {
      console.error(`❌ Thumbnail generation failed`, error);
      throw new HttpException(
        'Thumbnail generation failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
