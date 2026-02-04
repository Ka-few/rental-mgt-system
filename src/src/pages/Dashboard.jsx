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
        totalRevenue: 0,
        totalExpenses: 0
    });
    const [revenueData, setRevenueData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const occupancyData = [
        { name: 'Occupied', value: stats.occupiedUnits },
        { name: 'Vacant', value: stats.vacantUnits }
    ];

    const loadDashboard = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [statsData, chartsData] = await Promise.all([
                getDashboardStats(),
                getDashboardCharts()
            ]);
            setStats(statsData);
            setRevenueData(chartsData);
        } catch (err) {
            console.error('Failed to load dashboard:', err);
            setError('Could not connect to the server. Please check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadDashboard();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <LoadingSpinner size="lg" text="Analyzing real estate data..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 bg-rose-50 rounded-2xl border border-rose-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-rose-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h2 className="text-xl font-bold text-rose-900 mb-2">Data Load Failed</h2>
                <p className="text-rose-600 mb-6 max-w-sm">{error}</p>
                <button
                    onClick={loadDashboard}
                    className="bg-rose-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200"
                >
                    Retry Connection
                </button>
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 group hover:shadow-md transition-shadow">
                    <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1 group-hover:text-blue-500 transition-colors">Total Tenants</h3>
                    <p className="text-3xl font-black text-slate-800">{stats.totalTenants}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 group hover:shadow-md transition-shadow">
                    <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1 group-hover:text-amber-500 transition-colors">Occupancy</h3>
                    <p className="text-3xl font-black text-slate-800">
                        <span className="text-blue-600">{stats.occupiedUnits}</span>
                        <span className="text-gray-200 mx-2">/</span>
                        <span className="text-gray-400 text-xl">{stats.occupiedUnits + stats.vacantUnits}</span>
                    </p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 group hover:shadow-md transition-shadow">
                    <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1 group-hover:text-emerald-500 transition-colors">Total Revenue</h3>
                    <p className="text-3xl font-black text-emerald-600">KES {stats.totalRevenue?.toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 group hover:shadow-md transition-shadow">
                    <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1 group-hover:text-rose-500 transition-colors">Total Expenses</h3>
                    <p className="text-3xl font-black text-rose-500">KES {stats.totalExpenses?.toLocaleString()}</p>
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
