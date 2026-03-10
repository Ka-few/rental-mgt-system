import api from './api';

export const getTenants = async (propertyId) => {
    const params = new URLSearchParams();
    if (propertyId) params.append('property_id', propertyId);
    const response = await api.get(`/tenants?${params.toString()}`);
    return response.data;
};

export const createTenant = async (tenantData) => {
    const response = await api.post('/tenants', tenantData);
    return response.data;
};

export const updateTenant = async (id, data) => {
    const response = await api.put(`/tenants/${id}`, data);
    return response.data;
};

export const deleteTenant = async (id) => {
    const response = await api.delete(`/tenants/${id}`);
    return response.data;
};
