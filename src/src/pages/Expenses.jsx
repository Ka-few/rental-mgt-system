import React, { useEffect, useState, useMemo } from 'react';
import { getExpenses, addExpense, deleteExpense } from '../services/expenseService';
import { getProperties } from '../services/propertyService';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

// ─── Shared category list ─────────────────────────────────────────────────────
// Changing this list automatically updates the filter dropdown, the add-form
// dropdown, and the badge colour map in the table.
const EXPENSE_CATEGORIES = [
    'Utilities',
    'Maintenance',
    'Security',
    'Repairs',
    'Cleaning',
    'Insurance',
    'Admin',
    'Staff Wages',
    'Taxes',
    'Other',
];

const CATEGORY_COLORS = {
    Utilities: 'bg-blue-100 text-blue-700',
    Maintenance: 'bg-orange-100 text-orange-700',
    Security: 'bg-purple-100 text-purple-700',
    Repairs: 'bg-yellow-100 text-yellow-700',
    Cleaning: 'bg-teal-100 text-teal-700',
    Insurance: 'bg-indigo-100 text-indigo-700',
    Admin: 'bg-slate-100 text-slate-700',
    'Staff Wages': 'bg-pink-100 text-pink-700',
    Taxes: 'bg-red-100 text-red-700',
    Other: 'bg-gray-100 text-gray-700',
};
// ─────────────────────────────────────────────────────────────────────────────

export default function Expenses() {
    const toast = useToast();
    const [expenses, setExpenses] = useState([]);
    const [properties, setProperties] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null });

    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterProperty, setFilterProperty] = useState('all');

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const [form, setForm] = useState({
        property_id: '',
        category: EXPENSE_CATEGORIES[0],
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        payment_method: 'Cash'
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [expData, propData] = await Promise.all([
                getExpenses(),
                getProperties()
            ]);
            setExpenses(expData);
            setProperties(propData);
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to load data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await addExpense(form);
            toast.success('Expense recorded successfully');
            setIsAddModalOpen(false);
            setForm({
                property_id: '',
                category: EXPENSE_CATEGORIES[0],
                amount: '',
                date: new Date().toISOString().split('T')[0],
                description: '',
                payment_method: 'Cash'
            });
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Error saving expense');
        }
    };

    const handleDelete = async () => {
        try {
            await deleteExpense(confirmDelete.id);
            toast.success('Expense deleted');
            setConfirmDelete({ isOpen: false, id: null });
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Error deleting expense');
        }
    };

    const filteredExpenses = useMemo(() => {
        return expenses.filter(exp => {
            const lowerSearch = debouncedSearchTerm.toLowerCase();
            const matchesSearch = exp.description?.toLowerCase().includes(lowerSearch) ||
                exp.category.toLowerCase().includes(lowerSearch);
            const matchesCategory = filterCategory === 'all' || exp.category === filterCategory;
            const matchesProperty = filterProperty === 'all' || exp.property_id?.toString() === filterProperty;
            return matchesSearch && matchesCategory && matchesProperty;
        });
    }, [expenses, debouncedSearchTerm, filterCategory, filterProperty]);

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Operational Expenses</h1>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                >
                    + Record Expense
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Search</label>
                    <input
                        type="text"
                        placeholder="Search description..."
                        className="w-full border-gray-200 border rounded-lg p-2 outline-none focus:border-emerald-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-48">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Category</label>
                    <select
                        className="w-full border-gray-200 border rounded-lg p-2 outline-none focus:border-emerald-500"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <option value="all">All Categories</option>
                        {EXPENSE_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
                <div className="w-48">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Property</label>
                    <select
                        className="w-full border-gray-200 border rounded-lg p-2 outline-none focus:border-emerald-500"
                        value={filterProperty}
                        onChange={(e) => setFilterProperty(e.target.value)}
                    >
                        <option value="all">All Properties</option>
                        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                        <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Category</th>
                            <th className="px-6 py-4">Property</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4 text-right">Amount</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredExpenses.map(exp => (
                            <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 text-sm whitespace-nowrap">{new Date(exp.date).toLocaleDateString()}</td>
                                <td className="px-6 py-4 font-medium">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${CATEGORY_COLORS[exp.category] || CATEGORY_COLORS['Other']}`}>
                                        {exp.category}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">{exp.property_name || 'General Office'}</td>
                                <td className="px-6 py-4 text-sm italic text-gray-400">{exp.description || '-'}</td>
                                <td className="px-6 py-4 text-right font-bold text-gray-900">{exp.amount.toLocaleString()} KES</td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => setConfirmDelete({ isOpen: true, id: exp.id })}
                                        className="text-gray-300 hover:text-red-500 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredExpenses.length === 0 && (
                            <tr>
                                <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                                    No expenses recorded for this selection.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-emerald-50">
                            <h2 className="text-xl font-bold text-emerald-900">Record Expenditure</h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left">
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">Associate Property</label>
                                <select
                                    className="w-full border-gray-200 border rounded-xl p-3 outline-none focus:border-emerald-500"
                                    value={form.property_id}
                                    onChange={(e) => setForm(prev => ({ ...prev, property_id: e.target.value }))}
                                >
                                    <option value="">General/Office Expense</option>
                                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1">Category</label>
                                    <select
                                        className="w-full border-gray-200 border rounded-xl p-3 outline-none focus:border-emerald-500"
                                        required
                                        value={form.category}
                                        onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                                    >
                                        {EXPENSE_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1">Amount (KES)</label>
                                    <input
                                        type="number"
                                        className="w-full border-gray-200 border rounded-xl p-3 outline-none focus:border-emerald-500"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={form.amount}
                                        onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">Description</label>
                                <input
                                    type="text"
                                    className="w-full border-gray-200 border rounded-xl p-3 outline-none focus:border-emerald-500"
                                    placeholder="e.g. Electricity token for common areas"
                                    value={form.description}
                                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">Date</label>
                                <input
                                    type="date"
                                    className="w-full border-gray-200 border rounded-xl p-3 outline-none focus:border-emerald-500"
                                    required
                                    value={form.date}
                                    onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
                                >
                                    Save Expense
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, id: null })}
                onConfirm={handleDelete}
                title="Delete Expenditure"
                message="Are you sure you want to remove this expense record? This will affect your financial reports."
            />
        </div>
    );
}
