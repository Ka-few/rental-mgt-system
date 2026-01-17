import api from './api';

export const getTransactions = async (tenantId) => {
    const response = await api.get(`/finance/tenant/${tenantId}`);
    return response.data;
};

export const getBalances = async () => {
    const response = await api.get('/finance/balances');
    return response.data;
};

export const recordPayment = async (data) => {
    const response = await api.post('/finance/payment', data);
    return response.data;
};

export const addCharge = async (data) => {
    const response = await api.post('/finance/charge', data);
    return response.data;
};

export const updateTransaction = async (id, data) => {
    const response = await api.put(`/finance/transactions/${id}`, data);
    return response.data;
};
