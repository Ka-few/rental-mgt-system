import { useEffect, useState } from 'react';
import { getRequests, createRequest, updateRequest, deleteRequest } from '../services/maintenanceService';
import { getProperties, getHouses } from '../services/propertyService';

export default function Maintenance() {
    const [requests, setRequests] = useState([]);
    const [properties, setProperties] = useState([]);
    const [houses, setHouses] = useState([]);

    // Modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [closingRequestId, setClosingRequestId] = useState(null);

    // Forms
    const [formData, setFormData] = useState({ property_id: '', house_id: '', description: '', priority: 'Normal' });
    const [closeForm, setCloseForm] = useState({ cost: 0, completed_date: new Date().toISOString().split('T')[0] });

    // Edit State
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        loadRequests();
        getProperties().then(setProperties).catch(console.error);
    }, []);

    const loadRequests = () => {
        getRequests().then(setRequests).catch(console.error);
    };

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

    const handleSortProperties = async (pId) => {
        if (pId) {
            const h = await getHouses(pId);
            setHouses(h);
        }
    }

    const openNewRequestModal = () => {
        setIsEditMode(false);
        setEditingId(null);
        setFormData({ property_id: '', house_id: '', description: '', priority: 'Normal' });
        setHouses([]);
        setIsModalOpen(true);
    };

    const openEditModal = async (req) => {
        setIsEditMode(true);
        setEditingId(req.id);

        // Load houses for the property so the dropdown shows correct value
        // Note: In a real app we might need to fetch the property_id if not in the flat request object, 
        // but our backend JOIN currently returns property_id via 'p.id as property_id' ? 
        // Let's check backend... backend returns p.name but not p.id explicitly in the select m.*, p.name...
        // Actually m.* includes house_id. We need to find property_id from house_id or similar.
        // Simplified: We'll just assume we can't easily switch property in edit without more data, 
        // or we pre-fetch. For now, let's just View/Edit Description & Priority.

        setFormData({
            property_id: '', // functionality to change unit not critical for now, focus on details
            house_id: req.house_id,
            description: req.description,
            priority: req.priority
        });
        setIsModalOpen(true);
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditMode) {
                // Update only editable fields
                await updateRequest(editingId, {
                    description: formData.description,
                    priority: formData.priority
                });
            } else {
                await createRequest(formData);
            }
            setIsModalOpen(false);
            loadRequests();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this request?')) return;
        try {
            await deleteRequest(id);
            loadRequests();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleStatusUpdate = async (id, newStatus) => {
        if (newStatus === 'Closed') {
            setClosingRequestId(id);
            setCloseForm({ cost: 0, completed_date: new Date().toISOString().split('T')[0] });
            setIsCloseModalOpen(true);
        } else {
            try {
                await updateRequest(id, { status: newStatus });
                loadRequests();
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleCloseSubmit = async (e) => {
        e.preventDefault();
        try {
            await updateRequest(closingRequestId, {
                status: 'Closed',
                cost: closeForm.cost,
                completed_date: closeForm.completed_date
            });
            setIsCloseModalOpen(false);
            loadRequests();
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Maintenance Requests</h1>
                <button onClick={openNewRequestModal} className="bg-blue-600 text-white px-4 py-2 rounded">New Request</button>
            </div>

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
                                                <button onClick={() => handleStatusUpdate(r.id, 'In Progress')} className="text-yellow-600 hover:underline">Start</button>
                                            )}
                                            <button onClick={() => handleStatusUpdate(r.id, 'Closed')} className="text-green-600 hover:underline">Close</button>
                                            <button onClick={() => openEditModal(r)} className="text-blue-600 hover:underline">Edit</button>
                                        </>
                                    )}
                                    <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
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
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Close Request Modal */}
            {isCloseModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded w-96">
                        <h3 className="text-lg font-bold mb-4">Close Maintenance Request</h3>
                        <form onSubmit={handleCloseSubmit}>
                            <label className="block text-sm text-gray-600 mb-1">Repair Cost</label>
                            <input type="number" className="border w-full p-2 mb-2" placeholder="Cost" required
                                value={closeForm.cost} onChange={e => setCloseForm({ ...closeForm, cost: e.target.value })} />

                            <label className="block text-sm text-gray-600 mb-1">Completion Date</label>
                            <input type="date" className="border w-full p-2 mb-2" required
                                value={closeForm.completed_date} onChange={e => setCloseForm({ ...closeForm, completed_date: e.target.value })} />

                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setIsCloseModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Mark Closed</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
