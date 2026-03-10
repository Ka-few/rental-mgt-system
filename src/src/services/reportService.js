import api from './api';

export const getFinancialReport = async (startDate, endDate, propertyId) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (propertyId) params.append('property_id', propertyId);

    const response = await api.get(`/reports/financial?${params.toString()}`);
    return response.data;
};

export const getOccupancyReport = async (propertyId) => {
    const params = new URLSearchParams();
    if (propertyId) params.append('property_id', propertyId);
    const response = await api.get(`/reports/occupancy?${params.toString()}`);
    return response.data;
};

export const getArrearsReport = async (propertyId) => {
    const params = new URLSearchParams();
    if (propertyId) params.append('property_id', propertyId);
    const response = await api.get(`/reports/arrears?${params.toString()}`);
    return response.data;
};

export const getDetailedTransactions = async (startDate, endDate, propertyId, page = 1, limit = 20) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (propertyId) params.append('property_id', propertyId);
    params.append('page', page);
    params.append('limit', limit);

    const response = await api.get(`/reports/transactions?${params.toString()}`);
    return response.data;
};
