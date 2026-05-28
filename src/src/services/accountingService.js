import api from './api';

export const getChartOfAccounts = async () => {
    const response = await api.get('/accounting/accounts');
    return response.data;
};

export const getProfitAndLoss = async () => {
    const response = await api.get('/accounting/pl');
    return response.data;
};

export const getBalanceSheet = async () => {
    const response = await api.get('/accounting/balance-sheet');
    return response.data;
};

export const getJournalEntries = async () => {
    const response = await api.get('/accounting/journal');
    return response.data;
};
