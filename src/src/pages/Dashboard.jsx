import { useEffect, useState } from 'react';
import { getDashboardStats } from '../services/dashboardService';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
    const [stats, setStats] = useState({
        totalTenants: 0,
        occupiedUnits: 0,
        vacantUnits: 0,
        totalArrears: 0,
        totalRevenue: 0
    });

    // Mock data for charts - in production, fetch from API
    const revenueData = [
        { month: 'Aug', revenue: 45000 },
        { month: 'Sep', revenue: 52000 },
        { month: 'Oct', revenue: 48000 },
        { month: 'Nov', revenue: 61000 },
        { month: 'Dec', revenue: 55000 },
        { month: 'Jan', revenue: stats.totalRevenue || 58000 }
    ];

    const occupancyData = [
        { name: 'Occupied', value: stats.occupiedUnits },
        { name: 'Vacant', value: stats.vacantUnits }
    ];

    useEffect(() => {
        getDashboardStats().then(data => setStats(data)).catch(console.error);
    }, []);

    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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
                    <p className="text-2xl font-bold text-green-500">KES {stats.totalRevenue?.toLocaleString()}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-lg font-semibold mb-4">Revenue Trend (Last 6 Months)</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={revenueData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip formatter={(value) => `KES ${value.toLocaleString()}`} />
                            <Legend />
                            <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-lg font-semibold mb-4">Occupancy Overview</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={occupancyData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="value" fill="#3b82f6" name="Units" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
