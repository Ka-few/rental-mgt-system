import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from './ToastContext';

const LicenseContext = createContext(null);

export const LicenseProvider = ({ children }) => {
    const [license, setLicense] = useState({
        status: 'LOADING', // LOADING, TRIAL, ACTIVE, EXPIRED
        daysRemaining: null,
        message: ''
    });
    const toast = useToast();

    useEffect(() => {
        // Only check license if we have a token (user is authenticated)
        const token = localStorage.getItem('token');
        if (token) {
            checkLicense();
        } else {
            // No token, set to TRIAL so the route can redirect to login
            setLicense({ status: 'TRIAL', daysRemaining: 7, message: 'Not authenticated' });
        }
    }, []);

    const checkLicense = async () => {
        try {
            const res = await api.get('/license/status');
            setLicense(res.data);
        } catch (err) {
            console.error('License Check Failed:', err);
            // On network/auth error, fall back to TRIAL rather than ERROR
            // This prevents a blank screen; PrivateRoute will handle auth redirect
            setLicense({ status: 'TRIAL', daysRemaining: 0, message: 'License check unavailable' });
        }
    };

    const activateLicense = async (key) => {
        try {
            const res = await api.post('/license/activate', { productKey: key });
            toast.success(res.data.message);
            await checkLicense();
            return true;
        } catch (err) {
            toast.error(err.response?.data?.error || 'Activation failed');
            return false;
        }
    };

    return (
        <LicenseContext.Provider value={{ license, activateLicense, checkLicense }}>
            {children}
        </LicenseContext.Provider>
    );
};

export const useLicense = () => useContext(LicenseContext);
