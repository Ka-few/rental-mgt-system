import api from './api';

export const getFinancialReport = async (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get(`/reports/financial?${params.toString()}`);
    return response.data;
};

export const getOccupancyReport = async () => {
    const response = await api.get('/reports/occupancy');
    return response.data;
};

export const getArrearsReport = async () => {
    const response = await api.get('/reports/arrears');
    return response.data;
};

export const getDetailedTransactions = async (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get(`/reports/transactions?${params.toString()}`);
    return response.data;
};
