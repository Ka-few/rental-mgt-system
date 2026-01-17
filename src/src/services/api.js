import axios from 'axios';

// In dev, Vite proxies /api to http://localhost:3000
// In prod (Electron), we might need full URL if not served by same server.
// For Electron "started by main process", we usually can use localhost:3000 locally.
// Or usage of ipcRenderer is safer, but HTTP is easier for standard React.

const api = axios.create({
    baseURL: 'http://localhost:3000/api',
});

export default api;
