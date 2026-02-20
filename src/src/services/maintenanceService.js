import api from './api';

export const getMaintenanceRequests = async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await api.get(`/maintenance?${params}`);
    return response.data;
};

export const getMaintenanceRequestById = async (id) => {
    const response = await api.get(`/maintenance/${id}`);
    return response.data;
};

export const createMaintenanceRequest = async (formData) => {
    const response = await api.post('/maintenance', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

export const updateMaintenanceStatus = async (id, status) => {
    const response = await api.put(`/maintenance/${id}/status`, { status });
    return response.data;
};

export const logMaintenanceExpense = async (id, formData) => {
    const response = await api.post(`/maintenance/${id}/expense`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

export const approveMaintenanceExpense = async (id) => {
    const response = await api.post(`/maintenance/${id}/approve`);
    return response.data;
};

export const rejectMaintenanceExpense = async (id, rejection_note) => {
    const response = await api.post(`/maintenance/${id}/reject`, { rejection_note });
    return response.data;
};
