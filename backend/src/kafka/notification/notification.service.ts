import { Injectable } from '@nestjs/common';
import { EventService } from '../../event/event.service';

@Injectable()
export class NotificationService {
  constructor(private eventService: EventService) {}

  // 🔹 Xử lý tin nhắn nhóm
  async handleChatMessage(payload) {
    const { senderId, groupId, content, mediaURL, recipients, messageId } = payload;
    
    for (const userId of recipients) {
      if (userId !== senderId) {
        this.eventService.notificationToUser(userId, 'newmessagetogroup', {
          messageId,
          groupId,
          senderId,
          content,
          mediaURL,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // 🔹 Xử lý bình luận bài viết
  async handlePostComment(payload) {
    const { postId, commenterId, commentContent, ownerId } = payload;

    if (commenterId !== ownerId) {
      this.eventService.notificationToUser(ownerId, 'newcomment', {
        postId,
        commenterId,
        commentContent,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 🔹 Xử lý like bài viết
  async handlePostLike(payload) {
    const { postId, likerId, ownerId } = payload;

    if (likerId !== ownerId) {
      this.eventService.notificationToUser(ownerId, 'newlike', {
        postId,
        likerId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async handle(payload) {
    const { postId, likerId, ownerId } = payload;

    if (likerId !== ownerId) {
      this.eventService.notificationToUser(ownerId, 'newlike', {
        postId,
        likerId,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
