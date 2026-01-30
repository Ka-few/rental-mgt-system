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

    // Breakdown Modal State
    const [breakdownModal, setBreakdownModal] = useState({
        isOpen: false,
        loading: false,
        transactions: [],
        monthLabel: ''
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

    const handleViewDetails = async (record) => {
        const monthIndex = new Date(Date.parse(record.month + " 1, 2000")).getMonth() + 1; // Parse month name to number
        // Or simpler, if we assume the record.month is "January 2026", we can parse it.
        // Actually, let's just use the selectedDate matching if the record matches selected? 
        // Better: The record is historic. We need to parse "January 2026" back to month/year.

        const [monthName, yearStr] = record.month.split(' ');
        const month = new Date(Date.parse(monthName + " 1, 2000")).getMonth() + 1;
        const year = parseInt(yearStr);

        setBreakdownModal({ isOpen: true, loading: true, transactions: [], monthLabel: record.month });

        try {
            const res = await api.post('/mri/transactions', { month, year });
            setBreakdownModal(prev => ({ ...prev, loading: false, transactions: res.data }));
        } catch (err) {
            console.error(err);
            toast.error('Failed to load transaction details');
            setBreakdownModal(prev => ({ ...prev, loading: false, isOpen: false }));
        }
    };

    const handleExportMRI = async (record) => {
        try {
            const [monthName, yearStr] = record.month.split(' ');
            const month = new Date(Date.parse(monthName + " 1, 2000")).getMonth() + 1;
            const year = parseInt(yearStr);

            const res = await api.post('/mri/transactions', { month, year });
            const transactions = res.data;

            if (!transactions || transactions.length === 0) {
                toast.error('No qualifying rental transactions found for this month');
                return;
            }

            // Dynamically import jsPDF and autotable
            const { default: jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');

            const doc = new jsPDF();

            // Title
            doc.setFontSize(16);
            doc.text(`MRI Report - ${record.month}`, 14, 20);

            // Summary
            doc.setFontSize(10);
            const total = transactions.reduce((sum, t) => sum + t.amount, 0);
            const tax = total * 0.075;
            const net = total - tax;

            doc.text(`Gross Rent Collected: KES ${total.toLocaleString()}`, 14, 30);
            doc.text(`MRI Tax (7.5%): KES ${tax.toLocaleString()}`, 14, 36);
            doc.text(`Net Income: KES ${net.toLocaleString()}`, 14, 42);

            // Table
            const tableData = transactions.map(tx => [
                new Date(tx.date).toLocaleDateString(),
                tx.full_name,
                tx.house_number,
                tx.property_name,
                tx.description,
                `KES ${tx.amount.toLocaleString()}`
            ]);

            autoTable(doc, {
                startY: 50,
                head: [['Date', 'Tenant', 'House', 'Property', 'Description', 'Amount']],
                body: tableData,
                foot: [[{ content: 'Total Qualifying Rent:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } }, `KES ${total.toLocaleString()}`]],
                theme: 'striped',
                headStyles: { fillColor: [59, 130, 246] },
                footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: 'bold' }
            });

            doc.save(`MRI_Report_${record.month.replace(' ', '_')}.pdf`);
            toast.success('MRI report exported successfully');
        } catch (err) {
            console.error('Export error:', err);
            toast.error(err.message || 'Failed to export MRI report');
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

            {/* Revised Table Container: More standard, less "card-like" */}
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
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
                                    <button
                                        onClick={() => handleViewDetails(record)}
                                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-bold shadow-sm"
                                        title="View Breakdown"
                                    >
                                        View Details
                                    </button>
                                    {record.status === 'Pending' && (
                                        <button
                                            onClick={() => handleFile(record.id)}
                                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-sm"
                                        >
                                            Mark Filed
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleExportMRI(record)}
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



            {/* Breakdown Modal */}
            {
                breakdownModal.isOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
                            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                                <h3 className="text-lg font-bold text-gray-800">MRI Breakdown: {breakdownModal.monthLabel}</h3>
                                <button onClick={() => setBreakdownModal({ ...breakdownModal, isOpen: false })} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                            </div>
                            <div className="p-4 overflow-y-auto flex-1">
                                {breakdownModal.loading ? (
                                    <p className="text-center py-10 text-gray-500">Loading details...</p>
                                ) : (
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2">Date</th>
                                                <th className="px-4 py-2">Tenant</th>
                                                <th className="px-4 py-2">House</th>
                                                <th className="px-4 py-2">Description</th>
                                                <th className="px-4 py-2 text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {breakdownModal.transactions.map((tx, idx) => (
                                                <tr key={idx} className="border-b hover:bg-gray-50">
                                                    <td className="px-4 py-2">{new Date(tx.date).toLocaleDateString()}</td>
                                                    <td className="px-4 py-2 font-medium">{tx.full_name}</td>
                                                    <td className="px-4 py-2">{tx.house_number}</td>
                                                    <td className="px-4 py-2 text-gray-500">{tx.description}</td>
                                                    <td className="px-4 py-2 text-right font-mono font-bold">{tx.amount.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                            {breakdownModal.transactions.length === 0 && (
                                                <tr><td colSpan="5" className="text-center py-4 text-gray-500">No qualifying rental payments found.</td></tr>
                                            )}
                                        </tbody>
                                        <tfoot className="border-t-2 border-gray-100 bg-gray-50 font-bold">
                                            <tr>
                                                <td colSpan="4" className="px-4 py-3 text-right">Total Qualifying Rent:</td>
                                                <td className="px-4 py-3 text-right text-blue-600">
                                                    {breakdownModal.transactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                )}
                            </div>
                            <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end">
                                <button
                                    onClick={() => setBreakdownModal({ ...breakdownModal, isOpen: false })}
                                    className="px-4 py-2 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
