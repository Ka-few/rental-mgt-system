import { useEffect, useState } from 'react';
import { getDashboardStats, getDashboardCharts } from '../services/dashboardService';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Dashboard() {
    const [stats, setStats] = useState({
        totalTenants: 0,
        occupiedUnits: 0,
        vacantUnits: 0,
        totalArrears: 0,
        totalRevenue: 0
    });
    const [revenueData, setRevenueData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const occupancyData = [
        { name: 'Occupied', value: stats.occupiedUnits },
        { name: 'Vacant', value: stats.vacantUnits }
    ];

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const [statsData, chartsData] = await Promise.all([
                    getDashboardStats(),
                    getDashboardCharts()
                ]);
                setStats(statsData);
                setRevenueData(chartsData);
            } catch (err) {
                console.error('Failed to load dashboard:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadDashboard();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <LoadingSpinner size="lg" text="Analyzing real estate data..." />
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Total Tenants</h3>
                    <p className="text-2xl font-black text-slate-900">{stats.totalTenants}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Occupied Units</h3>
                    <p className="text-2xl font-black text-blue-600">{stats.occupiedUnits}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Vacant Units</h3>
                    <p className="text-2xl font-black text-rose-500">{stats.vacantUnits}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Total Revenue</h3>
                    <p className="text-2xl font-black text-emerald-600">KES {stats.totalRevenue?.toLocaleString()}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-lg font-bold mb-4 text-slate-800 border-b pb-2">Revenue Trend (Last 6 Months)</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={revenueData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `KES ${val.toLocaleString()}`} />
                            <Tooltip formatter={(value) => `KES ${value.toLocaleString()}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                            <Legend />
                            <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} name="Actual Revenue" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-lg font-bold mb-4 text-slate-800 border-b pb-2">Occupancy Overview</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={occupancyData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                            <Legend />
                            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Units" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
