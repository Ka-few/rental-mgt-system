import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export default function MRIReports() {
    const toast = useToast();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [selectedDate, setSelectedDate] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
    });

    const loadRecords = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.get('/mri');
            setRecords(data.data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load MRI records');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadRecords();
    }, [loadRecords]);

    const handleCalculate = async () => {
        setCalculating(true);
        try {
            await api.post('/mri/calculate', selectedDate);
            toast.success('MRI record generated/updated successfully');
            loadRecords();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Failed to calculate MRI');
        } finally {
            setCalculating(false);
        }
    };

    const handleFile = async (id) => {
        if (!window.confirm('Marking this record as FILED will lock it from further changes. Continue?')) return;
        try {
            await api.post(`/mri/file/${id}`);
            toast.success('Record filed and locked');
            loadRecords();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to file record');
        }
    };

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            <div className="flex justify-between items-end mb-10">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900">KRA MRI Tax Reports</h1>
                    <p className="text-gray-500 mt-2">Residential Rental Income Tax (7.5%) tracking and filing records.</p>
                </div>
                <div className="flex gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Select Month</label>
                        <select
                            value={selectedDate.month}
                            onChange={e => setSelectedDate({ ...selectedDate, month: parseInt(e.target.value) })}
                            className="bg-gray-50 border-none rounded-lg p-2 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Select Year</label>
                        <select
                            value={selectedDate.year}
                            onChange={e => setSelectedDate({ ...selectedDate, year: parseInt(e.target.value) })}
                            className="bg-gray-50 border-none rounded-lg p-2 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <button
                        onClick={handleCalculate}
                        disabled={calculating}
                        className={`px-6 py-2 rounded-xl font-bold text-white transition-all shadow-lg self-end ${calculating ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95'}`}
                    >
                        {calculating ? 'Processing...' : 'Generate Record'}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-widest">Month / Year</th>
                            <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-widest">Gross Rent Collected</th>
                            <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-widest text-blue-600">MRI Tax (7.5%)</th>
                            <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-widest">Net Income</th>
                            <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-widest">Status</th>
                            <th className="px-8 py-5 text-sm font-black text-gray-400 uppercase tracking-widest">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {records.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="px-8 py-20 text-center text-gray-400 font-medium italic">
                                    No MRI records found. Generate a record to get started.
                                </td>
                            </tr>
                        ) : records.map(record => (
                            <tr key={record.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="px-8 py-6 font-bold text-gray-800">{record.month}</td>
                                <td className="px-8 py-6 font-mono font-medium text-gray-600">KES {record.gross_rent.toLocaleString()}</td>
                                <td className="px-8 py-6 font-mono font-bold text-blue-600">KES {record.tax_payable.toLocaleString()}</td>
                                <td className="px-8 py-6 font-mono font-medium text-emerald-600">KES {record.net_income.toLocaleString()}</td>
                                <td className="px-8 py-6">
                                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${record.status === 'Filed' ? 'bg-emerald-100 text-emerald-700' :
                                            record.status === 'NIL' ? 'bg-gray-100 text-gray-600' :
                                                'bg-amber-100 text-amber-700 animate-pulse'
                                        }`}>
                                        {record.status}
                                    </span>
                                </td>
                                <td className="px-8 py-6 flex gap-3">
                                    {record.status === 'Pending' && (
                                        <button
                                            onClick={() => handleFile(record.id)}
                                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-sm"
                                        >
                                            Mark Filed
                                        </button>
                                    )}
                                    <button
                                        onClick={() => window.print()}
                                        className="px-4 py-2 border-2 border-gray-100 bg-white text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 shadow-sm"
                                    >
                                        Export PDF
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-10 p-8 bg-amber-50 rounded-3xl border-2 border-amber-100">
                <h3 className="text-xl font-bold text-amber-800 flex items-center gap-2 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    KRA Compliance Notice
                </h3>
                <p className="text-amber-700 leading-relaxed">
                    Monthly Residential Rental Income Tax (MRI) must be filed and paid by the <strong>20th day</strong> of the following month.
                    If no rent is received in a month, a <strong>NIL return</strong> must still be filed via iTax.
                    This system provides records for reference only and does not automatically file with KRA.
                </p>
            </div>
        </div>
    );
}
