import { useEffect, useState } from 'react';
import { getRequests, createRequest, updateRequest } from '../services/maintenanceService';
import { getProperties, getHouses } from '../services/propertyService';

export default function Maintenance() {
    const [requests, setRequests] = useState([]);
    const [properties, setProperties] = useState([]);
    const [houses, setHouses] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ property_id: '', house_id: '', description: '', priority: 'Normal' });

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await createRequest(formData);
            setIsModalOpen(false);
            loadRequests();
            setFormData({ property_id: '', house_id: '', description: '', priority: 'Normal' });
        } catch (err) {
            alert(err.message);
        }
    };

    const handleStatusChange = async (id, status) => {
        // Prompt for cost if closing? logic simplified for now
        try {
            await updateRequest(id, { status });
            loadRequests();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Maintenance Requests</h1>
                <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded">New Request</button>
            </div>

            <div className="bg-white rounded shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left">Property/House</th>
                            <th className="px-6 py-3 text-left">Issue</th>
                            <th className="px-6 py-3 text-left">Priority</th>
                            <th className="px-6 py-3 text-left">Status</th>
                            <th className="px-6 py-3 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {requests.map((r) => (
                            <tr key={r.id}>
                                <td className="px-6 py-4">{r.property_name} - {r.house_number}</td>
                                <td className="px-6 py-4">{r.description}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 rounded text-xs ${r.priority === 'High' || r.priority === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                        {r.priority}
                                    </span>
                                </td>
                                <td className="px-6 py-4">{r.status}</td>
                                <td className="px-6 py-4">
                                    {r.status !== 'Closed' && (
                                        <button onClick={() => handleStatusChange(r.id, 'Closed')} className="text-green-600 hover:underline">Mark Closed</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded w-96">
                        <h3 className="text-lg font-bold mb-4">Report Issue</h3>
                        <form onSubmit={handleSubmit}>
                            <select className="border w-full p-2 mb-2" required value={formData.property_id} onChange={handlePropertyChange}>
                                <option value="">Select Property</option>
                                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <select className="border w-full p-2 mb-2" required value={formData.house_id} onChange={e => setFormData({ ...formData, house_id: e.target.value })}>
                                <option value="">Select Unit</option>
                                {houses.map(h => <option key={h.id} value={h.id}>{h.house_number}</option>)}
                            </select>
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
        </div>
    );
}
