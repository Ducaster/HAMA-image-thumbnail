import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import * as sharp from 'sharp';
import axios from 'axios';

@Injectable()
export class ThumbnailService implements OnModuleInit {
  private sqsClient = new SQSClient({
    region: process.env.AWS_ORIGINAL_REGION,
  });
  private s3Client = new S3Client({ region: process.env.AWS_ORIGINAL_REGION });

  async onModuleInit() {
    console.log('🔄 Starting SQS message processing...');
    this.startMessageProcessing();
  }

  private async startMessageProcessing() {
    while (true) {
      try {
        const { Messages } = await this.sqsClient.send(
          new ReceiveMessageCommand({
            QueueUrl: process.env.SQS_QUEUE_URL,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 20,
          }),
        );

        if (!Messages || Messages.length === 0) continue;

        for (const message of Messages) {
          if (!message.Body) continue;

          const { imageKey } = JSON.parse(message.Body);

          // S3에서 원본 이미지 가져오기
          const { Body } = await this.s3Client.send(
            new GetObjectCommand({
              Bucket: process.env.AWS_ORIGINAL_BUCKET_NAME,
              Key: imageKey,
            }),
          );

          if (!Body) continue;

          // 스트림을 버퍼로 변환
          const chunks: Uint8Array[] = [];
          for await (const chunk of Body as unknown as AsyncIterable<Uint8Array>) {
            chunks.push(chunk);
          }
          const imageBuffer = Buffer.concat(chunks);

          // 썸네일 생성
          const thumbnailBuffer = await sharp(imageBuffer)
            .resize(200, 200)
            .toBuffer();

          // 썸네일 S3에 업로드
          await this.s3Client.send(
            new PutObjectCommand({
              Bucket: process.env.AWS_THUMBNAIL_BUCKET_NAME,
              Key: `thumbnails/${imageKey}`,
              Body: thumbnailBuffer,
              ContentType: 'image/jpeg',
            }),
          );

          // 처리 완료된 메시지 삭제
          await this.sqsClient.send(
            new DeleteMessageCommand({
              QueueUrl: process.env.SQS_QUEUE_URL,
              ReceiptHandle: message.ReceiptHandle,
            }),
          );

          console.log(`✅ Successfully processed thumbnail for: ${imageKey}`);
        }
      } catch (error) {
        console.error('Error processing message:', error);
        // 에러가 발생해도 계속 실행
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  async generateThumbnail(imageUrl: string): Promise<string> {
    try {
      // 이미지 다운로드
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
      });
      const imageBuffer = Buffer.from(response.data);

      // 썸네일 생성
      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(200, 200)
        .toBuffer();

      // 파일명 생성 (URL에서 유니크한 이름 추출)
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

      // S3에 업로드
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_THUMBNAIL_BUCKET_NAME,
          Key: `thumbnails/${fileName}`,
          Body: thumbnailBuffer,
          ContentType: 'image/jpeg',
        }),
      );

      // 썸네일 URL 반환
      return `https://${process.env.AWS_THUMBNAIL_BUCKET_NAME}.s3.${process.env.AWS_THUMBNAIL_REGION}.amazonaws.com/thumbnails/${fileName}`;
    } catch (error) {
      console.error('썸네일 생성 중 에러:', error);
      throw error;
    }
  }
}
