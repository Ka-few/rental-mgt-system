import api from './api';

export const getArticles = async () => {
    const response = await api.get('/help');
    return response.data;
};

export const searchArticles = async (query) => {
    const response = await api.get(`/help/search?q=${query}`);
    return response.data;
};

export const getArticleDetails = async (slug) => {
    const response = await api.get(`/help/article/${slug}`);
    return response.data;
};

export const getUserHelpProgress = async (userId) => {
    const response = await api.get(`/help/progress/${userId}`);
    return response.data;
};

export const updateHelpProgress = async (data) => {
    const response = await api.post('/help/progress', data);
    return response.data;
};
