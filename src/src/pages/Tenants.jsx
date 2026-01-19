import { useEffect, useState } from 'react';
import { getTenants, createTenant, updateTenant, deleteTenant } from '../services/tenantService';
import { getProperties, getHouses } from '../services/propertyService';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import LoadingSpinner from '../components/LoadingSpinner';
import Pagination from '../components/Pagination';
import { validateNationalId, validatePhone, validateEmail, validateRequired } from '../utils/validation';

export default function Tenants() {
    const toast = useToast();
    const [tenants, setTenants] = useState([]);
    const [properties, setProperties] = useState([]);
    const [availableHouses, setAvailableHouses] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null });
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterProperty, setFilterProperty] = useState('all');

    const [formData, setFormData] = useState({
        full_name: '',
        national_id: '',
        phone: '',
        email: '',
        move_in_date: new Date().toISOString().split('T')[0],
        property_id: '',
        house_id: ''
    });

    useEffect(() => {
        loadTenants();
        getProperties().then(setProperties).catch(console.error);
    }, []);

    const loadTenants = () => {
        setLoading(true);
        getTenants()
            .then(setTenants)
            .catch(console.error)
            .finally(() => setLoading(false));
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

    const handleEdit = async (tenant) => {
        setIsEditMode(true);
        setEditingId(tenant.id);

        // If tenant has a property linked, list the houses for that property
        let houses = [];
        if (tenant.property_id) {
            houses = await getHouses(tenant.property_id);
            setAvailableHouses(houses);
        } else {
            setAvailableHouses([]);
        }

        setFormData({
            full_name: tenant.full_name,
            national_id: tenant.national_id,
            phone: tenant.phone,
            email: tenant.email || '',
            move_in_date: tenant.move_in_date || '',
            property_id: tenant.property_id || '',
            house_id: tenant.house_id || ''
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        setConfirmDelete({ isOpen: true, id });
    };

    const confirmDeleteTenant = async () => {
        try {
            await deleteTenant(confirmDelete.id);
            toast.success('Tenant deleted successfully');
            loadTenants();
        } catch (err) {
            toast.error('Error deleting tenant: ' + err.message);
        }
    };

    const handleToggleStatus = async (tenant) => {
        const newStatus = tenant.status === 'Active' ? 'Vacated' : 'Active';
        try {
            await updateTenant(tenant.id, { status: newStatus });
            toast.success(`Tenant marked as ${newStatus}`);
            loadTenants();
        } catch (err) {
            toast.error('Error updating status: ' + err.message);
        }
    };

    const openAddModal = () => {
        setIsEditMode(false);
        setEditingId(null);
        setFormData({
            full_name: '',
            national_id: '',
            phone: '',
            email: '',
            move_in_date: new Date().toISOString().split('T')[0],
            property_id: '',
            house_id: ''
        });
        setAvailableHouses([]);
        setIsModalOpen(true);
    };

    // Pagination logic with search and filters
    const filteredTenants = tenants.filter(tenant => {
        const matchesSearch = tenant.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tenant.national_id.includes(searchTerm) ||
            tenant.phone.includes(searchTerm);
        const matchesStatus = filterStatus === 'all' || tenant.status === filterStatus;
        const matchesProperty = filterProperty === 'all' || tenant.property_id?.toString() === filterProperty;
        return matchesSearch && matchesStatus && matchesProperty;
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentTenants = filteredTenants.slice(indexOfFirstItem, indexOfLastItem);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (formData.national_id.length !== 8) {
                toast.error('National ID must be 8 digits');
                return;
            }

            if (isEditMode) {
                await updateTenant(editingId, formData);
                toast.success('Tenant updated successfully');
            } else {
                await createTenant(formData);
                toast.success('Tenant created successfully');
            }

            setIsModalOpen(false);
            loadTenants();
            setFormData({ full_name: '', national_id: '', phone: '', email: '', move_in_date: new Date().toISOString().split('T')[0], property_id: '', house_id: '' });
            setIsEditMode(false);
            setEditingId(null);
            setAvailableHouses([]);
        } catch (err) {
            toast.error(err.message || 'Error saving tenant');
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Tenants</h1>
                <button
                    onClick={openAddModal}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                    + Add Tenant
                </button>
            </div>

            {/* Search and Filters */}
            <div className="bg-white p-4 rounded shadow mb-4 flex gap-4 items-end">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                    <input
                        type="text"
                        placeholder="Search by name, ID, or phone..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1); // Reset to first page on search
                        }}
                        className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                        value={filterStatus}
                        onChange={(e) => {
                            setFilterStatus(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">All Status</option>
                        <option value="Active">Active</option>
                        <option value="Vacated">Vacated</option>
                        <option value="Arrears">Arrears</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
                    <select
                        value={filterProperty}
                        onChange={(e) => {
                            setFilterProperty(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">All Properties</option>
                        {properties.map(prop => (
                            <option key={prop.id} value={prop.id}>{prop.name}</option>
                        ))}
                    </select>
                </div>
                {(searchTerm || filterStatus !== 'all' || filterProperty !== 'all') && (
                    <button
                        onClick={() => {
                            setSearchTerm('');
                            setFilterStatus('all');
                            setFilterProperty('all');
                            setCurrentPage(1);
                        }}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                    >
                        Clear Filters
                    </button>
                )}
            </div>

            {loading ? (
                <LoadingSpinner text="Loading tenants..." />
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {currentTenants.map((tenant) => (
                                <tr key={tenant.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">{tenant.full_name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{tenant.national_id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{tenant.phone}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{tenant.property_name || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{tenant.house_number || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <button
                                            onClick={() => handleToggleStatus(tenant)}
                                            className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer ${tenant.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                                            title="Click to toggle status"
                                        >
                                            {tenant.status}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                        <button onClick={() => handleEdit(tenant)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                        <button onClick={() => handleDelete(tenant.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                    </td>
                                </tr>
                            ))}
                            {currentTenants.length === 0 && <tr><td colSpan="5" className="p-4 text-center">No tenants found.</td></tr>}
                        </tbody>
                    </table>

                    <Pagination
                        currentPage={currentPage}
                        totalItems={filteredTenants.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                    />
                </div>
            )}

            {/* Add Tenant Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
                    <div className="bg-white p-8 rounded-lg shadow-xl w-96">
                        <h2 className="text-xl font-bold mb-4">{isEditMode ? 'Edit Tenant' : 'Add New Tenant'}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Full Name</label>
                                <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    type="text" required
                                    value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">National ID (8 digits)</label>
                                <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    type="text" required maxLength={8} minLength={8}
                                    value={formData.national_id} onChange={e => setFormData({ ...formData, national_id: e.target.value })}
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Phone</label>
                                <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    type="text" required
                                    value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>

                            {/* Property & House Linking */}
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Property</label>
                                <select
                                    className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={formData.property_id}
                                    onChange={handlePropertyChange}
                                >
                                    <option value="">Select Property</option>
                                    {properties.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Unit</label>
                                <select
                                    className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={formData.house_id}
                                    onChange={e => setFormData({ ...formData, house_id: e.target.value })}
                                    disabled={!formData.property_id}
                                >
                                    <option value="">Select Unit</option>
                                    {availableHouses.filter(h => h.status === 'Vacant' || h.id == formData.house_id).map(h => (
                                        <option key={h.id} value={h.id}>{h.house_number} ({h.type}) - {h.rent_amount}</option>
                                    ))}
                                </select>
                            </div>


                            <div className="mb-6">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Email (Optional)</label>
                                <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    type="email"
                                    value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="mr-2 px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, id: null })}
                onConfirm={confirmDeleteTenant}
                title="Delete Tenant"
                message="Are you sure you want to delete this tenant? This action cannot be undone."
                confirmText="Delete"
                isDangerous={true}
            />
        </div>
    );
}
