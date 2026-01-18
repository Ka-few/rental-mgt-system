import { useEffect, useState } from 'react';
import { getBalances, recordPayment, addCharge, getTransactions, updateTransaction, runMonthlyRent } from '../services/financeService';
import { getTenants } from '../services/tenantService';
import { useToast } from '../context/ToastContext';

export default function Finance() {
    const toast = useToast();
    const [balances, setBalances] = useState([]);
    const [tenants, setTenants] = useState([]);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);

    // History & Edit States
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedTenantTransactions, setSelectedTenantTransactions] = useState([]);
    const [selectedTenantName, setSelectedTenantName] = useState('');
    const [selectedTenantId, setSelectedTenantId] = useState(null);
    const [editingTransaction, setEditingTransaction] = useState(null);

    const [payForm, setPayForm] = useState({
        tenant_id: '',
        amount: '',
        payment_method: 'M-Pesa',
        description: '',
        reference_code: '',
        date: new Date().toISOString().split('T')[0]
    });
    const [chargeForm, setChargeForm] = useState({ tenant_id: '', type: 'Rent Charge', amount: '', description: '' });
    const [companySettings, setCompanySettings] = useState({});

    useEffect(() => {
        loadData();
        getTenants().then(setTenants).catch(console.error);
        fetch('http://localhost:3000/api/settings')
            .then(res => res.json())
            .then(data => setCompanySettings(data))
            .catch(err => console.error('Error fetching settings:', err));
    }, []);

    const loadData = () => {
        getBalances().then(setBalances).catch(console.error);
    };

    const handlePaySubmit = async (e) => {
        e.preventDefault();
        try {
            await recordPayment(payForm);
            setIsPayModalOpen(false);
            loadData();
            setPayForm({
                tenant_id: '',
                amount: '',
                payment_method: 'M-Pesa',
                description: '',
                reference_code: '',
                date: new Date().toISOString().split('T')[0]
            });
            toast.success('Payment recorded successfully!');
        } catch (err) {
            toast.error(err.message || 'Failed to record payment');
        }
    };

    const handleChargeSubmit = async (e) => {
        e.preventDefault();
        try {
            await addCharge(chargeForm);
            setIsChargeModalOpen(false);
            loadData();
            setChargeForm({ tenant_id: '', type: 'Rent Charge', amount: '', description: '' });
            toast.success('Charge added successfully!');
        } catch (err) {
            toast.error(err.message || 'Failed to add charge');
        }
    };

    const handleViewHistory = async (tenant) => {
        try {
            const transactions = await getTransactions(tenant.tenant_id);
            setSelectedTenantTransactions(transactions);
            setSelectedTenantName(tenant.full_name);
            setSelectedTenantId(tenant.tenant_id);
            setIsHistoryModalOpen(true);
            setEditingTransaction(null);
        } catch (err) {
            console.error(err);
            toast.error('Error loading transaction history');
        }
    };

    const handleRentRun = async () => {
        if (!window.confirm('Are you sure you want to generate rent charges for ALL active tenants?')) return;

        try {
            const res = await runMonthlyRent();
            toast.success(res.message || 'Monthly rent generated successfully!');
            loadData();
        } catch (err) {
            toast.error(err.message || 'Failed to generate rent');
        }
    };

    const handlePrintReceipt = (transaction) => {
        const printWindow = window.open('', '', 'width=600,height=600');
        printWindow.document.write(`
            <html>
            <head>
                <title>Payment Receipt</title>
                <style>
                    body { font-family: 'Courier New', monospace; padding: 20px; }
                    .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 20px; }
                    .details { margin-bottom: 20px; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
                    .total { border-top: 2px dashed #000; padding-top: 10px; font-weight: bold; font-size: 1.2em; }
                    .footer { text-align: center; margin-top: 40px; font-size: 0.8em; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>${companySettings.company_name || 'PAYMENT RECEIPT'}</h2>
                    <p>${companySettings.company_address || 'Rental Management System'}</p>
                    <p>${companySettings.company_phone || ''}</p>
                </div>
                <div class="details">
                    <div class="row"><span>Date:</span> <span>${new Date(transaction.date).toLocaleDateString()}</span></div>
                    <div class="row"><span>Receipt No:</span> <span>${transaction.id}</span></div>
                    <div class="row"><span>Tenant:</span> <span>${selectedTenantName}</span></div>
                    <div class="row"><span>Property:</span> <span>${balances.find(b => b.tenant_id === selectedTenantId)?.property_name || 'N/A'}</span></div>
                    <div class="row"><span>Unit:</span> <span>${balances.find(b => b.tenant_id === selectedTenantId)?.house_number || 'N/A'}</span></div>
                    <div class="row"><span>Method:</span> <span>${transaction.payment_method}</span></div>
                    ${transaction.reference_code ? `<div class="row"><span>Ref:</span> <span>${transaction.reference_code}</span></div>` : ''}
                </div>
                <div class="details">
                   <div class="row"><span>Description:</span> <span>${transaction.description || 'Rent Payment'}</span></div>
                </div>
                <div class="row total">
                    <span>AMOUNT PAID:</span>
                    <span>${transaction.amount.toLocaleString()} KES</span>
                </div>
                <div class="footer">
                    <p>Received By: __________________________</p>
                    <p>Thank you for your payment!</p>
                </div>
                <script>
                    window.onload = function() { window.print(); window.close(); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleEditClick = (transaction) => {
        setEditingTransaction({ ...transaction });
    };

    const handleEditSave = async (e) => {
        e.preventDefault();
        try {
            await updateTransaction(editingTransaction.id, editingTransaction);
            // Refresh history
            const transactions = await getTransactions(selectedTenantId);
            setSelectedTenantTransactions(transactions);
            setEditingTransaction(null);
            loadData(); // Refresh main balances
            toast.success('Transaction updated successfully!');
        } catch (err) {
            toast.error('Error updating transaction: ' + err.message);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Finance & Payments</h1>
                <div className="space-x-2">
                    <button onClick={handleRentRun} className="bg-purple-600 text-white px-4 py-2 rounded">Run Monthly Rent</button>
                    <button onClick={() => setIsChargeModalOpen(true)} className="bg-red-600 text-white px-4 py-2 rounded">Add Charge</button>
                    <button onClick={() => setIsPayModalOpen(true)} className="bg-green-600 text-white px-4 py-2 rounded">Record Payment</button>
                </div>
            </div>

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
                                    <button onClick={() => handleViewHistory(b)} className="text-blue-600 hover:underline">View History</button>
                                </td>
                            </tr>
                        ))}
                        {balances.length === 0 && <tr><td colSpan="4" className="p-4 text-center">No financial records found.</td></tr>}
                    </tbody>
                </table>
            </div>

            {/* Payment Modal */}
            {isPayModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded w-96">
                        <h3 className="text-lg font-bold mb-4">Record Payment</h3>
                        <form onSubmit={handlePaySubmit}>
                            <select className="border w-full p-2 mb-2" required value={payForm.tenant_id} onChange={e => setPayForm({ ...payForm, tenant_id: e.target.value })}>
                                <option value="">Select Tenant</option>
                                {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                            </select>
                            <input type="number" className="border w-full p-2 mb-2" placeholder="Amount" required value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} />
                            <select className="border w-full p-2 mb-2" value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}>
                                <option>M-Pesa</option>
                                <option>Cash</option>
                                <option>Bank</option>
                            </select>
                            <input className="border w-full p-2 mb-2" placeholder="Ref Code (Optional)" value={payForm.reference_code} onChange={e => setPayForm({ ...payForm, reference_code: e.target.value })} />
                            <label className="block text-sm text-gray-600 mb-1">Payment Date</label>
                            <input type="date" className="border w-full p-2 mb-2" required value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} />
                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setIsPayModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Charge Modal */}
            {isChargeModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded w-96">
                        <h3 className="text-lg font-bold mb-4">Add Charge</h3>
                        <form onSubmit={handleChargeSubmit}>
                            <select className="border w-full p-2 mb-2" required value={chargeForm.tenant_id} onChange={e => setChargeForm({ ...chargeForm, tenant_id: e.target.value })}>
                                <option value="">Select Tenant</option>
                                {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                            </select>
                            <select className="border w-full p-2 mb-2" value={chargeForm.type} onChange={e => setChargeForm({ ...chargeForm, type: e.target.value })}>
                                <option>Rent Charge</option>
                                <option>Water Bill</option>
                                <option>Garbage</option>
                                <option>Security</option>
                                <option>Adjustment</option>
                            </select>
                            <input type="number" className="border w-full p-2 mb-2" placeholder="Amount" required value={chargeForm.amount} onChange={e => setChargeForm({ ...chargeForm, amount: e.target.value })} />
                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setIsChargeModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded w-3/4 max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center mb-4 p-4 border-b">
                            <h3 className="text-lg font-bold">Transaction History: {selectedTenantName}</h3>
                            <button onClick={() => setIsHistoryModalOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
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
                                        {selectedTenantTransactions.map((t) => (
                                            <tr key={t.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {new Date(t.date).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${t.type === 'Payment' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                        }`}>
                                                        {t.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {t.description || '-'}
                                                    {t.type === 'Payment' && t.payment_method && ` via ${t.payment_method}`}
                                                </td>
                                                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${t.type === 'Payment' ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                    {t.type === 'Payment' ? '+' : '-'} {t.amount.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-2">
                                                    <button onClick={() => handleEditClick(t)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                                    {t.type === 'Payment' && (
                                                        <button onClick={() => handlePrintReceipt(t)} className="text-gray-600 hover:text-gray-900 border px-2 py-0.5 rounded text-xs">🖨 Print</button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {selectedTenantTransactions.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">No transactions found.</td>
                                            </tr>
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
                                <button onClick={() => setIsHistoryModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded text-gray-800 hover:bg-gray-300">Close</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
