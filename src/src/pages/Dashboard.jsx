import { useEffect, useState } from 'react';
import { getDashboardStats } from '../services/dashboardService';

export default function Dashboard() {
    const [stats, setStats] = useState({
        totalTenants: 0,
        occupiedUnits: 0,
        vacantUnits: 0,
        totalArrears: 0,
        totalRevenue: 0
    });

    useEffect(() => {
        getDashboardStats().then(data => setStats(data)).catch(console.error);
    }, []);

    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-gray-500 text-sm">Total Tenants</h3>
                    <p className="text-2xl font-bold">{stats.totalTenants}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-gray-500 text-sm">Occupied Units</h3>
                    <p className="text-2xl font-bold">{stats.occupiedUnits}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-gray-500 text-sm">Vacant Units</h3>
                    <p className="text-2xl font-bold">{stats.vacantUnits}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-gray-500 text-sm">Total Revenue</h3>
                    <p className="text-2xl font-bold text-green-500">KES {stats.totalRevenue}</p>
                </div>
            </div>
        </div>
    );
}
