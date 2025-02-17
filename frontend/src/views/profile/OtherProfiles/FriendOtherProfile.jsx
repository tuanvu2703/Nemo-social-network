import React from "react"
import DropdownMyfriend from "../../friend/DropdownMyfriend"
import { useState, useEffect } from "react"
import friend from "../../../service/friend"
import Loading from "../../../components/Loading"
import { Link, useParams } from "react-router-dom"
export default function FriendOtherProfile() {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)

    const { id } = useParams();
    useEffect(() => {
        const fetchdata = async () => {
            setLoading(true);
            const response = await friend.getListFriendAnother(id);
            setData(response.data)
            setLoading(false);
        }
        setTimeout(fetchdata, 1000);
    }, [id])


    const handDetailUser = async (id) => {
        window.location.href = `/user/${id}`;
    };
    return (
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-y-3 xl:col-span-2 p-3 ">
            {loading ? (
                <Loading />
            ) : (
                data.length > 0 ? (
                    data.map((e) => (
                        <li className='border-[1px] rounded-md p-2 shadow-lg'>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-x-6 ">
                                    <img
                                        className="w-14 aspect-square rounded-full shadow-md"
                                        alt=""
                                        src={e && (e?.receiver?.avatar || e?.sender?.avatar) ?
                                            (e?.receiver?.avatar || e?.sender?.avatar) :
                                            "https://th.bing.com/th/id/OIP.PKlD9uuBX0m4S8cViqXZHAHaHa?rs=1&pid=ImgDetMain"}
                                    />
                                    <div>
                                        <Link
                                            onClick={() => handDetailUser(e?.receiver?._id || e?.sender?._id)}
                                            className="text-base font-semibold leading-7 tracking-tight text-gray-900 z">
                                            {e?.receiver?.firstName || e?.sender?.firstName} {e?.receiver?.lastName || e?.sender?.lastName}
                                        </Link>
                                    </div>
                                </div>

                            </div>
                        </li>
                    ))
                ) : (<span>Chưa có bạn bè</span>))}
        </ul>

    )
}
