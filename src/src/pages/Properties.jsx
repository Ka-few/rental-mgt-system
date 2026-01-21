import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { getProperties, createProperty, createHouse, getHouses, updateHouse } from '../services/propertyService';
import { useToast } from '../context/ToastContext';

// --- Sub-components for Performance ---

const PropertyList = React.memo(({ properties, selectedPropertyId, onSelectProperty, onAddProperty, onEditProperty }) => {
    return (
        <div className="w-1/2 p-4 bg-white rounded shadow text-black">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Properties</h2>
                <button onClick={onAddProperty} className="bg-blue-600 text-white px-3 py-1 rounded">Add Property</button>
            </div>
            <ul>
                {properties.map(p => (
                    <li key={p.id} className={`p-4 border-b cursor-pointer hover:bg-gray-50 flex justify-between ${selectedPropertyId === p.id ? 'bg-blue-50' : ''}`} onClick={() => onSelectProperty(p)}>
                        <div className="flex-1">
                            <div className="font-bold">{p.name}</div>
                            <div className="text-sm text-gray-500">{p.address}</div>
                            <div className="text-xs mt-1">
                                <span className={`px-2 py-0.5 rounded-full ${p.type === 'Residential' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                    {p.type}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); onEditProperty(p); }}
                            className="text-blue-600 hover:text-blue-800 self-center"
                        >
                            Edit
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
});

const UnitTable = React.memo(({ selectedProperty, units, onAddUnit, onEditUnit }) => {
    if (!selectedProperty) {
        return (
            <div className="w-1/2 p-4 bg-white rounded shadow text-black">
                <h2 className="text-xl font-bold mb-4">Units</h2>
                <p className="text-gray-500">Select a property to view units.</p>
            </div>
        );
    }

    return (
        <div className="w-1/2 p-4 bg-white rounded shadow text-black">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Units - {selectedProperty.name}</h2>
                <button onClick={onAddUnit} className="bg-green-600 text-white px-3 py-1 rounded">Add Unit</button>
            </div>
            <table className="min-w-full">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-2 text-left">Unit No</th>
                        <th className="px-4 py-2 text-left">Type</th>
                        <th className="px-4 py-2 text-left">Rent</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {units.map(u => (
                        <tr key={u.id} className="border-t">
                            <td className="px-4 py-2">{u.house_number}</td>
                            <td className="px-4 py-2">{u.type}</td>
                            <td className="px-4 py-2">{u.rent_amount}</td>
                            <td className="px-4 py-2">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.status === 'Occupied' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {u.status}
                                </span>
                            </td>
                            <td className="px-4 py-2">
                                <button onClick={() => onEditUnit(u)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
});

const PropertyModal = ({ isOpen, onClose, onSuccess, isEditMode, editingProperty }) => {
    const toast = useToast();
    const [form, setForm] = useState({
        name: '',
        address: '',
        type: 'Residential',
        annual_income_estimate: '',
        kra_pin: ''
    });

    useEffect(() => {
        if (isOpen) {
            if (isEditMode && editingProperty) {
                setForm({
                    name: editingProperty.name,
                    address: editingProperty.address,
                    type: editingProperty.type || 'Residential',
                    annual_income_estimate: editingProperty.annual_income_estimate || '',
                    kra_pin: editingProperty.kra_pin || ''
                });
            } else {
                setForm({ name: '', address: '', type: 'Residential', annual_income_estimate: '', kra_pin: '' });
            }
        }
    }, [isOpen, isEditMode, editingProperty]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditMode) {
                await updateProperty(editingProperty.id, form);
            } else {
                await createProperty(form);
            }
            onSuccess();
            onClose();
            toast.success(isEditMode ? 'Property updated successfully' : 'Property created successfully');
        } catch (err) {
            toast.error(err.message || 'Error saving property');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded w-96">
                <h3 className="text-lg font-bold mb-4">{isEditMode ? 'Edit Property' : 'Add Property'}</h3>
                <form onSubmit={handleSubmit}>
                    <div className="mb-2">
                        <label className="block text-sm font-medium text-gray-700">Property Name</label>
                        <input className="border w-full p-2" placeholder="Property Name" required
                            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="mb-2">
                        <label className="block text-sm font-medium text-gray-700">Address</label>
                        <input className="border w-full p-2" placeholder="Address" required
                            value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                    </div>
                    <div className="mb-2">
                        <label className="block text-sm font-medium text-gray-700">Building Type</label>
                        <select className="border w-full p-2" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                            <option value="Residential">Residential (MRI Eligible)</option>
                            <option value="Commercial">Commercial (Non-MRI)</option>
                        </select>
                    </div>
                    {form.type === 'Residential' && (
                        <>
                            <div className="mb-2">
                                <label className="block text-sm font-medium text-gray-700">Annual Rent Estimate (KES)</label>
                                <input type="text" className="border w-full p-2 font-mono" placeholder="e.g. 500000"
                                    value={form.annual_income_estimate}
                                    onFocus={(e) => e.target.select()}
                                    onChange={e => setForm({ ...form, annual_income_estimate: e.target.value.replace(/[^0-9]/g, '') })} />
                            </div>
                            <div className="mb-2">
                                <label className="block text-sm font-medium text-gray-700">KRA PIN</label>
                                <input className="border w-full p-2 font-mono" placeholder="A00XXXXXXXX"
                                    value={form.kra_pin} onChange={e => setForm({ ...form, kra_pin: e.target.value.toUpperCase() })} />
                            </div>
                        </>
                    )}
                    <div className="flex justify-end gap-2 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded font-bold">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold shadow-lg">
                            {isEditMode ? 'Update' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div >
    );
};

const UnitModal = ({ isOpen, onClose, isEditMode, editingUnit, propertyId, onSuccess }) => {
    const toast = useToast();
    const [form, setForm] = useState({ house_number: '', type: '1 BDR', rent_amount: 0, amenities: {} });

    useEffect(() => {
        if (isOpen) {
            if (isEditMode && editingUnit) {
                setForm({
                    house_number: editingUnit.house_number,
                    type: editingUnit.type,
                    rent_amount: editingUnit.rent_amount,
                    amenities: editingUnit.amenities || {}
                });
            } else {
                setForm({ house_number: '', type: '1 BDR', rent_amount: 0, amenities: {} });
            }
        }
    }, [isOpen, isEditMode, editingUnit]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditMode) {
                await updateHouse(editingUnit.id, form);
            } else {
                await createHouse(propertyId, form);
            }
            onSuccess();
            onClose();
            toast.success(isEditMode ? 'Unit updated successfully' : 'Unit created successfully');
        } catch (err) {
            toast.error(err.message || 'Error saving unit');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded w-96">
                <h3 className="text-lg font-bold mb-4">{isEditMode ? 'Edit Unit' : 'Add Unit'}</h3>
                <form onSubmit={handleSubmit}>
                    <div className="mb-2">
                        <label className="block text-sm font-medium text-gray-700">House Number</label>
                        <input className="border w-full p-2" placeholder="House Number (e.g. A1)" required
                            value={form.house_number} onChange={e => setForm({ ...form, house_number: e.target.value })} />
                    </div>
                    <div className="mb-2">
                        <label className="block text-sm font-medium text-gray-700">Type</label>
                        <select className="border w-full p-2"
                            value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                            <option value="Bedsitter">Bedsitter</option>
                            <option value="1 BDR">1 BDR</option>
                            <option value="2 BDR">2 BDR</option>
                            <option value="3 BDR">3 BDR</option>
                            <option value="Shop">Shop</option>
                        </select>
                    </div>
                    <div className="mb-2">
                        <label className="block text-sm font-medium text-gray-700">Rent Amount</label>
                        <input type="text" className="border w-full p-2" placeholder="Rent Amount" required
                            value={form.rent_amount} onFocus={(e) => e.target.select()} onChange={e => setForm({ ...form, rent_amount: e.target.value.replace(/[^0-9]/g, '') })} />
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Main Properties Component ---

export default function Properties() {
    const [properties, setProperties] = useState([]);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [units, setUnits] = useState([]);

    // Modal States
    const [isPropModalOpen, setIsPropModalOpen] = useState(false);
    const [isEditPropMode, setIsEditPropMode] = useState(false);
    const [editingProperty, setEditingProperty] = useState(null);
    const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
    const [isEditUnitMode, setIsEditUnitMode] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState(null);

    useEffect(() => {
        loadProperties();
    }, []);

    const loadProperties = useCallback(() => {
        getProperties().then(setProperties).catch(console.error);
    }, []);

    const loadUnits = useCallback(async (propertyId) => {
        try {
            const data = await getHouses(propertyId);
            setUnits(data);
        } catch (err) {
            console.error(err);
        }
    }, []);

    const handleSelectProperty = useCallback((property) => {
        setSelectedProperty(property);
        loadUnits(property.id);
    }, [loadUnits]);

    const handleAddProperty = useCallback(() => {
        setIsEditPropMode(false);
        setEditingProperty(null);
        setIsPropModalOpen(true);
    }, []);

    const handleEditProperty = useCallback((property) => {
        setIsEditPropMode(true);
        setEditingProperty(property);
        setIsPropModalOpen(true);
    }, []);

    const handleAddUnit = useCallback(() => {
        setIsEditUnitMode(false);
        setSelectedUnit(null);
        setIsUnitModalOpen(true);
    }, []);

    const handleEditUnit = useCallback((unit) => {
        setIsEditUnitMode(true);
        setSelectedUnit(unit);
        setIsUnitModalOpen(true);
    }, []);

    const handleRefreshUnits = useCallback(() => {
        if (selectedProperty) {
            loadUnits(selectedProperty.id);
        }
    }, [selectedProperty, loadUnits]);

    return (
        <div className="flex gap-4 h-full">
            <PropertyList
                properties={properties}
                selectedPropertyId={selectedProperty?.id}
                onSelectProperty={handleSelectProperty}
                onAddProperty={handleAddProperty}
                onEditProperty={handleEditProperty}
            />

            <UnitTable
                selectedProperty={selectedProperty}
                units={units}
                onAddUnit={handleAddUnit}
                onEditUnit={handleEditUnit}
            />

            <PropertyModal
                isOpen={isPropModalOpen}
                onClose={() => setIsPropModalOpen(false)}
                onSuccess={loadProperties}
                isEditMode={isEditPropMode}
                editingProperty={editingProperty}
            />

            <UnitModal
                isOpen={isUnitModalOpen}
                onClose={() => setIsUnitModalOpen(false)}
                isEditMode={isEditUnitMode}
                editingUnit={selectedUnit}
                propertyId={selectedProperty?.id}
                onSuccess={handleRefreshUnits}
            />
        </div>
    );
}
