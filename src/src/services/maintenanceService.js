import api from './api';

export const getRequests = async () => {
    const response = await api.get('/maintenance');
    return response.data;
};

export const createRequest = async (data) => {
    const response = await api.post('/maintenance', data);
    return response.data;
};

export const updateRequest = async (id, data) => {
    const response = await api.put(`/maintenance/${id}`, data);
    return response.data;
};
