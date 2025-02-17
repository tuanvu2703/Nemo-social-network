import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post } from './schemas/post.schema';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/user/schemas/user.schemas';
import { CreatePostDto } from './dto/createpost.dto';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { settingPrivacyDto } from './dto/settingPrivacy.dto';
import { UpdatePostDto } from './dto/updatePost.dto';
import { PostF } from './interface/PostHomeFeed.interface';
import { Friend } from 'src/user/schemas/friend.schema';


@Injectable()
export class PostService {
    constructor(
        @InjectModel(Post.name) private PostModel: Model<Post>,
        @InjectModel(User.name) private UserModel: Model<User>,
        @InjectModel(Friend.name) private FriendModel: Model<Friend>,
        private cloudinaryService: CloudinaryService,
        private jwtService: JwtService
    ) { }

    async createPost(createPostDto: CreatePostDto, userId: string, files?: Express.Multer.File[]): Promise<{ userPost: User, savedPost: Post }> {
        const newPost = new this.PostModel({
            content: createPostDto.content,
            author: userId,
            privacy: createPostDto.privacy,
            allowedUsers: createPostDto.allowedUsers,
            likes: [],
            dislikes: [],
            isActive: true,
        });

        if (files && files.length > 0) {
            try {
                const uploadedImages = await Promise.all(files.map(file => this.cloudinaryService.uploadFile(file)));
                newPost.img = uploadedImages;
            } catch (error) {

                throw new HttpException('Failed to upload images', HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }

        const savedPost = await newPost.save();
        const userPost = await this.UserModel.findById(userId);

        await this.settingPrivacy(savedPost._id.toString(), {
            privacy: createPostDto.privacy,
            allowedUsers: createPostDto.allowedUsers
        }, userId);

        return {
            userPost,
            savedPost
        };
    }


    async updatePost(postId: string, updatePostDto: UpdatePostDto, userId: string, files?: Express.Multer.File[]): Promise<Post> {
        const post = await this.PostModel.findById(postId);
    
        if (!post) {
            throw new HttpException('Post not found', HttpStatus.NOT_FOUND);
        }
    
        // Kiểm tra quyền của người dùng
        if (post.author.toString() !== userId) {
            throw new HttpException('You are not authorized to update this post', HttpStatus.UNAUTHORIZED);
        }
    
        // Cập nhật nội dung bài viết
        post.content = updatePostDto.content || post.content;
    
        // Nếu có ảnh mới, xử lý việc tải lên và thay thế ảnh cũ
        if (files && files.length > 0) {
   
            try {
                const uploadedImages = await Promise.all(
                    files.map(file => this.cloudinaryService.uploadFile(file))
                );
                post.img = uploadedImages; 
            } catch (error) {
                
                throw new HttpException('Failed to upload images', HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }
    
        const updatedPost = await post.save();

    
        return updatedPost;
    }

    async deletePost(postId: string, userId: string): Promise<{ message: string }> {
        const post = await this.PostModel.findById(postId);

        if (!post) {
            throw new HttpException('Post not found', HttpStatus.NOT_FOUND);
        }

        if (post.author.toString() !== userId) {
            throw new HttpException('You are not authorized to delete this post', HttpStatus.UNAUTHORIZED);
        }
        await this.PostModel.findByIdAndDelete(postId);

        return { message: 'Post deleted successfully' };
    }


    async likePost(postId: string, userId: string): Promise<{ post: Post; authorId: string }> {
        // Cập nhật bài viết và thêm userId vào danh sách likes
        const post = await this.PostModel.findByIdAndUpdate(
            postId,
            {
                $addToSet: { likes: userId }, // Đảm bảo không thêm trùng userId
                $inc: { likesCount: 1 }, // Tăng số lượng likes
            },
            { new: true }
        );
    
        // Nếu không tìm thấy bài viết, ném lỗi NotFound
        if (!post) {
            throw new NotFoundException(`Bài viết có ID "${postId}" không tồn tại`);
        }
    
        // Lấy authorId từ bài viết
        const authorId = post.author.toString(); // Giả sử 'author' là ObjectId
    
        return { post, authorId };
    }
    

    async unlikePost(postId: string, userId: string): Promise<Post> {
        const post = await this.PostModel.findByIdAndUpdate(
            postId,
            {
                $pull: { likes: userId },
                $inc: { likesCount: -1 },
            },
            { new: true },
        );

        if (!post) {
            throw new NotFoundException(`Bài viết có ID "${postId}" không tồn tại`);
        }

        return post;
    }

    async dislikePost(postId: string, userId: string): Promise<Post> {
        const post = await this.PostModel.findById(postId);

        if (!post) {
            throw new NotFoundException(`Bài viết có ID "${postId}" không tồn tại`);
        }

        if (post.dislikes.includes(userId)) {
            throw new HttpException('Bạn đã không thích bài viết này', HttpStatus.BAD_REQUEST);
        }

        post.dislikes.push(userId);

        return await post.save();
    }
    async undislikePost(postId: string, userId: string): Promise<Post> {
        const post = await this.PostModel.findById(postId);
        if (!post) {
            throw new NotFoundException(`Bài viết có ID "${postId}" không tồn tại`);
        }
        if (!post.dislikes.includes(userId)) {
            throw new HttpException('Bạn đã không thích bài viết này', HttpStatus.BAD_REQUEST);
        }
        post.dislikes = post.dislikes.filter(dislike => dislike !== userId);
        return await post.save();
    }

    async settingPrivacy(postId: string, settingPrivacyDto: settingPrivacyDto, userId: string): Promise<Post> {
        try {
            const post = await this.PostModel.findById(postId);

            if (!post) {
                throw new HttpException('The post does not exist', HttpStatus.NOT_FOUND);
            }

            // check var côi author có = userid 0 
            if (post.author.toString() !== userId) {
                throw new HttpException('You are not authorized to update this post', HttpStatus.UNAUTHORIZED);
            }

            // nếu cập nhật prvacy là specific nhưng 0 nhập list user thì trả về lỗi
            if (settingPrivacyDto.privacy === 'specific' && (!settingPrivacyDto.allowedUsers || settingPrivacyDto.allowedUsers.length === 0)) {
                throw new HttpException('Allowed users must be provided for specific privacy', HttpStatus.BAD_REQUEST);
            }
            post.privacy = settingPrivacyDto.privacy;
            if (settingPrivacyDto.privacy === 'specific') {
                post.allowedUsers = settingPrivacyDto.allowedUsers;
            } else {
                post.allowedUsers = [];
            }
            return await post.save();
        } catch (error) {
            // Bắt lỗi và ném lại lỗi dưới dạng HttpException nếu có lỗi
           
            throw new HttpException(
                error.message || 'An error occurred while updating post privacy',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async findPostCurrentUser(userId: string) {
        try {
            const userPosts = await this.PostModel.find({ author: userId })
                .populate('author', 'username firstName lastName avatar')
                .exec();
            return userPosts
        } catch (error) {
            
            throw new HttpException('Could not retrieve posts', HttpStatus.INTERNAL_SERVER_ERROR)
        }
    }

    async findPostPrivacy(postId: string, userId: string): Promise<Post> {
        try {
            const userIDOBJ = new Types.ObjectId(userId);
            // Truy vấn bài đăng
            const post = await this.PostModel.findById(postId);
        
            if (!post) {
                throw new HttpException('The post does not exist', HttpStatus.NOT_FOUND);
            }
        
            // Kiểm tra quyền truy cập của bài đăng
            if (post.privacy === 'public') {
                return post;  // Bài viết công khai có thể xem
            }
        
            if (post.privacy === 'private') {
                if (post.author.toString() === userId) {
                    return post;  // Chỉ người tạo bài viết có thể xem
                } else {
                    throw new HttpException('You are not authorized to view this post', HttpStatus.UNAUTHORIZED);
                }
            }
        
            if (post.privacy === 'friends') {
                // Kiểm tra người dùng có phải là bạn của tác giả bài viết không hoặc là chính tác giả
                if (post.author.toString() === userId) {
                    return post;  // Tác giả có thể xem bài viết của chính họ
                }
    
                const isFriend = await this.FriendModel.exists({
                    $or: [
                        { sender: userId, receiver: post.author.toString() },
                        { sender: post.author.toString(), receiver: userId }
                    ],
                });
        
                if (isFriend) {
                    return post;  // Nếu là bạn, trả về bài viết
                } else {
                    throw new HttpException('You are not friends with the author', HttpStatus.UNAUTHORIZED);
                }
            }
    
            if (post.privacy === 'specific') {
                // Kiểm tra người dùng có trong danh sách allowedUsers không
                if (post.allowedUsers.includes(userIDOBJ)) {
                    return post;  // Người dùng được phép xem bài viết
                } else {
                    throw new HttpException('You are not authorized to view this post', HttpStatus.UNAUTHORIZED);
                }
            }
        
            throw new HttpException('Invalid post privacy setting', HttpStatus.BAD_REQUEST);
        } catch (error) {
            throw error;
        }
    }

    async getPostsByUser(userId: string, currentUserId?: string): Promise<Post[]> {
        try {
            // Chuyển đổi `currentUserId` sang ObjectId nếu có
            const currentUserObjectId = currentUserId ? new Types.ObjectId(currentUserId) : null;
    
            // Lấy tất cả bài viết của `userId`
            const posts = await this.PostModel.find({ author: userId });
    
            // Lọc bài viết theo quyền riêng tư
            const filteredPosts = await Promise.all(
                posts.map(async (post) => {
                    const postAuthorObjectId = new Types.ObjectId(post.author); // Chuyển sang ObjectId nếu cần
    
                    if (post.privacy === 'public') {
                        return post; // Công khai, ai cũng xem được
                    }
    
                    if (post.privacy === 'private') {
                        if (postAuthorObjectId.equals(currentUserObjectId)) {
                            return post; // Chỉ tác giả mới được xem
                        }
                        return null; // Không đủ quyền
                    }
    
                    if (post.privacy === 'friends') {
                        // Kiểm tra người dùng hiện tại và tác giả có phải bạn bè không
                        if (postAuthorObjectId.equals(userId)) {
                            return post; // Tác giả luôn xem được bài viết của chính họ
                        }
    
                        const isFriend = await this.FriendModel.exists({
                            $or: [
                                { sender: currentUserObjectId, receiver: postAuthorObjectId },
                                { sender: postAuthorObjectId, receiver: currentUserObjectId },
                            ],
                        });
    
                        if (isFriend) {
                            return post; // Bạn bè được phép xem
                        }
                        return null; // Không đủ quyền
                    }
    
                    if (post.privacy === 'specific') {
                        // Kiểm tra người dùng có nằm trong danh sách allowedUsers không
                        if (
                            post.allowedUsers.some((id) =>
                                id.equals(currentUserObjectId)
                            )
                        ) {
                            return post; // Người dùng được chỉ định có thể xem
                        }
                        return null; // Không đủ quyền
                    }
    
                    return null; // Mặc định loại bỏ nếu không xác định được quyền riêng tư
                })
            );
    
            // Lọc bỏ các bài viết null (người dùng không được phép xem)
            return filteredPosts.filter((post) => post !== null);
        } catch (error) {
            console.error('Error in getPostsByUser:', error);
            throw new HttpException(
                'An error occurred while fetching posts',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
    
    
    

    async getHomeFeed(userId: string): Promise<PostF[]> {
        try {
            //tìm bản thân trong danh sách userModel(mục đích xem bản thân có tồn tại không)
            //ok logic là thế này: 

            //đầu tiên lấy toàn bộ bài viết
            //sau đó bắt đầu lọc với điều kiện 
            //1 bài viết đó phải là public, nếu là privacy thì bản thân(_id) phải có trong mảng allower user
            //còn nếu đó là friend thì xem bản thân và author có phải friend không nếu có thì lấy không thì lấy not
            //sau đó trừ toàn bộ bài viết có privacy là private
            //sau đó tính điểm cho từng bài viết rồi sort
            // Tìm người dùng và populate danh sách bạn bè
            const user = await this.UserModel.findById(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }
    
            // Lấy danh sách bạn bè từ bảng Friend
            const friends = await this.FriendModel.find({
                $or: [
                    { sender: userId }, 
                    { receiver: userId }, 
                ],
            }).exec();
    
            const friendIds = friends.map(friend => {
                return friend.sender.toString() === userId ? friend.receiver : friend.sender;
            });
    
            // Điều kiện lọc bài viết
            const conditions: Array<any> = [
                { privacy: 'public' },
                { privacy: 'specific', allowedUsers: userId },
                { privacy: 'friends', author: { $in: friendIds } }, // Bài viết của bạn bè (nếu không phải private)
            ];
    
            // Lấy tất cả bài viết dựa trên điều kiện
            const posts = await this.PostModel.find({
                $and: [
                    { privacy: { $ne: 'private' } }, // Loại trừ bài viết private
                    { $or: conditions }, // Chỉ lấy bài viết công khai, specific, hoặc của bạn bè
                ],
            })
                .populate('author', 'firstName lastName avatar birthday')
                .populate('likes', '_id')
                .populate('comments', '_id')
                .lean() // Trả về đối tượng JavaScript thay vì Mongoose document
                .exec();
    
            // Tính điểm xếp hạng cho các bài viết
            const scoredPosts = posts.map((post) => {
                const postObj = typeof post.toObject === 'function' ? post.toObject() : post;
                const timeSincePosted = (Date.now() - new Date(postObj.createdAt).getTime()) / (1000 * 60 * 60); // Tính số giờ kể từ khi đăng
                const userInterest = friendIds.some((friendId) => friendId.toString() === postObj.author.toString()) ? 1.5 : 1; // Điểm quan tâm từ bạn bè
                const engagement = postObj.likes.length * 3 + postObj.comments.length * 5; // Điểm tương tác
                const timeDecay = 1 / (1 + timeSincePosted); // Giảm dần theo thời gian
                const contentQuality = postObj.privacy === 'public' ? 1 : 0.8; // Điểm chất lượng nội dung
    
                // Tính điểm tổng thể của bài viết
                const rankingScore = userInterest * (engagement + contentQuality) * timeDecay;
                return { ...postObj, rankingScore };
            });
    
            // Sắp xếp bài viết theo điểm xếp hạng từ cao đến thấp
            scoredPosts.sort((a, b) => b.rankingScore - a.rankingScore);
    
            return scoredPosts;
        } catch (error) {

            throw new HttpException('An error occurred while fetching posts', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getPostByContent(content: string): Promise<Post[]> {
        const posts = await this.PostModel.find({ content: { $regex: content, $options: 'i' } }) // Case-insensitive search
          .populate({
            path: 'author',
            select: 'firstName lastName avatar'
          })
          .exec();
      
        if (!posts.length) {
          throw new HttpException('Post not found', HttpStatus.NOT_FOUND);
        }
      
        return posts;
      }
    
    
    


}
