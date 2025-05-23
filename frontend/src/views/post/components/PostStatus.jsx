import React from 'react';
import ModalStatus from './ModalStatus';

export default function PostStatus({ user, addNewPost, groupId }) {
  if (!user) return;
  return (
    <div className='border border-gray-300 bg-white rounded-lg shadow-sm shadow-zinc-300 p-2 sm:p-4'>
      <div className="flex column items-center" >
        <div className='pr-2 sm:pr-3'>
          <img
            className='w-8 h-8 sm:w-12 sm:h-12 aspect-square rounded-full shadow-md flex items-center justify-center'
            src={`${user && user.avatar ? user.avatar : "https://th.bing.com/th/id/OIP.PKlD9uuBX0m4S8cViqXZHAHaHa?rs=1&pid=ImgDetMain"}`} alt='' />
        </div>
        <button
          className="w-full h-10 sm:h-12 flex items-center rounded-3xl px-3 sm:px-4 border-2 border-gray-200 bg-gray-100"
          onClick={() => document.getElementById('my_modal_1').showModal()}
        >
          <span className="text-xs sm:text-sm text-gray-600">Bạn muốn đăng gì?</span>
        </button>

        <ModalStatus user={user} addNewPost={addNewPost} group={groupId} />
      </div>
    </div>
  );
}
