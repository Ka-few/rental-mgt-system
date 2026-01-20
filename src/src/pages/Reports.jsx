import { useEffect, useState } from 'react';
import { getFinancialReport, getOccupancyReport, getArrearsReport } from '../services/reportService';
import { exportToExcel, formatDataForExport } from '../utils/export';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

export default function Reports() {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('financial');

    // Financial State
    const [financialData, setFinancialData] = useState({ totalRevenue: 0, totalExpenses: 0, netIncome: 0 });
    const [finFilters, setFinFilters] = useState({ startDate: '', endDate: '' });

    // Occupancy State
    const [occupancyData, setOccupancyData] = useState([]);

    // Arrears State
    const [arrearsData, setArrearsData] = useState([]);
    const [companySettings, setCompanySettings] = useState({});

    useEffect(() => {
        loadData();
        api.get('/settings')
            .then(res => setCompanySettings(res.data))
            .catch(err => console.error('Error fetching settings:', err));
    }, [activeTab]);

    const loadData = async () => {
        try {
            if (activeTab === 'financial') {
                const data = await getFinancialReport(finFilters.startDate, finFilters.endDate);
                setFinancialData(data);
            } else if (activeTab === 'occupancy') {
                const data = await getOccupancyReport();
                setOccupancyData(data);
            } else if (activeTab === 'arrears') {
                const data = await getArrearsReport();
                setArrearsData(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleFilterSubmit = (e) => {
        e.preventDefault();
        loadData();
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExport = () => {
        try {
            let data, filename, fieldMap;

            if (activeTab === 'occupancy') {
                fieldMap = {
                    name: 'Property',
                    total_units: 'Total Units',
                    occupied_units: 'Occupied',
                    vacant_units: 'Vacant',
                    occupancy_rate: 'Occupancy Rate (%)'
                };
                data = formatDataForExport(occupancyData, fieldMap);
                filename = `Occupancy_Report_${new Date().toISOString().split('T')[0]}`;
            } else if (activeTab === 'arrears') {
                fieldMap = {
                    full_name: 'Tenant Name',
                    phone: 'Phone',
                    house: 'House',
                    arrears: 'Outstanding Amount (KES)'
                };
                data = formatDataForExport(arrearsData, fieldMap);
                filename = `Debtors_Report_${new Date().toISOString().split('T')[0]}`;
            } else {
                toast.warning('Financial summary export coming soon');
                return;
            }

            const result = exportToExcel(data, filename);
            if (result.success) {
                toast.success('Report exported successfully!');
            } else {
                toast.error('Failed to export report');
            }
        } catch (err) {
            toast.error('Error exporting report: ' + err.message);
        }
    };

    return (
        <div className="p-4">
            {/* Hidden Print Header */}
            <div className="hidden print:block text-center border-b-2 border-dashed border-gray-400 pb-4 mb-6">
                <h1 className="text-3xl font-black uppercase text-gray-900">{companySettings.company_name || 'REAL ESTATE MANAGEMENT'}</h1>
                <p className="text-gray-600 font-medium">{companySettings.company_address || ''}</p>
                <p className="text-gray-600 font-medium">{companySettings.company_phone || ''}</p>
                <div className="mt-4 flex justify-between text-xs font-bold uppercase tracking-widest text-gray-500">
                    <span>Generated: {new Date().toLocaleString()}</span>
                    <span>Report Type: {activeTab.toUpperCase()}</span>
                </div>
            </div>

            <div className="flex justify-between items-center mb-6 print:hidden">
                <h1 className="text-2xl font-bold">System Reports</h1>
                <div className="flex gap-2">
                    <button onClick={handleExport} className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700">
                        📊 Export to Excel
                    </button>
                    <button onClick={handlePrint} className="bg-gray-800 text-white px-4 py-2 rounded shadow hover:bg-gray-700">
                        🖨 Print / PDF
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b">
                <button
                    onClick={() => setActiveTab('financial')}
                    className={`pb-2 px-4 ${activeTab === 'financial' ? 'border-b-2 border-blue-600 font-bold text-blue-600' : 'text-gray-600'}`}>
                    Financial Summary
                </button>
                <button
                    onClick={() => setActiveTab('occupancy')}
                    className={`pb-2 px-4 ${activeTab === 'occupancy' ? 'border-b-2 border-blue-600 font-bold text-blue-600' : 'text-gray-600'}`}>
                    Occupancy Report
                </button>
                <button
                    onClick={() => setActiveTab('arrears')}
                    className={`pb-2 px-4 ${activeTab === 'arrears' ? 'border-b-2 border-blue-600 font-bold text-blue-600' : 'text-gray-600'}`}>
                    Debtors (Arrears)
                </button>
            </div>

            {/* Content */}
            <div className="bg-white p-6 rounded shadow min-h-[400px]">

                {/* Financial Report */}
                {activeTab === 'financial' && (
                    <div>
                        <h2 className="text-xl font-bold mb-4">Financial Summary</h2>

                        <form onSubmit={handleFilterSubmit} className="flex gap-4 mb-6 items-end bg-gray-50 p-4 rounded">
                            <div>
                                <label className="block text-sm text-gray-600">Start Date</label>
                                <input type="date" className="border p-2 rounded" value={finFilters.startDate} onChange={e => setFinFilters({ ...finFilters, startDate: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600">End Date</label>
                                <input type="date" className="border p-2 rounded" value={finFilters.endDate} onChange={e => setFinFilters({ ...finFilters, endDate: e.target.value })} />
                            </div>
                            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded h-10">Filter</button>
                        </form>

                        <div className="grid grid-cols-3 gap-6">
                            <div className="p-6 bg-green-50 border border-green-200 rounded">
                                <h3 className="text-green-800 font-medium">Total Revenue</h3>
                                <p className="text-2xl font-bold text-green-700">{Math.round(financialData.totalRevenue).toLocaleString()} KES</p>
                            </div>
                            <div className="p-6 bg-red-50 border border-red-200 rounded">
                                <h3 className="text-red-800 font-medium">Expenses (Maintenance)</h3>
                                <p className="text-2xl font-bold text-red-700">{Math.round(financialData.totalExpenses).toLocaleString()} KES</p>
                            </div>
                            <div className="p-6 bg-blue-50 border border-blue-200 rounded">
                                <h3 className="text-blue-800 font-medium">Net Income</h3>
                                <p className="text-2xl font-bold text-blue-700">{Math.round(financialData.netIncome).toLocaleString()} KES</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Occupancy Report */}
                {activeTab === 'occupancy' && (
                    <div>
                        <h2 className="text-xl font-bold mb-4">Occupancy Report</h2>
                        <table className="min-w-full divide-y divide-gray-200 border">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left">Property</th>
                                    <th className="px-6 py-3 text-left">Total Units</th>
                                    <th className="px-6 py-3 text-left">Occupied</th>
                                    <th className="px-6 py-3 text-left">Vacant</th>
                                    <th className="px-6 py-3 text-left">Occupancy Rate</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {occupancyData.length > 0 ? occupancyData.map(d => (
                                    <tr key={d.property_id}>
                                        <td className="px-6 py-4 font-medium">{d.name}</td>
                                        <td className="px-6 py-4">{d.total_units}</td>
                                        <td className="px-6 py-4 text-green-600 font-bold">{d.occupied_units}</td>
                                        <td className="px-6 py-4 text-red-500 font-bold">{d.vacant_units}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <span className="mr-2">{d.occupancy_rate}%</span>
                                                <div className="w-24 bg-gray-200 rounded-full h-2.5">
                                                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${d.occupancy_rate}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )) : <tr><td colSpan="5" className="px-6 py-4 text-center">No data found</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Arrears Report */}
                {activeTab === 'arrears' && (
                    <div>
                        <h2 className="text-xl font-bold mb-4 text-red-600">Debtors Report (Outstanding Arrears)</h2>
                        <table className="min-w-full divide-y divide-gray-200 border">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left">Tenant Name</th>
                                    <th className="px-6 py-3 text-left">Phone</th>
                                    <th className="px-6 py-3 text-left">House</th>
                                    <th className="px-6 py-3 text-left">Outstanding Amount</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {arrearsData.length > 0 ? arrearsData.map(t => (
                                    <tr key={t.id}>
                                        <td className="px-6 py-4 font-medium">{t.full_name}</td>
                                        <td className="px-6 py-4">{t.phone}</td>
                                        <td className="px-6 py-4">{t.house}</td>
                                        <td className="px-6 py-4 text-red-600 font-bold">{t.arrears.toLocaleString()} KES</td>
                                    </tr>
                                )) : <tr><td colSpan="4" className="px-6 py-4 text-center">No debtors found. Everyone is clear!</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
