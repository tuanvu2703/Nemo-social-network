import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId, Types } from 'mongoose';
import ObjectIdToString from 'mongoose';
import { User } from './schemas/user.schemas';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { FriendRequest } from './schemas/friendRequest.schema';
import { ChangePasswordDto } from './dto/changePassword.dto';
import { OtpService } from '../otp/otp.service';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UploadAvatarDto } from './dto/uploadAvartar.dto';
import { UploadCoverImgDto } from './dto/uploadCoverImg.dto';
import { Friend } from './schemas/friend.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private UserModel: Model<User>,
    @InjectModel(FriendRequest.name) private FriendRequestModel: Model<FriendRequest>,
    @InjectModel(Friend.name) private FriendModel: Model<Friend>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private cloudinaryService: CloudinaryService,
    private otpService: OtpService,
  ) { }

  async register(registerDto: RegisterDto): Promise<User> {
    const {
      numberPhone,
      email,
      firstName,
      lastName,
      address,
      gender,
      birthday,
      password,
    } = registerDto;

    const checkUSer = await this.UserModel.findOne({ numberPhone });
    if (checkUSer) {
      throw new HttpException(
        'the numberphone has account:(',
        HttpStatus.CONFLICT,
      );
    }

    const hashPassword = await bcrypt.hash(password, 10);

    const user = await this.UserModel.create({
      numberPhone,
      email,
      firstName,
      lastName,
      address,
      gender,
      birthday,
      password: hashPassword,
    });
    return user;
  }

  async generateToken(userId): Promise<{ accessToken: string, refreshToken: string }> {
    const accessToken = this.jwtService.sign({ userId });

    const refreshToken = this.jwtService.sign(
      { userId },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string | number>('JWT_REFRESH_EXPIRES')
      }
    );
    await this.UserModel.findByIdAndUpdate(userId, { refreshToken });
    return {
      accessToken,
      refreshToken
    };
  }

  async refreshToken(userId: string, refreshToken: string): Promise<{ accessToken: string }> {
    const user = await this.UserModel.findById(userId);

    // Kiểm tra xem người dùng có tồn tại và refresh token có hợp lệ không
    if (!user || user.refreshToken !== refreshToken) {
      throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
    }

    // Xác thực refresh token bằng secret cho refresh token
    try {
      this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'), // Sử dụng secret cho refresh token từ config
      });
    } catch (error) {
      throw new HttpException('Refresh token expired', HttpStatus.UNAUTHORIZED);
    }

    // Tạo mới access token (không cần truyền secret và expiresIn vì đã cấu hình trong module)
    const accessToken = this.jwtService.sign({ userId });

    return { accessToken };
  }


  async login(loginDto: LoginDto): Promise<{ accessToken: string }> {
    const { numberPhone, email, password } = loginDto;

    if (!numberPhone && !email) {
      throw new HttpException('Phone number or email is required', HttpStatus.BAD_REQUEST);
    }

    let user;
    if (numberPhone) {
      user = await this.UserModel.findOne({ numberPhone }).exec();
    } else if (email) {
      user = await this.UserModel.findOne({ email }).exec();
    }

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    // Kiểm tra mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new HttpException('Invalid password', HttpStatus.UNAUTHORIZED);
    }

    return this.generateToken(user._id);
  }


  async findByIdForAdmin(userId: string): Promise<User> {
    const user = await this.UserModel.findById(userId)
      .select('-password -isActive  -createdAt -updatedAt')
      .exec();
    if (!user) {
      throw new NotFoundException('404: user not found');
    }
    return user;
  }


  async findById(userId: string): Promise<User> {
    const user = await this.UserModel.findById(userId)
      .select('-password -isActive  -createdAt -updatedAt, -refreshToken')
      .exec();
    if (!user) {
      throw new NotFoundException('404: user not found');
    }
    return user;
  }

  async FriendsRequest(senderID: string, receiverId: string): Promise<any> {
    // Kiểm tra xem hai người đã là bạn bè hay chưa
    const areAlreadyFriends = await this.FriendModel.findOne({
      $or: [
        { sender: senderID, receiver: receiverId },
        { sender: receiverId, receiver: senderID } 
      ]
    });
  
    if (areAlreadyFriends) {
      throw new ConflictException('you has friend with user.');
    }
  
    // Kiểm tra xem đã có yêu cầu kết bạn nào được gửi đi chưa (trong cả hai chiều)
    const [existingSentRequest, existingReceivedRequest] = await Promise.all([
      this.FriendRequestModel.findOne({ sender: senderID, receiver: receiverId }),
      this.FriendRequestModel.findOne({ sender: receiverId, receiver: senderID }),
    ]);
  
    if (existingSentRequest) {
      throw new ConflictException('You has sent request with user.');
    }
  
    if (existingReceivedRequest) {
      // Handle scenario where receiver has already sent a request to sender
      if (existingReceivedRequest.status === 'waiting') {
      
        await Promise.all([
          this.FriendRequestModel.findOneAndUpdate({ _id: existingReceivedRequest._id }, { status: 'accepted' }),
          this.FriendRequestModel.create({ sender: senderID, receiver: receiverId, status: 'accepted' }),
        ]);
        return { message: 'Your request has been accepted' };
      } else {
        throw new ConflictException('This person has sent you a friend request. Please accept or decline their request first');
      }
    }
  

    const newRequest = new this.FriendRequestModel({
      sender: senderID,
      receiver: receiverId,
      status: 'waiting'
    });
  
    return newRequest.save();
  }

  async acceptRequestFriends(
    currentUserId: string,
    friendRequestId: string,
  ): Promise<{ friend: Friend; senderId: string }> {
    const friendRequest = await this.FriendRequestModel.findById(friendRequestId);
  
    if (!friendRequest) {
      throw new NotFoundException('No friend request found');
    }
  
    const { sender, receiver } = friendRequest;
  
    if (currentUserId !== receiver.toString()) {
      throw new ForbiddenException('You are not authorized to accept this friend request');
    }
  
    // Kiểm tra xem hai người đã là bạn bè hay chưa
    const existingFriendship = await this.FriendModel.findOne({
      $or: [
        { sender: sender, receiver: receiver },
        { sender: receiver, receiver: sender },
      ],
    });
  
    if (existingFriendship) {
      throw new ConflictException('You are already friends with this user.');
    }
  
    // Xóa yêu cầu kết bạn
    await friendRequest.deleteOne();
  
    // Tạo mối quan hệ bạn bè
    const friend = await this.FriendModel.create({
      sender,
      receiver,
      status: 'friend',
    });
  
    // Trả về mối quan hệ bạn bè và ID người gửi yêu cầu
    return { friend, senderId: sender.toString() };
  }
  



  async rejectFriendRequest(
    currentUserId: string,
    friendRequestId: string,
  ): Promise<{ message: string }> {

    const friendRequest = await this.FriendRequestModel.findById(friendRequestId);

    if (!friendRequest) {
      throw new NotFoundException('No such friend request found');
    }
    const { receiver } = friendRequest;

    if (currentUserId !== receiver.toString()) {
      throw new ForbiddenException('You are not authorized to reject this friend request');
    }
    await this.FriendRequestModel.findByIdAndDelete(friendRequestId);

    return { message: 'Friend request rejected successfully' };
  }

  async removeFriendRequest(currentUserId: string, friendRequestId: string,): Promise<{ message: string, FriendRequest: FriendRequest }> {
    const friendRequest = await this.FriendRequestModel.findById(friendRequestId);
    if (!friendRequest) {
      throw new NotFoundException('No such friend request found');
    }
    const sender = friendRequest.sender;
    if (currentUserId !== sender.toString()) {
      throw new ForbiddenException('You are not authorized to delete this friend request');
    }
    await this.FriendRequestModel.findByIdAndDelete(friendRequestId);
    return { message: 'Friend request deleted successfully' , FriendRequest: friendRequest};
  }

  async unFriend(currentUserId: string, friendId: string): Promise<Friend> {
    try {

      const Friend =  await this.FriendModel.findOneAndDelete({
            $or: [
                { sender: currentUserId, receiver: friendId },
                { sender: friendId, receiver: currentUserId },
            ],
        });
        return Friend;
    } catch (error) {

        throw new HttpException('An error occurred while unfriending', HttpStatus.INTERNAL_SERVER_ERROR);
    }
}


  async getMyFriendRequest(userId: string): Promise<FriendRequest[]> {
    return this.FriendRequestModel.find({ receiver: userId });
  }

  async getMySentFriendRequest(userId: string): Promise<FriendRequest[]> {
    return this.FriendRequestModel.find({ sender: userId });
  }

