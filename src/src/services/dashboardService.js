import api from './api';

export const getDashboardStats = async () => {
    const response = await api.get('/dashboard');
    return response.data;
};

export const getDashboardCharts = async () => {
    const response = await api.get('/dashboard/charts');
    return response.data;
};
