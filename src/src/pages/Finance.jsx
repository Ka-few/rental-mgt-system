import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { getBalances, recordPayment, addCharge, getTransactions, updateTransaction, runMonthlyRent, applyPenalties } from '../services/financeService';
import { getTenants } from '../services/tenantService';
import { getProperties } from '../services/propertyService';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import api from '../services/api';

// --- Sub-components to isolate state and performance ---

const BalanceTable = React.memo(({ balances, onViewHistory }) => {
    return (
        <div className="bg-white rounded shadow overflow-hidden">
            <h3 className="p-4 font-bold border-b">Tenant Account Balances</h3>
            <table className="min-w-full">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left">Tenant</th>
                        <th className="px-6 py-3 text-left">Unit</th>
                        <th className="px-6 py-3 text-left">Balance (Positive = Credit, Negative = Arrears)</th>
                        <th className="px-6 py-3 text-left">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {balances.map(b => (
                        <tr key={b.tenant_id} className="border-t">
                            <td className="px-6 py-4">
                                <div className="font-medium">{b.full_name}</div>
                                <div className="text-xs text-gray-500">{b.property_name}</div>
                            </td>
                            <td className="px-6 py-4">{b.house_number}</td>
                            <td className={`px-6 py-4 font-bold ${b.balance < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {b.balance?.toLocaleString()} KES
                            </td>
                            <td className="px-6 py-4">
                                <button onClick={() => onViewHistory(b)} className="text-blue-600 hover:underline">View History</button>
                            </td>
                        </tr>
                    ))}
                    {balances.length === 0 && <tr><td colSpan="4" className="p-4 text-center">No financial records found.</td></tr>}
                </tbody>
            </table>
        </div>
    );
});

const RecordPaymentModal = ({ isOpen, onClose, tenants, onSuccess }) => {
    const toast = useToast();
    const [form, setForm] = useState({
        tenant_id: '',
        amount: '',
        payment_method: 'M-Pesa',
        description: '',
        reference_code: '',
        date: new Date().toISOString().split('T')[0]
    });

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await recordPayment(form);
            onSuccess();
            onClose();
            toast.success('Payment recorded successfully!');
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to record payment');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded w-96">
                <h3 className="text-lg font-bold mb-4">Record Payment</h3>
                <form onSubmit={handleSubmit}>
                    <select className="border w-full p-2 mb-2" required value={form.tenant_id} onChange={e => setForm({ ...form, tenant_id: e.target.value })}>
                        <option value="">Select Tenant</option>
                        {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                    </select>
                    <input type="number" className="border w-full p-2 mb-2" placeholder="Amount" required value={form.amount} onFocus={(e) => e.target.select()} onChange={e => setForm({ ...form, amount: e.target.value })} />
                    <select className="border w-full p-2 mb-2" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
                        <option>M-Pesa</option>
                        <option>Cash</option>
                        <option>Bank</option>
                    </select>
                    <input className="border w-full p-2 mb-2" placeholder="Ref Code (Optional)" value={form.reference_code} onChange={e => setForm({ ...form, reference_code: e.target.value })} />
                    <label className="block text-sm text-gray-600 mb-1">Payment Date</label>
                    <input type="date" className="border w-full p-2 mb-2" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AddChargeModal = ({ isOpen, onClose, tenants, onSuccess }) => {
    const toast = useToast();
    const [form, setForm] = useState({ tenant_id: '', type: 'Rent Charge', amount: '', description: '' });

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await addCharge(form);
            onSuccess();
            onClose();
            toast.success('Charge added successfully!');
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to add charge');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded w-96">
                <h3 className="text-lg font-bold mb-4">Add Charge</h3>
                <form onSubmit={handleSubmit}>
                    <select className="border w-full p-2 mb-2" required value={form.tenant_id} onChange={e => setForm({ ...form, tenant_id: e.target.value })}>
                        <option value="">Select Tenant</option>
                        {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                    </select>
                    <select className="border w-full p-2 mb-2" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                        <option>Rent Charge</option>
                        <option>Water Bill</option>
                        <option>Garbage</option>
                        <option>Security</option>
                        <option>Adjustment</option>
                    </select>
                    <input type="number" className="border w-full p-2 mb-2" placeholder="Amount" required value={form.amount} onFocus={(e) => e.target.select()} onChange={e => setForm({ ...form, amount: e.target.value })} />
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const HistoryModal = ({ isOpen, onClose, tenant, balances, companySettings, refreshBalances }) => {
    const toast = useToast();
    const [transactions, setTransactions] = useState([]);
    const [editingTransaction, setEditingTransaction] = useState(null);

    useEffect(() => {
        if (isOpen && tenant) {
            getTransactions(tenant.tenant_id).then(setTransactions).catch(console.error);
        }
    }, [isOpen, tenant]);

    if (!isOpen || !tenant) return null;

    const handlePrintReceipt = async (transaction) => {
        try {
            const { default: jsPDF } = await import('jspdf');
            const doc = new jsPDF({ format: [100, 150], unit: 'mm' }); // Smaller size for receipt

            const companyName = companySettings.company_name || 'REAL ESTATE MANAGEMENT';
            const companyAddress = companySettings.company_address || '';
            const companyPhone = companySettings.company_phone || '';

            // Header
            doc.setFillColor(30, 41, 59);
            doc.rect(0, 0, 100, 25, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(companyName.toUpperCase(), 50, 12, { align: 'center' });

            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text(companyAddress, 50, 18, { align: 'center' });
            doc.text(`Phone: ${companyPhone}`, 50, 22, { align: 'center' });

            // Receipt Title
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('PAYMENT RECEIPT', 50, 35, { align: 'center' });

            // Details
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');

            let y = 45;
            const drawRow = (label, value) => {
                doc.setFont('helvetica', 'bold');
                doc.text(label, 10, y);
                doc.setFont('helvetica', 'normal');
                doc.text(String(value), 90, y, { align: 'right' });
                y += 6;
            };

            const tenantBalance = balances.find(b => b.tenant_id === tenant.tenant_id);

            drawRow('Receipt No:', transaction.id);
            drawRow('Date:', new Date(transaction.date).toLocaleDateString());
            drawRow('Tenant:', tenant.full_name);
            drawRow('Property:', tenantBalance?.property_name || 'N/A');
            drawRow('House:', tenantBalance?.house_number || 'N/A');
            drawRow('Method:', transaction.payment_method || 'N/A');
            if (transaction.reference_code) drawRow('Ref:', transaction.reference_code);
            drawRow('Description:', transaction.description || 'Rent Payment');

            y += 4;
            doc.setDrawColor(200, 200, 200);
            doc.line(10, y, 90, y);
            y += 8;

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('AMOUNT PAID:', 10, y);
            doc.text(`KES ${transaction.amount.toLocaleString()}`, 90, y, { align: 'right' });

            y += 15;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.text('Received By: __________________________', 50, y, { align: 'center' });
            y += 10;
            doc.text('Thank you for your payment!', 50, y, { align: 'center' });

            doc.save(`Receipt_${tenant.full_name.replace(/\s+/g, '_')}_${transaction.id}.pdf`);
            toast.success('Receipt generated successfully');
        } catch (err) {
            console.error('Receipt error:', err);
            toast.error('Failed to generate receipt');
        }
    };

    const handleExportStatement = async () => {
        try {
            const { default: jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');
            const doc = new jsPDF();

            const companyName = companySettings.company_name || 'REAL ESTATE MANAGEMENT';
            const companyAddress = companySettings.company_address || '';
            const companyPhone = companySettings.company_phone || '';
            const companyEmail = companySettings.company_email || '';

            // Header branding
            doc.setFillColor(30, 41, 59);
            doc.rect(0, 0, 210, 40, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text(companyName.toUpperCase(), 14, 20);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(companyAddress, 14, 28);
            doc.text(`Phone: ${companyPhone} | Email: ${companyEmail}`, 14, 34);

            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('ACCOUNT STATEMENT', 196, 20, { align: 'right' });
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Generated: ${new Date().toLocaleDateString()}`, 196, 28, { align: 'right' });

            // Tenant/Property Info Box
            doc.setTextColor(0, 0, 0);
            doc.setFillColor(248, 250, 252);
            doc.rect(14, 45, 182, 30, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.rect(14, 45, 182, 30, 'S');

            const tenantBalance = balances.find(b => b.tenant_id === tenant.tenant_id);

            doc.setFont('helvetica', 'bold');
            doc.text('TENANT DETAILS', 20, 52);
            doc.setFont('helvetica', 'normal');
            doc.text(`Name: ${tenant.full_name}`, 20, 60);
            doc.text(`House: ${tenantBalance?.house_number || 'N/A'}`, 20, 66);
            doc.text(`Property: ${tenantBalance?.property_name || 'N/A'}`, 100, 60);

            const currentBalance = tenantBalance?.balance || 0;
            doc.setFont('helvetica', 'bold');
            doc.text(`Current Balance: KES ${currentBalance.toLocaleString()}`, 100, 66);

            // Table
            const tableData = transactions.map(t => [
                new Date(t.date).toLocaleDateString(),
                t.type,
                `${t.description || '-'} ${t.payment_method ? `(via ${t.payment_method})` : ''}`,
                `${t.type === 'Payment' ? '+' : '-'}${t.amount.toLocaleString()}`
            ]);

            autoTable(doc, {
                startY: 80,
                head: [['Date', 'Type', 'Description', 'Amount (KES)']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
                columnStyles: { 3: { halign: 'right' } }
            });

            doc.save(`Statement_${tenant.full_name.replace(/\s+/g, '_')}.pdf`);
            toast.success('Statement exported successfully');
        } catch (err) {
            console.error('Statement error:', err);
            toast.error('Failed to export statement');
        }
    };

    const handleEditSave = async (e) => {
        e.preventDefault();
        try {
            await updateTransaction(editingTransaction.id, editingTransaction);
            const res = await getTransactions(tenant.tenant_id);
            setTransactions(res);
            setEditingTransaction(null);
            refreshBalances();
            toast.success('Transaction updated successfully!');
        } catch (err) {
            toast.error('Error updating transaction: ' + err.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded w-3/4 max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-4 p-4 border-b">
                    <div className="flex items-center gap-4">
                        <h3 className="text-lg font-bold">Transaction History: {tenant.full_name}</h3>
                        <button
                            onClick={handleExportStatement}
                            className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            <i className="bx bx-printer"></i> Export Statement
                        </button>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                <div className="overflow-y-auto p-4 flex-1">
                    {!editingTransaction ? (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {transactions.map((t) => (
                                    <tr key={t.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(t.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${t.type === 'Payment' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {t.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {t.description || '-'}
                                            {t.type === 'Payment' && t.payment_method && ` via ${t.payment_method} `}
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${t.type === 'Payment' ? 'text-green-600' : 'text-red-600'}`}>
                                            {t.type === 'Payment' ? '+' : '-'} {t.amount.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-2">
                                            <button onClick={() => setEditingTransaction({ ...t })} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                            {t.type === 'Payment' && (
                                                <button onClick={() => handlePrintReceipt(t)} className="text-gray-600 hover:text-gray-900 border px-2 py-0.5 rounded text-xs">🖨 Print</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {transactions.length === 0 && (
                                    <tr><td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">No transactions found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <div className="bg-gray-50 p-4 rounded">
                            <h4 className="font-bold mb-4">Edit Transaction</h4>
                            <form onSubmit={handleEditSave}>
                                <div className="mb-2">
                                    <label className="block text-sm font-medium text-gray-700">Type</label>
                                    <input type="text" disabled value={editingTransaction.type} className="mt-1 block w-full p-2 border border-gray-300 rounded bg-gray-100" />
                                </div>
                                <div className="mb-2">
                                    <label className="block text-sm font-medium text-gray-700">Date</label>
                                    <input type="date" value={new Date(editingTransaction.date).toISOString().split('T')[0]}
                                        onChange={e => setEditingTransaction({ ...editingTransaction, date: e.target.value })}
                                        className="mt-1 block w-full p-2 border border-gray-300 rounded" required />
                                </div>
                                <div className="mb-2">
                                    <label className="block text-sm font-medium text-gray-700">Amount</label>
                                    <input type="number" value={editingTransaction.amount}
                                        onFocus={(e) => e.target.select()}
                                        onChange={e => setEditingTransaction({ ...editingTransaction, amount: e.target.value })}
                                        className="mt-1 block w-full p-2 border border-gray-300 rounded" required />
                                </div>
                                <div className="mb-2">
                                    <label className="block text-sm font-medium text-gray-700">Description</label>
                                    <input type="text" value={editingTransaction.description || ''}
                                        onChange={e => setEditingTransaction({ ...editingTransaction, description: e.target.value })}
                                        className="mt-1 block w-full p-2 border border-gray-300 rounded" />
                                </div>
                                {editingTransaction.type === 'Payment' && (
                                    <>
                                        <div className="mb-2">
                                            <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                                            <select value={editingTransaction.payment_method || 'M-Pesa'}
                                                onChange={e => setEditingTransaction({ ...editingTransaction, payment_method: e.target.value })}
                                                className="mt-1 block w-full p-2 border border-gray-300 rounded">
                                                <option>M-Pesa</option>
                                                <option>Cash</option>
                                                <option>Bank</option>
                                            </select>
                                        </div>
                                        <div className="mb-2">
                                            <label className="block text-sm font-medium text-gray-700">Reference Code</label>
                                            <input type="text" value={editingTransaction.reference_code || ''}
                                                onChange={e => setEditingTransaction({ ...editingTransaction, reference_code: e.target.value })}
                                                className="mt-1 block w-full p-2 border border-gray-300 rounded" />
                                        </div>
                                    </>
                                )}
                                <div className="flex justify-end gap-2 mt-4">
                                    <button type="button" onClick={() => setEditingTransaction(null)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>

                {!editingTransaction && (
                    <div className="p-4 border-t bg-gray-50 flex justify-end">
                        <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded text-gray-800 hover:bg-gray-300">Close</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Main Finance Component ---

export default function Finance() {
    const toast = useToast();
    const [balances, setBalances] = useState([]);
    const [tenants, setTenants] = useState([]);
    const [companySettings, setCompanySettings] = useState({});

    // Modal Visibility States
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [properties, setProperties] = useState([]);
    const [selectedProperty, setSelectedProperty] = useState('');

    useEffect(() => {
        loadData();
        getTenants(selectedProperty).then(setTenants).catch(console.error);
        getProperties().then(setProperties).catch(console.error);
        api.get('/settings')
            .then(res => setCompanySettings(res.data))
            .catch(err => console.error('Error fetching settings:', err));
    }, [selectedProperty]);

    const loadData = useCallback(() => {
        getBalances(selectedProperty).then(setBalances).catch(console.error);
    }, [selectedProperty]);

    const handleRentRun = async () => {
        const propertyName = selectedProperty ? properties.find(p => p.id === selectedProperty)?.name : 'ALL';
        if (!window.confirm(`Are you sure you want to generate rent charges for active tenants in ${propertyName}?`)) return;
        try {
            const res = await runMonthlyRent(selectedProperty);
            toast.success(res.message || 'Monthly rent generated successfully!');
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to generate rent');
        }
    };

    const handleApplyPenalties = async () => {
        const propertyName = selectedProperty ? properties.find(p => p.id === selectedProperty)?.name : 'ALL';
        if (!window.confirm(`This will apply late payment penalties to defaulted tenants in ${propertyName}. Continue?`)) return;
        try {
            const res = await applyPenalties(selectedProperty);
            if (res.success) {
                toast.success(res.message);
                loadData();
            } else {
                toast.info(res.message);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to apply penalties');
        }
    };

    const handleViewHistory = useCallback((tenant) => {
        setSelectedTenant(tenant);
        setIsHistoryModalOpen(true);
    }, []);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Finance & Payments</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <label className="text-sm font-medium text-gray-600">Filter Property:</label>
                        <select
                            className="border p-2 rounded text-sm bg-white shadow-sm"
                            value={selectedProperty}
                            onChange={(e) => setSelectedProperty(e.target.value)}
                        >
                            <option value="">All Properties</option>
                            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="space-x-2">
                    <button onClick={handleApplyPenalties} className="bg-amber-600 text-white px-4 py-2 rounded shadow hover:bg-amber-700 transition-colors">Apply Penalties</button>
                    <button onClick={handleRentRun} className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 transition-colors">Run Monthly Rent</button>
                    <button onClick={() => setIsChargeModalOpen(true)} className="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 transition-colors">Add Charge</button>
                    <button onClick={() => setIsPayModalOpen(true)} className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 transition-colors">Record Payment</button>
                </div>
            </div>

            <BalanceTable balances={balances} onViewHistory={handleViewHistory} />

            <RecordPaymentModal
                isOpen={isPayModalOpen}
                onClose={() => setIsPayModalOpen(false)}
                tenants={tenants}
                onSuccess={loadData}
            />

            <AddChargeModal
                isOpen={isChargeModalOpen}
                onClose={() => setIsChargeModalOpen(false)}
                tenants={tenants}
                onSuccess={loadData}
            />

            <HistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                tenant={selectedTenant}
                balances={balances}
                companySettings={companySettings}
                refreshBalances={loadData}
            />
        </div>
    );
}
