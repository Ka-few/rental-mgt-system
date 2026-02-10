import React, { useEffect, useState } from 'react';
import { getUsers, registerUser, deleteUser, updateUser } from '../services/userService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Users() {
    const toast = useToast();
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null });

    // Password Visibility States
    const [showPassword, setShowPassword] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [form, setForm] = useState({
        username: '',
        password: '',
        confirmPassword: '',
        currentPassword: '',
        role: 'staff'
    });

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setIsLoading(true);
        try {
            const data = await getUsers();
            setUsers(data);
        } catch (err) {
            toast.error('Failed to load users: ' + (err.response?.data?.message || err.message));
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenAddModal = () => {
        setIsEditMode(false);
        setEditingId(null);
        setForm({ username: '', password: '', confirmPassword: '', currentPassword: '', role: 'staff' });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (user) => {
        setIsEditMode(true);
        setEditingId(user.id);
        setForm({
            username: user.username,
            password: '',
            confirmPassword: '',
            currentPassword: '',
            role: user.role
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (form.password && form.password !== form.confirmPassword) {
            return toast.error('Passwords do not match');
        }

        try {
            if (isEditMode) {
                await updateUser(editingId, {
                    username: form.username,
                    role: form.role,
                    currentPassword: form.currentPassword,
                    newPassword: form.password
                });
                toast.success('User updated successfully');
            } else {
                await registerUser({
                    username: form.username,
                    password: form.password,
                    role: form.role
                });
                toast.success('User registered successfully');
            }
            setIsModalOpen(false);
            loadUsers();
        } catch (err) {
            toast.error('Error: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleDelete = async () => {
        try {
            await deleteUser(confirmDelete.id);
            toast.success('User deleted successfully');
            setConfirmDelete({ isOpen: false, id: null });
            loadUsers();
        } catch (err) {
            toast.error('Error deleting user: ' + (err.response?.data?.message || err.message));
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <LoadingSpinner size="lg" text="Loading system users..." />
            </div>
        );
    }

    if (currentUser.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h2 className="text-xl font-bold">Access Denied</h2>
                <p>Only administrators can manage system users.</p>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
                <button
                    onClick={handleOpenAddModal}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    + Create New User
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                        <tr>
                            <th className="px-6 py-4">Username</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Joined Date</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-bold text-indigo-900">{user.username}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-400">
                                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Initial'}
                                </td>
                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                    <button
                                        onClick={() => handleOpenEditModal(user)}
                                        className="text-gray-400 hover:text-indigo-600 transition-colors"
                                        title="Edit User"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    {user.id !== currentUser.id && user.role !== 'admin' && (
                                        <button
                                            onClick={() => setConfirmDelete({ isOpen: true, id: user.id })}
                                            className="text-gray-300 hover:text-red-500 transition-colors"
                                            title="Delete User"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className={`p-6 border-b border-gray-100 ${isEditMode ? 'bg-amber-50' : 'bg-indigo-50'}`}>
                            <h2 className={`text-xl font-bold ${isEditMode ? 'text-amber-900' : 'text-indigo-900'}`}>
                                {isEditMode ? 'Update User Account' : 'Register New Staff'}
                            </h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left">
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">Username</label>
                                <input
                                    type="text"
                                    className="w-full border-gray-200 border rounded-xl p-3 outline-none focus:border-indigo-500"
                                    required
                                    placeholder="Enter login username"
                                    value={form.username}
                                    onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
                                />
                            </div>

                            {/* Role Selection */}
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">System Role</label>
                                <select
                                    className="w-full border-gray-200 border rounded-xl p-3 outline-none focus:border-indigo-500"
                                    value={form.role}
                                    onChange={(e) => setForm(prev => ({ ...prev, role: e.target.value }))}
                                >
                                    <option value="staff">Staff (Standard Access)</option>
                                    <option value="admin">Administrator (Full Access)</option>
                                </select>
                            </div>

                            {/* Password Fields */}
                            <div className="border-t pt-4 mt-4 space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
                                    {isEditMode ? 'Security & Passwords' : 'Password Setup'}
                                </h3>

                                {isEditMode && editingId === currentUser.id && (
                                    <div className="relative">
                                        <label className="block text-sm font-bold text-gray-600 mb-1">Current Password</label>
                                        <input
                                            type={showCurrentPassword ? "text" : "password"}
                                            className="w-full border-gray-200 border rounded-xl p-3 outline-none focus:border-amber-500"
                                            placeholder="Verify current password"
                                            value={form.currentPassword}
                                            onChange={(e) => setForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                                            required={isEditMode && editingId === currentUser.id && form.password}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                            className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                                        >
                                            <i className={`bx ${showCurrentPassword ? 'bx-hide' : 'bx-show'} text-xl`}></i>
                                        </button>
                                    </div>
                                )}

                                <div className="relative">
                                    <label className="block text-sm font-bold text-gray-600 mb-1">
                                        {isEditMode ? 'New Password (Optional)' : 'Password'}
                                    </label>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        className="w-full border-gray-200 border rounded-xl p-3 outline-none focus:border-indigo-500"
                                        required={!isEditMode}
                                        placeholder={isEditMode ? "Leave blank to keep current" : "Min 6 characters"}
                                        value={form.password}
                                        onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                                    >
                                        <i className={`bx ${showPassword ? 'bx-hide' : 'bx-show'} text-xl`}></i>
                                    </button>
                                </div>

                                <div className="relative">
                                    <label className="block text-sm font-bold text-gray-600 mb-1">Confirm {isEditMode ? 'New' : ''} Password</label>
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        className="w-full border-gray-200 border rounded-xl p-3 outline-none focus:border-indigo-500"
                                        required={!!form.password}
                                        placeholder="Repeat your password"
                                        value={form.confirmPassword}
                                        onChange={(e) => setForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                                    >
                                        <i className={`bx ${showConfirmPassword ? 'bx-hide' : 'bx-show'} text-xl`}></i>
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={`flex-1 px-4 py-3 rounded-xl text-white font-bold transition-all shadow-lg ${isEditMode ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
                                >
                                    {isEditMode ? 'Update User' : 'Register Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, id: null })}
                onConfirm={handleDelete}
                title="Deactivate Account"
                message="Are you sure you want to remove this staff member? They will lose all access to the system immediately."
            />
        </div>
    );
}
