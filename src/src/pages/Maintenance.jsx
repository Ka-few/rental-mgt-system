import React, { useEffect, useState, useCallback } from 'react';
import { getRequests, createRequest, updateRequest, deleteRequest } from '../services/maintenanceService';
import { getProperties, getHouses } from '../services/propertyService';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

// --- Sub-components for Performance ---

const MaintenanceTable = React.memo(({ requests, onStatusUpdate, onEdit, onDelete }) => {
    return (
        <div className="bg-white rounded shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left">Date</th>
                        <th className="px-6 py-3 text-left">Property/House</th>
                        <th className="px-6 py-3 text-left">Issue</th>
                        <th className="px-6 py-3 text-left">Priority</th>
                        <th className="px-6 py-3 text-left">Status</th>
                        <th className="px-6 py-3 text-left">Cost</th>
                        <th className="px-6 py-3 text-left">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {requests.map((r) => (
                        <tr key={r.id}>
                            <td className="px-6 py-4 text-sm text-gray-500">
                                {new Date(r.reported_date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">{r.property_name} - {r.house_number}</td>
                            <td className="px-6 py-4">{r.description}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 rounded text-xs ${r.priority === 'High' || r.priority === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                    {r.priority}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 rounded text-xs ${r.status === 'Closed' ? 'bg-gray-100 text-gray-800' :
                                    r.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-green-100 text-green-800'
                                    }`}>
                                    {r.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 font-bold">
                                {r.cost > 0 ? `${r.cost?.toLocaleString()} KES` : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm space-x-2">
                                {r.status !== 'Closed' && (
                                    <>
                                        {r.status === 'Open' && (
                                            <button onClick={() => onStatusUpdate(r.id, 'In Progress')} className="text-yellow-600 hover:underline">Start</button>
                                        )}
                                        <button onClick={() => onStatusUpdate(r.id, 'Closed')} className="text-green-600 hover:underline">Close</button>
                                        <button onClick={() => onEdit(r)} className="text-blue-600 hover:underline">Edit</button>
                                    </>
                                )}
                                <button onClick={() => onDelete(r.id)} className="text-red-600 hover:underline">Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
});

const RequestModal = ({ isOpen, onClose, isEditMode, editingRequest, properties, onSuccess }) => {
    const toast = useToast();
    const [formData, setFormData] = useState({ property_id: '', house_id: '', description: '', priority: 'Normal' });
    const [houses, setHouses] = useState([]);

    useEffect(() => {
        if (isOpen) {
            if (isEditMode && editingRequest) {
                setFormData({
                    property_id: editingRequest.property_id || '',
                    house_id: editingRequest.house_id,
                    description: editingRequest.description,
                    priority: editingRequest.priority
                });
            } else {
                setFormData({ property_id: '', house_id: '', description: '', priority: 'Normal' });
            }
        }
    }, [isOpen, isEditMode, editingRequest]);

    const handlePropertyChange = async (e) => {
        const pId = e.target.value;
        setFormData({ ...formData, property_id: pId, house_id: '' });
        if (pId) {
            const h = await getHouses(pId);
            setHouses(h);
        } else {
            setHouses([]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditMode) {
                await updateRequest(editingRequest.id, {
                    description: formData.description,
                    priority: formData.priority
                });
            } else {
                await createRequest(formData);
            }
            onSuccess();
            onClose();
            toast.success(isEditMode ? 'Request updated successfully' : 'Request created successfully');
        } catch (err) {
            toast.error(err.message || 'Error saving request');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded w-96">
                <h3 className="text-lg font-bold mb-4">{isEditMode ? 'Edit Request' : 'Report Issue'}</h3>
                <form onSubmit={handleSubmit}>
                    {!isEditMode && (
                        <>
                            <select className="border w-full p-2 mb-2" required value={formData.property_id} onChange={handlePropertyChange}>
                                <option value="">Select Property</option>
                                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <select className="border w-full p-2 mb-2" required value={formData.house_id} onChange={e => setFormData({ ...formData, house_id: e.target.value })}>
                                <option value="">Select Unit</option>
                                {houses.map(h => <option key={h.id} value={h.id}>{h.house_number}</option>)}
                            </select>
                        </>
                    )}
                    <textarea className="border w-full p-2 mb-2" placeholder="Description" required value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                    <select className="border w-full p-2 mb-2" value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}>
                        <option>Low</option>
                        <option>Normal</option>
                        <option>High</option>
                        <option>Critical</option>
                    </select>
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CloseRequestModal = ({ isOpen, onClose, requestId, onSuccess }) => {
    const toast = useToast();
    const [form, setForm] = useState({ cost: 0, completed_date: new Date().toISOString().split('T')[0] });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await updateRequest(requestId, {
                status: 'Closed',
                cost: form.cost,
                completed_date: form.completed_date
            });
            onSuccess();
            onClose();
            toast.success('Request closed successfully');
        } catch (err) {
            toast.error('Error closing request: ' + err.message);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded w-96">
                <h3 className="text-lg font-bold mb-4">Close Maintenance Request</h3>
                <form onSubmit={handleSubmit}>
                    <label className="block text-sm text-gray-600 mb-1">Repair Cost</label>
                    <input type="text" className="border w-full p-2 mb-2" placeholder="Cost" required
                        value={form.cost} onFocus={(e) => e.target.select()} onChange={e => setForm({ ...form, cost: e.target.value.replace(/[^0-9]/g, '') })} />

                    <label className="block text-sm text-gray-600 mb-1">Completion Date</label>
                    <input type="date" className="border w-full p-2 mb-2" required
                        value={form.completed_date} onChange={e => setForm({ ...form, completed_date: e.target.value })} />

                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Mark Closed</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Main Maintenance Component ---

export default function Maintenance() {
    const toast = useToast();
    const [requests, setRequests] = useState([]);
    const [properties, setProperties] = useState([]);
    const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null });

    // Modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [closingRequestId, setClosingRequestId] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);

    useEffect(() => {
        loadRequests();
        getProperties().then(setProperties).catch(console.error);
    }, []);

    const loadRequests = useCallback(() => {
        getRequests().then(setRequests).catch(console.error);
    }, []);

    const handleNewRequest = () => {
        setIsEditMode(false);
        setSelectedRequest(null);
        setIsModalOpen(true);
    };

    const handleEditRequest = useCallback((req) => {
        setIsEditMode(true);
        setSelectedRequest(req);
        setIsModalOpen(true);
    }, []);

    const handleStatusUpdate = useCallback(async (id, newStatus) => {
        if (newStatus === 'Closed') {
            setClosingRequestId(id);
            setIsCloseModalOpen(true);
        } else {
            try {
                await updateRequest(id, { status: newStatus });
                toast.success('Status updated successfully');
                loadRequests();
            } catch (err) {
                toast.error('Error updating status: ' + err.message);
            }
        }
    }, [loadRequests, toast]);

    const handleDelete = useCallback((id) => {
        setConfirmDelete({ isOpen: true, id });
    }, []);

    const confirmDeleteRequest = async () => {
        try {
            await deleteRequest(confirmDelete.id);
            toast.success('Request deleted successfully');
            loadRequests();
        } catch (err) {
            toast.error('Error deleting request: ' + err.message);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Maintenance Requests</h1>
                <button onClick={handleNewRequest} className="bg-blue-600 text-white px-4 py-2 rounded">New Request</button>
            </div>

            <MaintenanceTable
                requests={requests}
                onStatusUpdate={handleStatusUpdate}
                onEdit={handleEditRequest}
                onDelete={handleDelete}
            />

            <RequestModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                isEditMode={isEditMode}
                editingRequest={selectedRequest}
                properties={properties}
                onSuccess={loadRequests}
            />

            <CloseRequestModal
                isOpen={isCloseModalOpen}
                onClose={() => setIsCloseModalOpen(false)}
                requestId={closingRequestId}
                onSuccess={loadRequests}
            />

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, id: null })}
                onConfirm={confirmDeleteRequest}
                title="Delete Request"
                message="Are you sure you want to delete this maintenance request?"
                confirmText="Delete"
                isDangerous={true}
            />
        </div>
    );
}
