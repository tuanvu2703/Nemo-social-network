import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { AuththenticationSoket } from '../user/guard/authSocket.guard';
import { User } from '../user/schemas/user.schemas';
import { CurrentUser } from 'src/user/decorator/currentUser.decorator';
import { Types } from 'mongoose';

@WebSocketGateway({

  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = ["http://localhost:3000", "https://zafacook.netlify.app"];

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization"],
  },
  
})
export class EventGeteWay implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private activeUsers = new Map<string, Set <string>>(); 

  constructor(
    private readonly authenticationSoket: AuththenticationSoket,
  ) {}

  afterInit(server: Server) {
    console.log('WebSocket server initialized');
  }

  async handleConnection(client: Socket) {

  
    try {
      const user = await this.authenticationSoket.authenticate(client);
      if (!user) {
        throw new WsException('Unauthorized');
      }

      const userId = user._id.toString();
  

      if (!this.activeUsers.has(userId)) {
        this.activeUsers.set(userId, new Set());
      }
  
      // Thêm clientId vào Set của userId
      this.activeUsers.get(userId).add(client.id);
  
      // Ensure client joins a room matching notification format (e.g., user:userId)
      client.join(`user:${userId}`);
  
    } catch (error) {
      console.error('Error during connection:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {

  
    // Tìm userId mà client thuộc về
    const userId = Array.from(this.activeUsers.entries()).find(([_, clientIds]) =>
      clientIds.has(client.id)
    )?.[0];
  
    if (userId) {
      const userSockets = this.activeUsers.get(userId);
  
      if (userSockets) {
        // Xóa clientId khỏi Set
        userSockets.delete(client.id);
  
        // Nếu Set rỗng, xóa userId khỏi Map
        if (userSockets.size === 0) {
          this.activeUsers.delete(userId);
        }
      }
  

    }
  

  }
  
  
  
}