//   async getMyFriend(userId: string): Promise<any[]> {
//     console.log('Input userId:', userId);

//     const friendList = await this.FriendModel.find({
//         $or: [
//             { sender: userId },
//             { receiver: userId }
//         ],
//         status: 'friend'
//     }).exec(); // Bỏ populate để xem kết quả

//     console.log('Raw Friend List (without populate):', friendList);
//     return friendList;
// }


  async getMyFriend(userId: string): Promise<Friend[]> {

    const friendList = await this.FriendModel.find({
      $or: [
        { sender: userId },
        { receiver: userId }
      ]
    })
    .populate({
      path: 'sender',
      select: 'firstName lastName avatar',
      match: { _id: { $ne: userId } }
    })
    .populate({
      path: 'receiver',
      select: 'firstName lastName avatar',
      match: { _id: { $ne: userId } }
    })
    .exec();
  
    return friendList.filter(friend => {
      return (friend.sender && friend.sender._id !== userId) || (friend.receiver && friend.receiver._id !== userId);
    });
  }

  async getListFriendAnother(userId: string): Promise<Friend[]> {
    const friendList = await this.FriendModel.find({
      $or: [
        { sender: userId },
        { receiver: userId }
      ]
    })
    .populate({
      path: 'sender',
      select: 'firstName lastName avatar',
      match: { _id: { $ne: userId } }
    })
    .populate({
      path: 'receiver',
      select: 'firstName lastName avatar',
      match: { _id: { $ne: userId } }
    })
    .exec();
  
    return friendList.filter(friend => {
      return (friend.sender && friend.sender._id !== userId) || (friend.receiver && friend.receiver._id !== userId);
    });
  }
  
  



  async updateUser(userId: string, updateData: any): Promise<any> {
    // Tìm người dùng theo ID
    const user = await this.UserModel.findById(userId);
  
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
  
    // Filter out fields with empty string values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === "") {
        delete updateData[key];
      }
    });
  
    Object.assign(user, updateData);
    await user.save();
  
    // Create an object with only the updated fields
    const updatedFields = {};
    Object.keys(updateData).forEach(key => {
      updatedFields[key] = user[key];
    });
  
    return updatedFields;
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<{ message: string }> {
    const { currentPassword, newPassword } = changePasswordDto;
    try {

      const user = await this.UserModel.findById(userId);
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        throw new HttpException('Current password is incorrect', HttpStatus.UNAUTHORIZED);
      }

      const isNewPasswordSameAsCurrent = await bcrypt.compare(newPassword, user.password);
      if (isNewPasswordSameAsCurrent) {
        throw new HttpException('New password cannot be the same as the current password', HttpStatus.BAD_REQUEST);
      }

      user.password = await bcrypt.hash(newPassword, 10);

      await user.save();
      return { message: 'Password updated successfully' };
    } catch (error) {

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException('Password update failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }


  async findAllMySenderFriendRequest(userId : string): Promise<FriendRequest[]> {
    return this.FriendRequestModel.find({ sender: userId });
  }


  async findAllUsers(userId: string): Promise<any[]> {
    try {
      // Fetch user data, excluding sensitive fields
      const users = await this.UserModel.find()
        .select('-password -isActive -refreshToken -createdAt -updatedAt -role -otp -otpExpirationTime -bookmarks -friends -coverImage')
        .lean()
        .exec();
  
      // Fetch friend requests related to the current user
      const friendRequests = await this.FriendRequestModel.find({
        $or: [
          { sender: userId,  }, 
          { receiver: userId,  }, 
        ],
      }).exec();
  
      // Fetch actual friends (accepted requests)
      const friends = await this.FriendModel.find({
        $or: [{ sender: userId }, { receiver: userId }],
      }).exec();
  
      // Process user data and assign friend statuses
      const updatedUsers = users.map((user) => {
        let status = 'no friend';
  
        // Check for accepted friend relationship (highest priority)
        if (friends.some((friend) => friend.sender.toString() === userId.toString() && friend.receiver.toString() === user._id.toString() || friend.sender.toString() === user._id.toString() && friend.receiver.toString() === userId.toString())) {
          status = 'friend';
        } else {
          // Check for pending requests (sent or received)
          const pendingRequest = friendRequests.find(
            (request) =>
              (request.sender.toString() === userId.toString() && request.receiver.toString() === user._id.toString() && request.status === 'waiting') ||
              (request.receiver.toString() === userId.toString() && request.sender.toString() === user._id.toString() && request.status === 'waiting')
          );
  
          if (pendingRequest) {
            status = pendingRequest.sender.toString() === userId.toString() ? 'waiting' : 'pending'; // Differentiate sent/received
          }
        }
  
        return { ...user, status };
      });
  
      return updatedUsers;
    } catch (error) {

      throw new HttpException('Could not retrieve users', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  

  async resetPassword(email: string, otp: string, resetPasswordDto: ResetPasswordDto): Promise<string> {
    // Xác thực OTP
    const isOtpValid = await this.otpService.verifyOtp(email, otp);
    if (!isOtpValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Cập nhật mật khẩu (băm mật khẩu mới)
    const user = await this.UserModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10); 
    user.password = hashedPassword;
    await user.save();
    // Xóa OTP sau khi xác thực thành công để tránh sử dụng lại
    await this.UserModel.updateOne({ email }, { otp: null, otpExpirationTime: null });

    return 'Password reset successfully';
  }

  async uploadCoverImage(uploadCoverImageDto: UploadCoverImgDto, userId: string, files?: Express.Multer.File[]): Promise<User> {
    // Tìm người dùng dựa trên ID
    const user = await this.UserModel.findById(userId);

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // if (user.coverimgaePublicId) {
    //   await this.cloudinaryService.deleteFile(user.avatarPublicId);
    // }

    // Kiểm tra số lượng file
    if (!files || files.length === 0) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }
    if (files.length > 1) {
      throw new HttpException('Only one file is allowed', HttpStatus.BAD_REQUEST);
    }

    try {
      // Upload file duy nhất
      const uploadedImage = await this.cloudinaryService.uploadFile(files[0]);
      user.coverImage = uploadedImage; // Cập nhật avatar cho người dùng
       // Cập nhật public ID của ảnh
    } catch (error) {

      throw new HttpException('Failed to upload image', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Lưu người dùng sau khi cập nhật avatar
    return await user.save();
  }

  async uploadAvatar(uploadAvatarDto: UploadAvatarDto, userId: string, files?: Express.Multer.File[]): Promise<User> {
    // Tìm người dùng dựa trên ID
    const user = await this.UserModel.findById(userId);

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    if (!files || files.length === 0) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }
    if (files.length > 1) {
      throw new HttpException('Only one file is allowed', HttpStatus.BAD_REQUEST);
    }

    try {
      // Upload file duy nhất
      const uploadedImage = await this.cloudinaryService.uploadFile(files[0]);
      user.avatar = uploadedImage;
    } catch (error) {

      throw new HttpException('Failed to upload image', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return await user.save();
  }
  async savePost(userId: string, postId: string): Promise<User> {
    const bookmarks = await this.UserModel.findById(userId);
    if (!bookmarks) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    if (bookmarks.bookmarks.includes(new Types.ObjectId(postId))) {
      throw new HttpException('Post already saved', HttpStatus.BAD_REQUEST);
    }
    await bookmarks.save();
    await this.UserModel.findByIdAndUpdate(userId, {
      $push: { bookmarks: postId },
    });
    return bookmarks;
  }
  async removeSavedPost(userId: string, postId: string): Promise<User> {
    const user = await this.UserModel.findById(userId);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    user.bookmarks = user.bookmarks.filter(bookmark => bookmark.toString() !== postId);
    await user.save();
    return user;
  }
  async getSavedPosts(userId: string): Promise<User> {
    return this.UserModel.findById(userId).populate('bookmarks');
  }

  async getuserByName(name: string, userId: string): Promise<any[]> {
    try {
 
      const users = await this.UserModel.find({
        $or: [
          { firstName: { $regex: name, $options: 'i' } },
          { lastName: { $regex: name, $options: 'i' } }
        ]
      })
      .select('-password -isActive -refreshToken -createdAt -updatedAt -role -otp -otpExpirationTime -bookmarks -friends -coverImage')
      .lean()
      .exec();
  

      const friendRequests = await this.FriendRequestModel.find({
        $or: [
          { sender: userId }, 
          { receiver: userId }, 
        ],
      }).exec();


      const friends = await this.FriendModel.find({
        $or: [{ sender: userId }, { receiver: userId }],
      }).exec();
  
      // Process user data and assign friend statuses
      const updatedUsers = users.map((user) => {
        let status = 'no friend';
  

        if (friends.some((friend) => 
          (friend.sender.toString() === userId && friend.receiver.toString() === user._id.toString()) || 
          (friend.sender.toString() === user._id.toString() && friend.receiver.toString() === userId)
        )) {
          status = 'friend';
        } else {
          // Check for pending requests (sent or received)
          const pendingRequest = friendRequests.find(
            (request) =>
              (request.sender.toString() === userId && request.receiver.toString() === user._id.toString() && request.status === 'waiting') ||
              (request.receiver.toString() === userId && request.sender.toString() === user._id.toString() && request.status === 'waiting')
          );
  
          if (pendingRequest) {
            status = pendingRequest.sender.toString() === userId ? 'waiting' : 'pending'; // Differentiate sent/received
          }
        }
  
        return { ...user, status };
      });
  
      return updatedUsers;
    } catch (error) {
    
      throw new HttpException('Could not retrieve users', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

}