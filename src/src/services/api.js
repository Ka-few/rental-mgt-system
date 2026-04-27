import axios from 'axios';
import { API_URL } from '../config';

const api = axios.create({
    baseURL: `${API_URL}/api`,
});

api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, error => {
    return Promise.reject(error);
});

api.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 401) {
            console.warn(`[API] 401 Unauthorized for: ${error.config.url}. Redirecting to login.`);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // Use hash-compliant redirect
            if (!window.location.hash.includes('/login')) {
                window.location.hash = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
