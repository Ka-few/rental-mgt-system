import { useEffect, useState } from 'react';
import {
    getMaintenanceRequests,
    createMaintenanceRequest,
    updateMaintenanceStatus,
    logMaintenanceExpense,
    approveMaintenanceExpense,
    rejectMaintenanceExpense,
    getMaintenanceRequestById
} from '../services/maintenanceService';
import { getProperties, getHouses } from '../services/propertyService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Pagination from '../components/Pagination';

export default function Maintenance() {
    const toast = useToast();
    const { user } = useAuth();
    const [requests, setRequests] = useState([]);
    const [properties, setProperties] = useState([]);
    const [availableHouses, setAvailableHouses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

    // Filters
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterProperty, setFilterProperty] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Form states
    const [formData, setFormData] = useState({
        property_id: '',
        house_id: '',
        title: '',
        description: '',
        priority: 'Normal',
        issue_image: null
    });

    const [expenseData, setExpenseData] = useState({
        amount: '',
        description: '',
        receipt: null
    });

    const [rejectionNote, setRejectionNote] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [reqs, props] = await Promise.all([
                getMaintenanceRequests(),
                getProperties()
            ]);
            setRequests(reqs);
            setProperties(props);
        } catch (err) {
            toast.error('Failed to load maintenance data');
        } finally {
            setLoading(false);
        }
    };

    const handlePropertyChange = async (e) => {
        const propertyId = e.target.value;
        setFormData({ ...formData, property_id: propertyId, house_id: '' });
        if (propertyId) {
            const houses = await getHouses(propertyId);
            setAvailableHouses(houses);
        } else {
            setAvailableHouses([]);
        }
    };

    const handleReportIssue = async (e) => {
        e.preventDefault();
        const submitData = new FormData();
        submitData.append('house_id', formData.house_id);
        submitData.append('title', formData.title);
        submitData.append('description', formData.description);
        submitData.append('priority', formData.priority);
        if (formData.issue_image) {
            submitData.append('issue_image', formData.issue_image);
        }

        try {
            await createMaintenanceRequest(submitData);
            toast.success('Maintenance request reported');
            setIsAddModalOpen(false);
            loadData();
            setFormData({ property_id: '', house_id: '', title: '', description: '', priority: 'Normal', issue_image: null });
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to report issue');
        }
    };

    const handleUpdateStatus = async (id, status) => {
        try {
            await updateMaintenanceStatus(id, status);
            toast.success(`Status updated to ${status}`);
            if (selectedRequest) {
                const updated = await getMaintenanceRequestById(id);
                setSelectedRequest(updated);
            }
            loadData();
        } catch (err) {
            toast.error('Failed to update status');
        }
    };

    const handleLogExpense = async (e) => {
        e.preventDefault();
        if (!expenseData.receipt) {
            toast.error('Receipt image is required');
            return;
        }

        const submitData = new FormData();
        submitData.append('amount', expenseData.amount);
        submitData.append('description', expenseData.description);
        submitData.append('receipt', expenseData.receipt);

        try {
            await logMaintenanceExpense(selectedRequest.id, submitData);
            toast.success('Expense logged and sent for approval');
            setIsExpenseModalOpen(false);
            setIsDetailModalOpen(false);
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to log expense');
        }
    };

    const handleApprove = async (id) => {
        try {
            await approveMaintenanceExpense(id);
            toast.success('Request approved and expense recorded');
            setIsDetailModalOpen(false);
            loadData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Approval failed');
        }
    };

    const handleReject = async (id) => {
        try {
            await rejectMaintenanceExpense(id, rejectionNote);
            toast.success('Request rejected and returned to caretaker');
            setIsDetailModalOpen(false);
            loadData();
            setRejectionNote('');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Rejection failed');
        }
    };

    const openDetails = async (request) => {
        try {
            const detailed = await getMaintenanceRequestById(request.id);
            setSelectedRequest(detailed);
            setIsDetailModalOpen(true);
        } catch (err) {
            toast.error('Failed to load request details');
        }
    };

    const filteredRequests = requests.filter(req => {
        const matchesStatus = filterStatus === 'all' || req.status === filterStatus;
        const matchesProperty = filterProperty === 'all' || req.property_id?.toString() === filterProperty;
        return matchesStatus && matchesProperty;
    });

    const paginatedRequests = filteredRequests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'Open': return 'bg-blue-100 text-blue-800';
            case 'In Progress': return 'bg-amber-100 text-amber-800';
            case 'Pending Approval': return 'bg-purple-100 text-purple-800';
            case 'Completed': return 'bg-emerald-100 text-emerald-800';
            case 'Rejected': return 'bg-rose-100 text-rose-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getPriorityBadgeClass = (priority) => {
        switch (priority) {
            case 'Low': return 'text-gray-500';
            case 'Normal': return 'text-blue-500';
            case 'High': return 'text-orange-500';
            case 'Critical': return 'text-red-600 font-bold';
            default: return 'text-gray-500';
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Maintenance Management</h1>
                    <p className="text-gray-500 text-sm">Report and track property maintenance issues</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200"
                >
                    + Report New Issue
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Property</label>
                    <select
                        value={filterProperty}
                        onChange={(e) => setFilterProperty(e.target.value)}
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">All Properties</option>
                        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Status</label>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">All Statuses</option>
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Pending Approval">Pending Approval</option>
                        <option value="Completed">Completed</option>
                        <option value="Rejected">Rejected</option>
                    </select>
                </div>
            </div>

            {loading ? <LoadingSpinner text="Fetching maintenance records..." /> : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Issue</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Property/Unit</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Priority</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Reported</th>
                                <th className="px-6 py-4 text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedRequests.map(req => (
                                <tr key={req.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => openDetails(req)}>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{req.title}</div>
                                        <div className="text-xs text-gray-500 line-clamp-1">{req.description}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-semibold text-slate-700">{req.property_name}</div>
                                        <div className="text-xs text-gray-400">Unit: {req.house_number}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-xs font-black ${getPriorityBadgeClass(req.priority)}`}>
                                            {req.priority}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${getStatusBadgeClass(req.status)}`}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-500">
                                        {new Date(req.reported_date).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <i className='bx bx-chevron-right text-gray-300 text-xl'></i>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredRequests.length === 0 && (
                        <div className="p-12 text-center text-gray-400">
                            <i className='bx bx-wrench text-5xl mb-2 opacity-20'></i>
                            <p>No maintenance requests found.</p>
                        </div>
                    )}
                    <Pagination
                        currentPage={currentPage}
                        totalItems={filteredRequests.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                    />
                </div>
            )}

            {/* Report Issue Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Report Property Issue</h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-slate-800 transition">
                                <i className='bx bx-x text-2xl'></i>
                            </button>
                        </div>
                        <form onSubmit={handleReportIssue} className="p-8 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Property</label>
                                    <select
                                        required
                                        value={formData.property_id}
                                        onChange={handlePropertyChange}
                                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Select Property</option>
                                        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Unit</label>
                                    <select
                                        required
                                        disabled={!formData.property_id}
                                        value={formData.house_id}
                                        onChange={(e) => setFormData({ ...formData, house_id: e.target.value })}
                                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                    >
                                        <option value="">Select Unit</option>
                                        {availableHouses.map(h => <option key={h.id} value={h.id}>{h.house_number}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Issue Title</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. Leaking pipe in bathroom"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Description</label>
                                <textarea
                                    required
                                    rows="3"
                                    placeholder="Detailed description of the problem..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500"
                                ></textarea>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Priority</label>
                                    <select
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Normal">Normal</option>
                                        <option value="High">High</option>
                                        <option value="Critical">Critical</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Upload Photo (Optional)</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setFormData({ ...formData, issue_image: e.target.files[0] })}
                                        className="text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200"
                                >
                                    Submit Request
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Request Details Modal */}
            {isDetailModalOpen && selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{selectedRequest.title}</h2>
                                <p className="text-xs text-gray-400">Ticket #{selectedRequest.id} &bull; Reported {new Date(selectedRequest.reported_date).toLocaleString()}</p>
                            </div>
                            <button onClick={() => setIsDetailModalOpen(false)} className="text-gray-400 hover:text-slate-800 transition">
                                <i className='bx bx-x text-2xl'></i>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-6">
                                    <section>
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Description</h3>
                                        <p className="text-slate-700 bg-gray-50 p-4 rounded-2xl">{selectedRequest.description}</p>
                                    </section>

                                    {selectedRequest.issue_image_path && (
                                        <section>
                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Issue Photo</h3>
                                            <img
                                                src={`http://127.0.0.1:3000/uploads/${selectedRequest.issue_image_path}`}
                                                alt="Issue"
                                                className="rounded-2xl w-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition"
                                                onClick={() => window.open(`http://127.0.0.1:3000/uploads/${selectedRequest.issue_image_path}`, '_blank')}
                                            />
                                        </section>
                                    )}

                                    {selectedRequest.receipt_image_path && (
                                        <section className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2">Expense Receipt</h3>
                                            <div className="flex items-start gap-4">
                                                <img
                                                    src={`http://127.0.0.1:3000/uploads/${selectedRequest.receipt_image_path}`}
                                                    alt="Receipt"
                                                    className="w-32 h-32 rounded-xl object-cover shadow-sm cursor-pointer"
                                                    onClick={() => window.open(`http://127.0.0.1:3000/uploads/${selectedRequest.receipt_image_path}`, '_blank')}
                                                />
                                                <div>
                                                    <div className="text-2xl font-black text-emerald-700">KES {selectedRequest.cost?.toLocaleString()}</div>
                                                    <p className="text-xs text-emerald-600 opacity-80 mb-2">Status: {selectedRequest.status}</p>
                                                    {selectedRequest.rejection_note && (
                                                        <div className="bg-rose-100 text-rose-700 p-3 rounded-lg text-xs font-bold">
                                                            Previous Rejection Note: {selectedRequest.rejection_note}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </section>
                                    )}

                                    <section>
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Activity Log</h3>
                                        <div className="space-y-3">
                                            {selectedRequest.logs?.map(log => (
                                                <div key={log.id} className="flex gap-3 text-xs">
                                                    <div className="text-gray-400 min-w-[120px]">{new Date(log.timestamp).toLocaleString()}</div>
                                                    <div className="font-bold text-slate-600">{log.performed_by_name}:</div>
                                                    <div className="text-slate-500">{log.action}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-gray-50 p-6 rounded-2xl space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Status</label>
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${getStatusBadgeClass(selectedRequest.status)}`}>
                                                {selectedRequest.status}
                                            </span>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Property & Unit</label>
                                            <div className="text-sm font-bold text-slate-800">{selectedRequest.property_name}</div>
                                            <div className="text-xs text-gray-500">Unit: {selectedRequest.house_number}</div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Priority</label>
                                            <div className={`text-xs font-black ${getPriorityBadgeClass(selectedRequest.priority)}`}>{selectedRequest.priority}</div>
                                        </div>
                                    </div>

                                    {/* Action Buttons based on status and role */}
                                    <div className="flex flex-col gap-3">
                                        {selectedRequest.status === 'Open' && (
                                            <button
                                                onClick={() => handleUpdateStatus(selectedRequest.id, 'In Progress')}
                                                className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition shadow-lg"
                                            >
                                                Start Repair
                                            </button>
                                        )}

                                        {selectedRequest.status === 'In Progress' && (
                                            <button
                                                onClick={() => setIsExpenseModalOpen(true)}
                                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200"
                                            >
                                                Complete & Log Expense
                                            </button>
                                        )}

                                        {selectedRequest.status === 'Pending Approval' && user.role === 'admin' && (
                                            <div className="space-y-4 mt-4 p-4 bg-purple-50 rounded-2xl border border-purple-100">
                                                <h4 className="text-[10px] font-black uppercase text-purple-600 tracking-widest text-center">Owner Actions</h4>
                                                <button
                                                    onClick={() => handleApprove(selectedRequest.id)}
                                                    className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg"
                                                >
                                                    Approve & Pay
                                                </button>
                                                <div>
                                                    <textarea
                                                        placeholder="Reason for rejection (optional)"
                                                        value={rejectionNote}
                                                        onChange={(e) => setRejectionNote(e.target.value)}
                                                        className="w-full bg-white border border-purple-200 rounded-xl px-4 py-2 text-xs mb-2 focus:ring-1 focus:ring-purple-400 outline-none"
                                                    />
                                                    <button
                                                        onClick={() => handleReject(selectedRequest.id)}
                                                        className="w-full bg-rose-100 text-rose-600 py-3 rounded-xl font-bold hover:bg-rose-200 transition"
                                                    >
                                                        Reject Request
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {selectedRequest.status === 'Completed' && (
                                            <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl text-center">
                                                <i className='bx bxs-check-circle text-2xl mb-1'></i>
                                                <p className="text-xs font-bold uppercase tracking-widest">Job Finalized</p>
                                                <p className="text-[10px] opacity-70 mt-1">Integrated with Finance module</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Log Expense Modal */}
            {isExpenseModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Log Repair Expense</h2>
                            <button onClick={() => setIsExpenseModalOpen(false)} className="text-gray-400 hover:text-slate-800 transition">
                                <i className='bx bx-x text-2xl'></i>
                            </button>
                        </div>
                        <form onSubmit={handleLogExpense} className="p-8 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Repair Cost (KES)</label>
                                <input
                                    required
                                    type="number"
                                    placeholder="Enter amount"
                                    value={expenseData.amount}
                                    onChange={(e) => setExpenseData({ ...expenseData, amount: e.target.value })}
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Expense Description</label>
                                <textarea
                                    required
                                    rows="2"
                                    placeholder="What was paid for?"
                                    value={expenseData.description}
                                    onChange={(e) => setExpenseData({ ...expenseData, description: e.target.value })}
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500"
                                ></textarea>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 font-bold text-blue-600">Upload Receipt Image (Required)</label>
                                <input
                                    required
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setExpenseData({ ...expenseData, receipt: e.target.files[0] })}
                                    className="text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Snapshot of the physical receipt for owner verification.</p>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsExpenseModalOpen(false)}
                                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition"
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200"
                                >
                                    Log & Submit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
