import api from './api';

export const getExpenses = async (params) => {
    const response = await api.get('/expenses', { params });
    return response.data;
};

export const addExpense = async (data) => {
    const response = await api.post('/expenses', data);
    return response.data;
};

export const deleteExpense = async (id) => {
    const response = await api.delete(`/expenses/${id}`);
    return response.data;
};
