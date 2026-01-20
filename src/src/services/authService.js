import api from './api';

export const changePassword = async ({ currentPassword, newPassword }) => {
    const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword
    });
    return response.data;
};
