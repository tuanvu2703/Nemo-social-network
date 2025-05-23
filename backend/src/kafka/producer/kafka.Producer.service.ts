import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Kafka, Producer, logLevel } from 'kafkajs';
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';

@Injectable()
export class ProducerService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;
  private readonly logger = new Logger(ProducerService.name);
  constructor() {
    if (!process.env.KAFKA_BROKER) {
      throw new Error('😵 Kafka environment variables are missing!');
    }

    this.kafka = new Kafka({
      brokers: [process.env.KAFKA_BROKER], 
      clientId: process.env.KAFKA_CLIENT_ID || 'my-app',
      logLevel: logLevel.INFO,
      retry: {
        initialRetryTime: 300,
        retries: 10,
      },
    });

    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    try {
      this.logger.log('😴 Connecting Kafka Producer...');
      await this.producer.connect();
      this.logger.log('😎 Kafka Producer connected!');
    } catch (error) {
      this.logger.error('😵 Kafka Producer connection failed:', error);
      setTimeout(() => this.onModuleInit(), 5000);
    }
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async sendMessage(topic: string, message: any) {
    try {
      if (message.userId instanceof Types.ObjectId) {
        message.userId = message.userId.toString();
      }
      if (message.ownerId instanceof Types.ObjectId) {
        message.ownerId = message.ownerId.toString();
      }

      const result = await this.producer.send({
        topic,
        messages: [
          {
            key: message.userId || randomUUID(),
            value: JSON.stringify(message),
          },
        ],
      });
      this.logger.log(`📨 Message sent to "${topic}": ${JSON.stringify(message)}`);

      this.logger.log(`📨 Message sent to "${topic}":`, message);
    } catch (error) {
      this.logger.error(`Failed to send message to ${topic}: ${error.message}`, error.stack);
    }
  }
}

// import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// import { Kafka, Producer, logLevel } from 'kafkajs';
// import { randomUUID } from 'crypto';
// import { Types } from 'mongoose';
// @Injectable()
// export class ProducerService implements OnModuleInit, OnModuleDestroy {
//   private kafka: Kafka;
//   private producer: Producer;

//   constructor() {
//     if (!process.env.REDPANDA_BROKER || !process.env.REDPANDA_USERNAME || !process.env.REDPANDA_PASSWORD) {
//       throw new Error('❌ Kafka environment variables are missing!');
//     }

//     this.kafka = new Kafka({ 
//       brokers: [process.env.REDPANDA_BROKER],
//       clientId: process.env.REDPANDA_CLIENT_ID,
//       ssl: true,
//       sasl: {
//         mechanism: "scram-sha-256",
//         username: process.env.REDPANDA_USERNAME,
//         password: process.env.REDPANDA_PASSWORD,
//       },
//       connectionTimeout: 10000, 
//       logLevel: logLevel.INFO,
//     });

//     this.producer = this.kafka.producer();
//   }

//   async onModuleInit() {
//     try {
//         console.log('🔄 Connecting Kafka Producer...');
//         await this.producer.connect();
//         console.log('✅ Kafka Producer connected!');
//     } catch (error) {
//         console.error('❌ Kafka Producer connection failed:', error);
//         setTimeout(() => this.onModuleInit(), 5000); // Retry sau 5 giây
//     }
// }


//   async onModuleDestroy() {
//     await this.producer.disconnect();
//   }
//   //người gửi 
//   // gửi tới đâu 
//   // nội dung là gì
//   async sendMessage(topic: string, message: any) {
//     try {

//       if (message.userId instanceof Types.ObjectId) {
//         message.userId = message.userId.toString();
//       }
//       if (message.ownerId instanceof Types.ObjectId) {
//         message.ownerId = message.ownerId.toString();
//       }
  
//       await this.producer.send({
//         topic,
//         messages: [
//           {
//             key: message.userId || randomUUID(), 
//             value: JSON.stringify(message),
//           },
//         ],
//       });
//       console.log(`📨 Message sent to "${topic}":`, message);
//     } catch (error) {
//       console.error('❌ Kafka sendMessage error:', error);
//     }
//   }
  
// }
