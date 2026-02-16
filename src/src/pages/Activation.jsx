import React, { useState } from 'react';
import { useLicense } from '../context/LicenseContext';
import { useNavigate } from 'react-router-dom';

export default function Activation() {
    const { license, activateLicense } = useLicense();
    const [productKey, setProductKey] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleActivate = async (e) => {
        e.preventDefault();
        setLoading(true);
        const success = await activateLicense(productKey);
        setLoading(false);
        if (success) {
            navigate('/');
        }
    };

    if (license.status === 'LOADING') {
        return <div className="flex justify-center items-center h-screen">Loading license info...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    Activate Your Product
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    {license.status === 'EXPIRED'
                        ? <span className="text-red-600 font-bold">Your trial has expired.</span>
                        : `Trial Version: ${license.daysRemaining} days remaining.`}
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    <form className="space-y-6" onSubmit={handleActivate}>
                        <div>
                            <label htmlFor="productKey" className="block text-sm font-medium text-gray-700">
                                Product Key
                            </label>
                            <div className="mt-1">
                                <input
                                    id="productKey"
                                    name="productKey"
                                    type="text"
                                    required
                                    value={productKey}
                                    onChange={(e) => setProductKey(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder="XXXX-XXXX-XXXX-XXXX"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${loading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                            >
                                {loading ? 'Activating...' : 'Activate Now'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
