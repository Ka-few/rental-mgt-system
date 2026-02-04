import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { API_URL } from '../config';
import api from '../services/api';
import { changePassword } from '../services/authService';

const LocalInput = ({ label, name, value, onChange, placeholder, type = "text", className = "", focusClass = "focus:border-emerald-500" }) => {
    const [localValue, setLocalValue] = useState(value || '');

    useEffect(() => {
        setLocalValue(value || '');
    }, [value]);

    const handleBlur = () => {
        if (localValue !== value) {
            onChange({ target: { name, value: localValue } });
        }
    };

    return (
        <div className={className}>
            <label className="block text-gray-600 text-sm font-bold mb-2 ml-1 uppercase tracking-tight">{label}</label>
            <input
                type={type}
                name={name}
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={handleBlur}
                placeholder={placeholder}
                className={`w-full border-2 border-gray-100 bg-gray-50 p-4 rounded-xl ${focusClass} focus:bg-white transition-all outline-none text-gray-800 font-medium placeholder-gray-300`}
            />
        </div>
    );
};

const Settings = () => {
    const toast = useToast();
    const [settings, setSettings] = useState({
        company_name: '',
        company_address: '',
        company_phone: '',
        mri_enabled: 'false',
        penalty_enabled: 'false',
        penalty_type: 'Fixed',
        penalty_amount: '0'
    });

    // Password change state
    const [pwdForm, setPwdForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        showCurrent: false,
        showNew: false,
        showConfirm: false
    });

    useEffect(() => {
        api.get('/settings')
            .then(res => setSettings(res.data))
            .catch(err => console.error('Error fetching settings:', err));
    }, []);

    const handleChange = (e) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const handlePwdChange = (e) => {
        setPwdForm({ ...pwdForm, [e.target.name]: e.target.value });
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        try {
            await api.post('/settings', {
                company_name: settings.company_name,
                company_address: settings.company_address,
                company_phone: settings.company_phone,
                mri_enabled: settings.mri_enabled,
                penalty_enabled: settings.penalty_enabled,
                penalty_type: settings.penalty_type,
                penalty_amount: settings.penalty_amount
            });
            toast.success('Settings updated successfully!');
        } catch (err) {
            console.error('Settings Update Error:', err);
            toast.error(err.response?.data?.message || 'Failed to save settings. Please ensure the server is running.');
        }
    };

    const handleBackup = () => {
        window.location.href = `${API_URL}/api/settings/backup`;
    };

    const handleClearData = async () => {
        if (!window.confirm('WARNING: This will permanently delete ALL tenants, houses, properties, and transactions. This action CANNOT be undone. Are you absolutely sure?')) {
            return;
        }

        try {
            await api.post('/settings/clear');
            toast.success('System data cleared successfully!');
            setTimeout(() => window.location.reload(), 2000);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Failed to clear system data');
        }
    };

    const onUpdatePassword = async (e) => {
        e.preventDefault();

        console.log('Form submission started');

        if (pwdForm.newPassword !== pwdForm.confirmPassword) {
            return toast.error('New passwords do not match');
        }
        if (pwdForm.newPassword.length < 6) {
            return toast.error('Password must be at least 6 characters');
        }

        try {
            console.log('Calling changePassword service...');
            const result = await changePassword({
                currentPassword: pwdForm.currentPassword,
                newPassword: pwdForm.newPassword
            });
            console.log('Password change success:', result);
            toast.success('Password updated successfully!');
            setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            console.error('Frontend Password Error Detail:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message
            });
            const errorMsg = err.response?.data?.message || 'Current password incorrect';
            toast.error(errorMsg);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 pb-20">
            <h1 className="text-3xl font-extrabold mb-8 text-gray-900 border-b pb-4">System Settings</h1>

            {/* Company Profile Section */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-8">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Company Profile</h2>
                </div>
                <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <LocalInput
                        className="md:col-span-2"
                        label="Company Name"
                        name="company_name"
                        value={settings.company_name}
                        onChange={handleChange}
                        placeholder="e.g. Royal Apartments Ltd"
                    />
                    <LocalInput
                        label="Address"
                        name="company_address"
                        value={settings.company_address}
                        onChange={handleChange}
                        placeholder="e.g. 123 Business Way, Nairobi"
                    />
                    <LocalInput
                        label="Support Phone"
                        name="company_phone"
                        value={settings.company_phone}
                        onChange={handleChange}
                        placeholder="e.g. +254 700 000 000"
                    />
                    <div className="md:col-span-2">
                        <button type="submit" className="bg-emerald-600 text-white px-10 py-4 rounded-xl font-black hover:bg-emerald-700 transition-all shadow-xl hover:shadow-emerald-200 active:scale-95">
                            SAVE COMPANY PROFILE
                        </button>
                    </div>
                </form>
            </div>

            {/* KRA MRI Settings Section */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-8">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 00-2 2z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">KRA MRI Tax Settings</h2>
                </div>
                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div>
                            <h3 className="font-bold text-gray-800">Enable MRI Tracking</h3>
                            <p className="text-sm text-gray-500">Automatically calculate 7.5% Residential Rental Income Tax</p>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, mri_enabled: settings.mri_enabled === 'true' ? 'false' : 'true' })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings.mri_enabled === 'true' ? 'bg-blue-600' : 'bg-gray-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.mri_enabled === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    {settings.mri_enabled === 'true' && (
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-800 text-sm">
                            <p className="font-bold mb-1">MRI Eligibility Rules:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Applies to Residential properties only</li>
                                <li>Annual income must be between KES 288,000 and KES 15,000,000</li>
                                <li>Rate: 7.5% of gross rent collected</li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* Penalty Settings Section */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-8">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-red-100 rounded-xl text-red-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Penalty Configuration</h2>
                </div>
                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div>
                            <h3 className="font-bold text-gray-800">Enable Automatic Penalties</h3>
                            <p className="text-sm text-gray-500">Apply after 2 consecutive months of unpaid rent</p>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, penalty_enabled: settings.penalty_enabled === 'true' ? 'false' : 'true' })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings.penalty_enabled === 'true' ? 'bg-red-600' : 'bg-gray-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.penalty_enabled === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {settings.penalty_enabled === 'true' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div>
                                <label className="block text-gray-600 text-sm font-bold mb-2 ml-1">Penalty Type</label>
                                <select
                                    name="penalty_type"
                                    value={settings.penalty_type}
                                    onChange={handleChange}
                                    className="w-full border-2 border-gray-100 p-3 rounded-xl outline-none focus:border-red-500"
                                >
                                    <option value="Fixed">Fixed Amount (KES)</option>
                                    <option value="Percentage">Percentage of Arrears (%)</option>
                                </select>
                            </div>
                            <LocalInput
                                type="number"
                                name="penalty_amount"
                                label={settings.penalty_type === 'Fixed' ? 'Amount (KES)' : 'Rate (%)'}
                                value={settings.penalty_amount}
                                onChange={handleChange}
                                focusClass="focus:border-red-500"
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="mb-12">
                <button onClick={handleSave} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black text-lg hover:bg-black transition-all shadow-2xl active:scale-[0.98]">
                    SAVE ALL CONFIGURATIONS
                </button>
            </div>

            {/* Security Section */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-8">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">Security</h2>
                    </div>
                </div>

                <form onSubmit={onUpdatePassword} className="space-y-6">
                    <div className="max-w-md relative">
                        <LocalInput
                            type={pwdForm.showCurrent ? "text" : "password"}
                            name="currentPassword"
                            label="Current Password"
                            value={pwdForm.currentPassword}
                            onChange={handlePwdChange}
                            placeholder="••••••••"
                            focusClass="focus:border-amber-500"
                        />
                        <button
                            type="button"
                            onClick={() => setPwdForm({ ...pwdForm, showCurrent: !pwdForm.showCurrent })}
                            className="absolute right-4 top-11 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <i className={`bx ${pwdForm.showCurrent ? 'bx-hide' : 'bx-show'} text-xl`}></i>
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="relative">
                            <LocalInput
                                type={pwdForm.showNew ? "text" : "password"}
                                name="newPassword"
                                label="New Password"
                                value={pwdForm.newPassword}
                                onChange={handlePwdChange}
                                placeholder="Min. 6 chars"
                                focusClass="focus:border-amber-500"
                            />
                            <button
                                type="button"
                                onClick={() => setPwdForm({ ...pwdForm, showNew: !pwdForm.showNew })}
                                className="absolute right-4 top-11 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <i className={`bx ${pwdForm.showNew ? 'bx-hide' : 'bx-show'} text-xl`}></i>
                            </button>
                        </div>
                        <div className="relative">
                            <LocalInput
                                type={pwdForm.showConfirm ? "text" : "password"}
                                name="confirmPassword"
                                label="Confirm New"
                                value={pwdForm.confirmPassword}
                                onChange={handlePwdChange}
                                placeholder="••••••••"
                                focusClass="focus:border-amber-500"
                            />
                            <button
                                type="button"
                                onClick={() => setPwdForm({ ...pwdForm, showConfirm: !pwdForm.showConfirm })}
                                className="absolute right-4 top-11 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <i className={`bx ${pwdForm.showConfirm ? 'bx-hide' : 'bx-show'} text-xl`}></i>
                            </button>
                        </div>
                    </div>
                    <button type="submit" className="bg-amber-600 text-white px-10 py-4 rounded-xl font-black hover:bg-amber-700 transition-all shadow-xl hover:shadow-amber-200 active:scale-95">
                        UPDATE PASSWORD
                    </button>
                </form>
            </div>

            {/* Advanced Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" /><path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                        Export Database
                    </h3>
                    <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                        Securely download your current system data to a local file for safekeeping.
                    </p>
                    <button
                        onClick={handleBackup}
                        className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
                        Download Backup
                    </button>
                </div>

                <div className="bg-red-50 p-8 rounded-2xl shadow-sm border-2 border-red-100">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-600 uppercase italic">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.41-1.196 2.102-1.196 2.512 0l.96 2.833a1.5 1.5 0 001.077 1.077l2.833.96c1.196.41 1.196 2.102 0 2.512l-2.833.96a1.5 1.5 0 00-1.077 1.077l-.96 2.833c-.41 1.196-2.102 1.196-2.512 0l-.96-2.833a1.5 1.5 0 00-1.077-1.077l-2.833-.96c-1.196-.41-1.196-2.102 0-2.512l2.833-.96a1.5 1.5 0 001.077-1.077l.96-2.833z" clipRule="evenodd" /></svg>
                        Wipe System Data
                    </h3>
                    <p className="text-red-700 text-xs font-bold mb-8 uppercase leading-tight bg-white/50 p-3 rounded-lg border border-red-200">
                        CAUTION: This will delete ALL tenants, houses, and transactions. The app will be reset as if new. This action is IRREVERSIBLE.
                    </p>
                    <button
                        onClick={handleClearData}
                        className="w-full py-4 bg-white text-red-600 border-2 border-red-600 rounded-xl font-black hover:bg-red-600 hover:text-white transition-all active:scale-95"
                    >
                        RESET ALL DATA
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Settings;


