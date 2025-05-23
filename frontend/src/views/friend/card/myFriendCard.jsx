import React from 'react'
import { Link } from 'react-router-dom'
import user from '../../../service/user';
import { useEffect, useState } from 'react';
import imgUser from '../../../img/user.png'
import friend from '../../../service/friend';
import DropdownMyfriend from '../DropdownMyfriend'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { ToastContainer, toast } from 'react-toastify';
import {
    HeartIcon,
    ChatBubbleOvalLeftIcon,
    NoSymbolIcon,
    UserMinusIcon
} from '@heroicons/react/16/solid'
import Loading from '../../../components/Loading';
import NotificationCss from '../../../module/cssNotification/NotificationCss';


export default function FriendCard({ iduser, idrequest }) {
    const [userdata, setUserdata] = useState({});
    const [friendStatus, setFriendStatus] = useState(null);
    const [loading, setLoading] = useState(true); // Loading state
    const [friends, setFriends] = useState(userdata.friends); // Assuming userdata contains a list of friends
    useEffect(() => {
        const fetchdata = async () => {

            try {
                const res = await user.getProfileUser(iduser);
                if (res.success) {
                    setUserdata(res.data)
                    // console.log(res.data)
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            } finally {
                setLoading(false); // Stop loading
            }
        };
        fetchdata();
    }, [iduser]);
    if (loading) {
        return (
            <Loading />
        )
    }
    const handDetailUser = async (id) => {
        window.location.href = `/user/${id}`;
    };
    const chaneUrl = async (url) => {
        window.location.href = String(url);
    };
    const handRemoveFriend = async (id) => {
        try {
            const rs = await friend.cancelFriend(id);
            if (rs) {
                toast.success(rs?.message ? rs.message : 'Đã hủy kết bạn', NotificationCss.Success);
                setFriendStatus("pending");
                setFriends(friends.filter(friend => friend.id !== id)); // Update the friends list
            }

        } catch (error) {
            console.error('Error removing friend:', error);
        }
    };
    return (
        <div className="border border-gray-300 shadow-md w-full max-w-60 rounded-lg flex flex-col justify-between h-full bg-white">

            <Link onClick={() => handDetailUser(userdata?._id)} className="block overflow-hidden border-b-[1px]">
                <img
                    className="w-full aspect-square rounded-t-lg object-cover"
                    src={
                        userdata?.avatar
                            ? userdata.avatar
                            : imgUser
                    }
                    alt="User Avatar"
                />
            </Link>

            <div className="p-3 text-center">
                <strong className="block text-sm overflow-hidden text-ellipsis">
                    {userdata
                        ? `${(userdata.lastName || '').slice(0, 10)} ${(userdata.firstName || '').slice(0, 10)}`
                        : "No Name"}
                </strong>
            </div>

            <div className="flex flex-row gap-2 p-3 items-center">
                <button
                    onClick={() => handDetailUser(userdata?._id)}
                    className="w-full bg-gray-300 py-2 text-black text-sm rounded-lg transition-transform transform hover:scale-105"
                >
                    Xem trang cá nhân
                </button>
                <div className='flex justify-center items-center flex-shrink-0'>
                    <div className="dropdown dropdown-end">
                        <div tabIndex={0} role="button" className="p-2 hover:bg-gray-300 rounded-full">
                            <ChevronDownIcon className="size-4 fill-gray-500" />
                        </div>
                        <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow-md shadow-gray-500">
                            <li>
                                <Link
                                    onClick={userdata?._id ? () => chaneUrl(`/messenger/?iduser=${userdata._id}`) : undefined}
                                    className="  data-[focus]:bg-[#3f3f46] p-2 rounded-md flex items-center gap-2" to="#">
                                    <ChatBubbleOvalLeftIcon className="size-5 fill-blue-300" />
                                    Nhắn tin
                                </Link>
                            </li>
                            <li>
                                <Link
                                    onClick={() => userdata ? handRemoveFriend(userdata._id) : ''}
                                    className=" data-[focus]:bg-[#3f3f46] p-2 rounded-md flex items-center gap-2">
                                    <UserMinusIcon className="size-5 fill-red-500" />
                                    Hủy kết bạn
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}
