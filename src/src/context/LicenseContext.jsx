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
        checkLicense();
    }, []);

    const checkLicense = async () => {
        try {
            const res = await api.get('/license/status');
            setLicense(res.data);
        } catch (err) {
            // No changes needed
            console.error('License Check Failed:', err);
            setLicense(prev => ({ ...prev, status: 'ERROR' }));
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
