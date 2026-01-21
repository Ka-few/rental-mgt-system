import api from './api';

export const getProperties = async () => {
    const response = await api.get('/properties');
    return response.data;
};

export const createProperty = async (data) => {
    const response = await api.post('/properties', data);
    return response.data;
};

export const updateProperty = async (id, data) => {
    const response = await api.put(`/properties/${id}`, data);
    return response.data;
};

export const getHouses = async (propertyId) => {
    const response = await api.get(`/properties/${propertyId}/houses`);
    return response.data;
};

export const createHouse = async (propertyId, data) => {
    const response = await api.post(`/properties/${propertyId}/houses`, data);
    return response.data;
};

export const updateHouse = async (id, data) => {
    const response = await api.put(`/properties/houses/${id}`, data);
    return response.data;
};
