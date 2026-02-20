import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import syncService from '../services/syncService';

const Synchronization = () => {
    const toast = useToast();
    const { user } = useAuth();

    const [info, setInfo] = useState({
        device_id: '',
        owner_url: '',
        last_sync_timestamp: '',
        is_registered: false
    });
    const [ownerUrl, setOwnerUrl] = useState('');
    const [deviceName, setDeviceName] = useState('');
    const [syncing, setSyncing] = useState(false);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        loadInfo();
    }, []);

    const loadInfo = async () => {
        try {
            const data = await syncService.getSyncInfo();
            setInfo(data);
            setOwnerUrl(data.owner_url || '');
        } catch (err) {
            console.error('Error loading sync info:', err);
        }
    };

    const handleRegister = async () => {
        if (!ownerUrl) return toast.error('Owner URL is required.');
        try {
            toast.success('Registering device...');
            await syncService.register(ownerUrl, deviceName);
            toast.success('Device registered successfully!');
            loadInfo();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Registration failed.');
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        setStats(null);
        try {
            toast.success('Sync started...');
            const result = await syncService.syncNow();
            setStats(result.stats);
            toast.success('Synchronization completed!');
            loadInfo();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Sync failed.');
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 pb-20">
            <h1 className="text-3xl font-extrabold mb-8 text-gray-900 border-b pb-4">Synchronization</h1>

            {/* Device Identity */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Device Identity</h2>
                </div>
                <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Local Device ID</p>
                        <p className="text-sm font-mono text-gray-700 break-all">{info.device_id || 'Generating...'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${info.is_registered ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {info.is_registered ? 'REGISTERED' : 'UNREGISTERED'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Registration Settings */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-8">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Connection Settings</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="md:col-span-2">
                        <label className="block text-gray-600 text-sm font-bold mb-2 ml-1 uppercase">Owner Server URL / IP</label>
                        <input
                            type="text"
                            value={ownerUrl}
                            onChange={(e) => setOwnerUrl(e.target.value)}
                            placeholder="e.g. http://192.168.1.10:3000"
                            className="w-full border-2 border-gray-100 bg-gray-50 p-4 rounded-xl focus:border-emerald-500 focus:bg-white transition-all outline-none"
                        />
                        <p className="text-xs text-gray-400 mt-2 px-1 italic">Enter the local IP address or Domain of the Owner computer.</p>
                    </div>
                    <div>
                        <label className="block text-gray-600 text-sm font-bold mb-2 ml-1 uppercase">Caretaker Name</label>
                        <input
                            type="text"
                            value={deviceName}
                            onChange={(e) => setDeviceName(e.target.value)}
                            placeholder="e.g. Main Branch Caretaker"
                            className="w-full border-2 border-gray-100 bg-gray-50 p-4 rounded-xl focus:border-emerald-500 focus:bg-white transition-all outline-none"
                        />
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={handleRegister}
                        disabled={info.is_registered}
                        className={`flex-1 py-4 px-6 rounded-xl font-black text-white transition-all shadow-lg ${info.is_registered ? 'bg-gray-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'}`}
                    >
                        {info.is_registered ? 'DEVICE ALREADY REGISTERED' : 'REGISTER WITH OWNER'}
                    </button>
                    {info.is_registered && (
                        <button
                            onClick={() => {
                                if (window.confirm('Forget registration and re-register?')) {
                                    handleRegister();
                                }
                            }}
                            className="p-4 bg-gray-100 text-gray-400 rounded-xl hover:bg-gray-200"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Sync Logic */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">Incremental Sync</h2>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                        <p className="text-blue-500 font-bold uppercase text-xs tracking-widest mb-2">Last Synchronized</p>
                        <p className="text-2xl font-black text-blue-900">
                            {info.last_sync_timestamp ? new Date(info.last_sync_timestamp).toLocaleString() : 'Never'}
                        </p>
                    </div>
                    <div className="flex items-center">
                        <button
                            onClick={handleSync}
                            disabled={!info.is_registered || syncing}
                            className={`w-full py-6 rounded-2xl font-black text-xl transition-all shadow-xl flex items-center justify-center gap-4 ${!info.is_registered || syncing ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'}`}
                        >
                            {syncing ? (
                                <>
                                    <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    SYNCING...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    SYNC NOW
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {stats && (
                    <div className="mt-8 p-6 bg-gray-50 rounded-2xl border border-gray-100 grid grid-cols-2 gap-4">
                        <div className="text-center p-4">
                            <p className="text-gray-400 font-bold text-xs uppercase mb-1">Pushed</p>
                            <p className="text-3xl font-black text-gray-800">{stats.pushed}</p>
                            <p className="text-xs text-gray-400">local updates sent</p>
                        </div>
                        <div className="text-center p-4 border-l">
                            <p className="text-gray-400 font-bold text-xs uppercase mb-1">Pulled</p>
                            <p className="text-3xl font-black text-gray-800">{stats.pulled}</p>
                            <p className="text-xs text-gray-400">server updates received</p>
                        </div>
                    </div>
                )}

                <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-100 text-amber-800 text-sm">
                    <p className="font-bold flex items-center gap-2 mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                        Important Notes:
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>Automatic sync attempts every 3 hours while the app is open.</li>
                        <li>Owner data always takes priority if a conflict is detected.</li>
                        <li>Ensure you have a stable network connection during synchronization.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Synchronization;
