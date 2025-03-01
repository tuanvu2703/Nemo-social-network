import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer, logLevel } from 'kafkajs';
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
@Injectable()
export class ProducerService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;

  constructor() {
    if (!process.env.KAFKA_BROKER || !process.env.KAFKA_USERNAME || !process.env.KAFKA_PASSWORD) {
      throw new Error('❌ Kafka environment variables are missing!');
    }

    this.kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'nestjs-kafka-producer',
      brokers: [process.env.KAFKA_BROKER],
      ssl: true,
      sasl: {
        mechanism: 'plain',
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD,
      },
      connectionTimeout: 10000, // Tăng timeout lên 10s
      logLevel: logLevel.INFO,
    });

    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    try {
        console.log('🔄 Connecting Kafka Producer...');
        await this.producer.connect();
        console.log('✅ Kafka Producer connected!');
    } catch (error) {
        console.error('❌ Kafka Producer connection failed:', error);
        setTimeout(() => this.onModuleInit(), 5000); // Retry sau 5 giây
    }
}


  async onModuleDestroy() {
    await this.producer.disconnect();
  }
  //người gửi 
  // gửi tới đâu 
  // nội dung là gì
  async sendMessage(topic: string, message: any) {
    try {
      // Chuyển ObjectId thành string để gửi qua Kafka
      if (message.userId instanceof Types.ObjectId) {
        message.userId = message.userId.toString();
      }
      if (message.ownerId instanceof Types.ObjectId) {
        message.ownerId = message.ownerId.toString();
      }
  
      await this.producer.send({
        topic,
        messages: [
          {
            key: message.userId || randomUUID(), // Dùng key để Kafka đảm bảo thứ tự
            value: JSON.stringify(message),
          },
        ],
      });
      console.log(`📨 Message sent to "${topic}":`, message);
    } catch (error) {
      console.error('❌ Kafka sendMessage error:', error);
    }
  }
  
}
