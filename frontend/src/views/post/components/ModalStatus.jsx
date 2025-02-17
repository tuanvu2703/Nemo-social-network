import { redirect } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Apiuri from '../../../service/apiuri';

import PublicIcon from '@mui/icons-material/Public'; // MUI's "Public" icon
import GroupIcon from '@mui/icons-material/Group'; // MUI's "Group" icon for Friends
import LockIcon from '@mui/icons-material/Lock'; // MUI's "Lock" icon for Only Me
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'; // MUI's dropdown arrow icon
import clsx from 'clsx';
import authToken from '../../../components/authToken';
import { PhotoIcon } from '@heroicons/react/24/solid'
import { Link, useNavigate } from 'react-router-dom'
import Loading from '../../../components/Loading';
import FileViewChane from '../../../components/fileViewChane';
const uri = Apiuri.Apiuri()

export default function ModalStatus({ user }) {
    const [open, setOpen] = useState(true);
    const [rows, setRows] = useState(3);
    const [visibility, setVisibility] = useState('Tất cả mọi người'); // State for visibility option
    const [privacy, setPrivacy] = useState('public');
    const [showDropdown, setShowDropdown] = useState(false); // State to toggle dropdown visibility
    const [alertVisible, setAlertVisible] = useState(false);
    const [filePreview, setFilePreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [nodata, setNodata] = useState(false);
    const [formData, setFormData] = useState({
        content: '',
        files: null,
        privacy: privacy,
    });
    useEffect(() => {
        setFormData({ "privacy": privacy })
    }, [privacy]); // Empty dependency array means it runs only once
    const maxRows = 12;

    const handleInputChange = (event) => {
        const textareaLineHeight = 24;
        const previousRows = event.target.rows;
        event.target.rows = 3;
        const currentRows = Math.floor(event.target.scrollHeight / textareaLineHeight);
        if (currentRows === previousRows) {
            event.target.rows = currentRows;
        }
        if (currentRows >= maxRows) {
            event.target.rows = maxRows;
            event.target.scrollTop = event.target.scrollHeight;
        } else {
            event.target.rows = currentRows;
        }
        setRows(currentRows < maxRows ? currentRows : maxRows);
        //
        const { name, value } = event.target
        setFormData({
            ...formData,
            [name]: value
        })
    };
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // setFormData((prevData) => ({ ...prevData, files: file }));
            setFilePreview(URL.createObjectURL(file));
        }
        setFormData({ ...formData, files: file });
    };
    const handleVisibilityChange = (newVisibility, valuePrivacy) => {
        setVisibility(newVisibility); // Update the visibility state
        setShowDropdown(false); // Close dropdown after selection
        setPrivacy(valuePrivacy);
    };

    // Determine the icon based on visibility selection
    const renderVisibilityIcon = (visibility) => {
        switch (visibility) {
            case 'Tất cả mọi người':
                //setPrivacy('public')
                return <PublicIcon className="text-blue-500" />;
            case 'Chỉ bạn bè':
                // setDataPrivacy('friends')
                return <GroupIcon className="text-green-500" />;
            case 'Riêng tư':
                // setDataPrivacy('private')
                return <LockIcon className="text-gray-500" />;
            default:
                return <PublicIcon className="text-blue-500" />;
        }
    };



    //Submit 
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.content && !formData.files) {
            setNodata(true);
            return;
        }
        const data = new FormData();
        data.append('content', formData.content || '');
        data.append('files', formData.files || '');
        data.append('privacy', formData.privacy);
        try {
            setLoading(true);
            const response = await axios.post(`${uri}/post/createPost`, data,
                {
                    headers: {
                        Authorization: `Bearer ${authToken.getToken()}`,
                        'Content-Type': 'multipart/form-data',
                    }
                }
            );

            if (response.status === 201) {
                setAlertVisible(true);
                setTimeout(() => {
                    setOpen(false);
                    window.location.reload()
                }, 1000);
            } else {
                alert('Có lỗi xảy ra, vui lòng thử lại.');

            }
            // Xử lý thành công (ví dụ: chuyển hướng sang trang khác)
        } catch (error) {
            console.error('Lỗi:', error.response ? error.response.data : error.message);
        }
    }
    // console.log(formData)
    return (
        <dialog id="my_modal_1" className="modal">

            <form className="modal-box"
                method='POST'
                enctype="multipart/form-data"
                onSubmit={handleSubmit}
            >
                {/* Header */}
                {alertVisible && (
                    <div role="alert" className="alert alert-success">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Đăng post thành công!</span>
                    </div>
                )}
                <div className="border-b border-gray-300 py-3 px-4 flex justify-center">

                    <strong className="text-black text-xl"
                        style={{
                            animation: 'colorWave 1s linear infinite',
                            fontWeight: 'bold',
                        }}
                    >
                        Tạo bài đăng
                    </strong>
                    <form method="dialog">
                        {/* if there is a button in form, it will close the modal */}
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
                </div>
                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Profile and Privacy */}

                    <div className="flex items-center space-x-3">
                        <div className="bg-gray-600 h-12 w-12 rounded-full flex items-center justify-center text-white">
                            <img
                                className='h-12 aspect-square rounded-full shadow-md flex items-center justify-center'
                                src={`${user.avatar ? user.avatar : "https://th.bing.com/th/id/OIP.PKlD9uuBX0m4S8cViqXZHAHaHa?rs=1&pid=ImgDetMain"}`} alt='' />
                        </div>
                        <div>
                            <strong className="text-lg text-gray-600">
                                {user.lastName} {user.firstName}
                            </strong>
                            <button
                                type='button'
                                className="flex items-center p-2 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-200"
                                onClick={() => setShowDropdown(!showDropdown)} // Toggle dropdown on click

                                aria-label="Edit privacy. Sharing with Public."
                            >

                                {renderVisibilityIcon(visibility)} {/* Dynamically render icon */}
                                <span className="ml-1 text-sm">{visibility}</span>
                                <ArrowDropDownIcon fontSize="small" />
                            </button>

                            {/* Dropdown for selecting visibility */}
                            {showDropdown && (
                                <div className="absolute bg-white border border-gray-300 rounded-md shadow-md mt-2 p-2 max-w-56 ">
                                    <button
                                        type='button'
                                        className="w-full text-left py-2 px-4 hover:bg-gray-100"
                                        onClick={() => handleVisibilityChange('Tất cả mọi người', "public")}

                                    >
                                        <PublicIcon className="mr-2 text-nowrap" /> Tất cả mọi người
                                    </button>
                                    <button
                                        type='button'
                                        className="w-full text-left py-2 px-4 hover:bg-gray-100"
                                        onClick={() => handleVisibilityChange('Chỉ bạn bè', "friends")}
                                    >
                                        <GroupIcon className="mr-2 text-nowrap" /> Chỉ bạn bè
                                    </button>
                                    <button
                                        type='button'
                                        className="w-full text-left py-2 px-4 hover:bg-gray-100"
                                        onClick={() => handleVisibilityChange('Riêng tư', "private")}
                                    >
                                        <LockIcon className="mr-2 text-nowrap" /> Riêng tư
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Textarea */}
                    <div>
                        <textarea
                            className={clsx(
                                'sm:text-lg border-none w-full resize-none rounded-lg bg-gray-100 py-2 px-3 text-black',
                                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-200',
                                'overflow-y-auto max-h-[60vh]' // Expands up to 60% of viewport height
                            )}
                            name="content"
                            value={formData.content}
                            rows={rows}
                            maxLength={4000}
                            placeholder="Viết nội dung của bạn..."
                            onChange={handleInputChange}
                            style={{ lineHeight: '1.5rem' }}
                        />
                        {nodata && (<div className="text-red-500">Vui lòng nhập nội dung hoặc chọn ảnh</div>)}
                        {filePreview && (
                            <div className="mt-4">
                                <FileViewChane  file={formData?.files}/>
                                {/* <img src={filePreview} alt="Preview" className="max-w-full h-32 rounded-lg" /> */}
                            </div>
                        )}
                        <div className="flex justify-end w-full gap-2">
                            <div className="file-input-wrapper ">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    id="files"
                                    name='files'
                                    onChange={handleFileChange}

                                />
                                <label htmlFor="files" className="file-input-button cursor-pointer">
                                    <div className=' p-1 rounded-xl hover:bg-slate-300'>
                                        <PhotoIcon className='size-7 fill-sky-600 ' />
                                    </div>
                                </label>
                            </div>

                        </div>

                    </div>

                </div>
                <div className="modal-action">
                    {loading ? <p><Loading /></p> :
                        <div className='flex gap-3'>
                            <form method="dialog">
                                <button className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition duration-150">Hủy đăng bài</button>
                            </form>
                            <button
                                type="submit"

                                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition duration-150"
                            >
                                Đăng bài
                            </button>
                        </div>
                    }
                </div>
            </form>
        </dialog>

        // <Dialog open={open} onClose={setOpen} className="relative z-10">
        //     <DialogBackdrop className="fixed inset-0 bg-gray-900 opacity-75 transition-opacity" />
        //     <div className="fixed inset-0 z-10 overflow-y-auto flex items-center justify-center p-4">
        // <form
        // method='POST'
        // onSubmit={handleSubmit}
        //     className="relative w-full max-w-lg mx-auto rounded-lg bg-white overflow-hidden shadow-xl sm:w-4/5 lg:w-1/2">
        //             {/* Close button */}
        //             <button
        //                 className="absolute right-2 top-2 border bg-gray-200 border-gray-200 shadow-sm text-gray-700 h-10 w-10 rounded-full flex items-center justify-center"
        //                 onClick={() => setOpen(false)}
        //             >
        //                 <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
        //                     <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        //                 </svg>
        //             </button>

        // {/* Header */}
        // <div className="border-b border-gray-300 py-3 px-4 flex justify-center">
        //     <strong className="text-black text-xl"
        //     // style={{
        //     //     animation: 'colorWave 1s linear infinite',
        //     //     fontWeight: 'bold',
        //     // }}
        //     >Tạo bài đăng</strong>
        // </div>

        // {/* Content */}
        // <div className="p-4 space-y-4">
        //     {/* Profile and Privacy */}
        //     <div className="flex items-center space-x-3">
        //         <div className="bg-gray-600 h-12 w-12 rounded-full flex items-center justify-center text-white">
        //             AVT
        //         </div>
        //         <div>
        //             <strong className="text-lg text-gray-600">
        //                 Pro Code
        //             </strong>
        //             <button
        //                 type='button'
        //                 className="flex items-center p-2 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-200"
        //                 onClick={() => setShowDropdown(!showDropdown)} // Toggle dropdown on click

        //                 aria-label="Edit privacy. Sharing with Public."
        //             >

        //                 {renderVisibilityIcon(visibility)} {/* Dynamically render icon */}
        //                 <span className="ml-1 text-sm">{visibility}</span>
        //                 <ArrowDropDownIcon fontSize="small" />
        //             </button>

        //             {/* Dropdown for selecting visibility */}
        //             {showDropdown && (
        //                 <div className="absolute bg-white border border-gray-300 rounded-md shadow-md mt-2 p-2 max-w-56 ">
        //                     <button
        //                         type='button'
        //                         className="w-full text-left py-2 px-4 hover:bg-gray-100"
        //                         onClick={() => handleVisibilityChange('Tất cả mọi người', "public")}

        //                     >
        //                         <PublicIcon className="mr-2 text-nowrap" /> Tất cả mọi người
        //                     </button>
        //                     <button
        //                         type='button'
        //                         className="w-full text-left py-2 px-4 hover:bg-gray-100"
        //                         onClick={() => handleVisibilityChange('Chỉ bạn bè', "friends")}
        //                     >
        //                         <GroupIcon className="mr-2 text-nowrap" /> Chỉ bạn bè
        //                     </button>
        //                     <button
        //                         type='button'
        //                         className="w-full text-left py-2 px-4 hover:bg-gray-100"
        //                         onClick={() => handleVisibilityChange('Riêng tư', "private")}
        //                     >
        //                         <LockIcon className="mr-2 text-nowrap" /> Riêng tư
        //                     </button>
        //                 </div>
        //             )}
        //         </div>
        //     </div>

        //     {/* Textarea */}
        //     <div>
        //         <textarea
        //             className={clsx(
        //                 'sm:text-lg border-none w-full resize-none rounded-lg bg-gray-100 py-2 px-3 text-black',
        //                 'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-200',
        //                 'overflow-y-auto max-h-[60vh]' // Expands up to 60% of viewport height
        //             )}
        //             name="content"
        //             value={formData.content}
        //             rows={rows}
        //             placeholder="Viết nội dung của bạn..."
        //             onChange={handleInputChange}
        //             style={{ lineHeight: '1.5rem' }}
        //         />
        //         <div className="flex justify-end w-full gap-2">
        //             <div className="file-input-wrapper ">
        //                 <input
        //                     type="file"
        //                     accept="image/*"
        //                     className="hidden"
        //                     id="file-input"
        //                     name='files'
        //                     onChange={handleInputChange}
        //                     value={formData.files}
        //                 />
        //                 <label htmlFor="file-input" className="file-input-button cursor-pointer">
        //                     <div className=' p-1 rounded-xl hover:bg-slate-300'>
        //                         <PhotoIcon className='size-7 fill-sky-600 ' />
        //                     </div>
        //                 </label>
        //             </div>
        //             <button>
        //                 <EmojiEmotionsIcon className="" fontSize="large"
        //                 // style={{
        //                 //     animation: 'colorWave 1s linear infinite',
        //                 //     fontWeight: 'bold',
        //                 // }}
        //                 />
        //             </button>
        //         </div>
        //     </div>
        // </div>

        //             {/* Post Button */}
        //             <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
        // <button
        //     type="button"
        //     onClick={status}
        //     className=" bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition duration-150"
        // >
        //     Hủy đăng
        // </button>
        // <button
        //     type="submit"

        //     className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition duration-150"
        // >
        //     Đăng bài
        // </button>
        //             </div>
        //         </form>
        //     </div>
        // </Dialog>
    );
}
