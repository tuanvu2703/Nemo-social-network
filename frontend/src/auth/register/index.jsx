import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'; // Ensure CSS is imported
import NotificationCss from '../../module/cssNotification/NotificationCss';
import Apiuri from '../../service/apiuri';
import bg from '../background_auth.jpg'

const uri = Apiuri.Apiuri()

export default function Register() {
    const [formData, setFormData] = useState({
        numberPhone: '',
        firstName: '',
        lastName: '',
        address: '',
        gender: '',
        birthday: '',
        password: '',
        confirmPassword: '',
    });

    const [errors, setErrors] = useState({});
    const navigate = useNavigate();

    const validateForm = () => {
        const validationErrors = {};
        if (!formData.password) {
            validationErrors.password = 'Bắt buộc nhập mật khẩu';
        } else if (formData.password.length < 8) {
            validationErrors.password = 'Mật khẩu quá ngắn';
        }

        if (formData.password !== formData.confirmPassword) {
            validationErrors.confirmPassword = 'Mật khẩu không khớp nhau';
        }
        return validationErrors;
    };

    const handleRemoveError = (field) => {
        setErrors((prevErrors) => {
            const updatedErrors = { ...prevErrors };
            delete updatedErrors[field];
            return updatedErrors;
        });
    };
    // Create a copy of formData without the confirmPassword field
    const { confirmPassword, ...dataToSend } = formData;

    const updatedFormData = {
        ...dataToSend,
        gender: formData.gender === 'male' ? true : false
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({});
        const validationErrors = validateForm();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            Object.values(validationErrors).forEach((error) => {
                toast.error(error, NotificationCss.Fail);
            });
            return;
        }

        try {
            const response = await axios.post(`${uri}/user/register`, updatedFormData);
            if (response.status === 201) {
                toast.success('Đăng ký thành công!', NotificationCss.Success);
                setTimeout(() => navigate('/login'), 2000);
            } else {
                toast.error(response.data.message, NotificationCss.Fail);
            }
        } catch (error) {
            const errorMessage =
                error.response && error.response.data && error.response.data.message
                    ? error.response.data.message
                    : 'Đăng ký thất bại, vui lòng thử lại!';
            toast.error(errorMessage, NotificationCss.Fail);
            console.error('Lỗi:', error.response || error.message);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
        handleRemoveError(name);
    };

    return (
        <div
            className="h-screen flex items-center justify-center"
            style={{
                backgroundImage: `url(${bg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
            }}
        >
            <form
                method="POST"
                onSubmit={handleSubmit}
                className="bg-white rounded-3xl shadow-lg shadow-gray-500 p-8 w-full max-w-lg"
            >
                <h1 className="text-4xl font-extrabold text-center mb-6 text-gray-800">Đăng ký</h1>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <input
                        type="text"
                        name="lastName"
                        className="bg-gray-100 shadow-inner rounded-lg p-3 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Họ"
                        maxLength={50}
                        value={formData.lastName}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="text"
                        name="firstName"
                        className="bg-gray-100 shadow-inner rounded-lg p-3 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Tên"
                        maxLength={50}
                        value={formData.firstName}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="grid mb-4">
                    <input
                        type="text"
                        name="numberPhone"
                        className="bg-gray-100 shadow-inner rounded-lg p-3 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none mb-4"
                        placeholder="Số điện thoại"
                        value={formData.numberPhone}
                        onChange={handleChange}
                        required
                    />
                    <input

                        type="date"
                        name="birthday"
                        className={`bg-gray-100 shadow-inner rounded-lg p-3 ${!formData.birthday ? 'text-gray-400' : 'text-gray-700'} focus:ring-2 focus:ring-blue-500 focus:outline-none mb-4`}
                        value={formData.birthday}
                        onChange={handleChange}
                        required
                    />

                    <input
                        type="text"
                        name="address"
                        className="bg-gray-100 shadow-inner rounded-lg p-3 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none mb-4"
                        placeholder="Địa chỉ"
                        value={formData.address}
                        maxLength={70}
                        onChange={handleChange}
                        required
                    />
                    <select
                        name="gender"
                        className={`bg-gray-100 shadow-inner rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none mb-4 ${!formData.gender ? 'text-gray-400' : 'text-black'}`}
                        value={formData.gender}
                        onChange={handleChange}
                        required
                    >
                        <option value='' disabled className="text-gray-400">
                            Giới tính
                        </option>
                        <option value='male'>Nam</option>
                        <option value='female'>Nữ</option>
                    </select>

                    <input
                        type="password"
                        name="password"
                        className={`bg-gray-100 shadow-inner rounded-lg p-3 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                        placeholder="Mật khẩu"
                        value={formData.password}
                        onChange={handleChange}
                        required
                    />
                    {errors.password && <p className="text-red-500 text-sm">{errors.password}</p>}
                    <input
                        type="password"
                        name="confirmPassword"
                        className={`
                        bg-gray-100 shadow-inner rounded-lg p-3 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none mt-4`}
                        placeholder="Nhập lại mật khẩu"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                    />
                    {errors.confirmPassword && (
                        <p className="text-red-500 text-sm ">{errors.confirmPassword}</p>
                    )}
                </div>
                <button
                    onClick={handleSubmit}
                    className="w-full py-3 text-white font-semibold bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg shadow-lg hover:from-blue-600 hover:to-purple-600 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300"
                >
                    Đăng ký
                </button>
                <div className="flex items-center justify-between mt-4 mb-4 text-nowrap ">
                    <label className="block text-gray-600 text-sm font-medium mr-1">
                        <Link className="text-sm text-gray-400 hover:underline">
                            Bạn đã có tài khoản?
                        </Link>
                    </label>
                    <label className="block text-gray-600 text-sm font-medium">
                        <Link to="/login" className="text-sm text-blue-500 hover:underline">
                            Đăng nhập ngay
                        </Link>
                    </label>

                </div>
            </form>
            <ToastContainer position="top-right" autoClose={3000} />
        </div>
    );
}
