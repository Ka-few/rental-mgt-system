import React, { useState, useEffect } from 'react';

const Settings = () => {
    const [settings, setSettings] = useState({
        company_name: '',
        company_address: '',
        company_phone: ''
    });

    useEffect(() => {
        fetch('http://localhost:3000/api/settings')
            .then(res => res.json())
            .then(data => setSettings(data))
            .catch(err => console.error('Error fetching settings:', err));
    }, []);

    const handleChange = (e) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:3000/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (res.ok) alert('Settings saved successfully!');
            else alert('Failed to save settings');
        } catch (err) {
            console.error(err);
            alert('Error saving settings');
        }
    };

    const handleBackup = () => {
        window.location.href = 'http://localhost:3000/api/settings/backup';
    };

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">System Settings</h1>

            <div className="bg-white p-6 rounded shadow mb-6">
                <h2 className="text-xl font-semibold mb-4">Company Details (For Receipts)</h2>
                <form onSubmit={handleSave}>
                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-2">Company Name</label>
                        <input
                            name="company_name"
                            value={settings.company_name || ''}
                            onChange={handleChange}
                            className="w-full border p-2 rounded"
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-2">Address</label>
                        <input
                            name="company_address"
                            value={settings.company_address || ''}
                            onChange={handleChange}
                            className="w-full border p-2 rounded"
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-2">Phone</label>
                        <input
                            name="company_phone"
                            value={settings.company_phone || ''}
                            onChange={handleChange}
                            className="w-full border p-2 rounded"
                        />
                    </div>
                    <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                        Save Details
                    </button>
                </form>
            </div>

            <div className="bg-white p-6 rounded shadow mb-6">
                <h2 className="text-xl font-semibold mb-4">Data Management</h2>
                <p className="text-gray-600 mb-4">
                    Download a backup of your database. Keep this file safe. To restore, you will need to manually replace the database file.
                </p>
                <button
                    onClick={handleBackup}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Download Database Backup
                </button>
            </div>
        </div>
    );
};

export default Settings;
