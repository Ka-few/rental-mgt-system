import { useEffect, useState } from 'react';
import { getProperties, createProperty, createHouse, getHouses, updateHouse } from '../services/propertyService';

export default function Properties() {
    const [properties, setProperties] = useState([]);
    const [selectedProperty, setSelectedProperty] = useState(null); // For viewing units
    const [units, setUnits] = useState([]);
    const [isPropModalOpen, setIsPropModalOpen] = useState(false);

    // Unit Modal & Edit State
    const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
    const [isEditUnitMode, setIsEditUnitMode] = useState(false);
    const [editingUnitId, setEditingUnitId] = useState(null);

    const [propForm, setPropForm] = useState({ name: '', address: '', total_units: 0 });
    const [unitForm, setUnitForm] = useState({ house_number: '', type: '1 BDR', rent_amount: 0, amenities: {} });

    useEffect(() => {
        loadProperties();
    }, []);

    const loadProperties = () => {
        getProperties().then(setProperties).catch(console.error);
    };

    const handlePropSubmit = async (e) => {
        e.preventDefault();
        try {
            await createProperty(propForm);
            setIsPropModalOpen(false);
            loadProperties();
            setPropForm({ name: '', address: '', total_units: 0 });
        } catch (err) {
            alert(err.message);
        }
    };

    const handleViewUnits = async (property) => {
        setSelectedProperty(property);
        try {
            const data = await getHouses(property.id);
            setUnits(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddUnitClick = () => {
        setIsEditUnitMode(false);
        setEditingUnitId(null);
        setUnitForm({ house_number: '', type: '1 BDR', rent_amount: 0, amenities: {} });
        setIsUnitModalOpen(true);
    };

    const handleEditUnitClick = (unit) => {
        setIsEditUnitMode(true);
        setEditingUnitId(unit.id);
        setUnitForm({
            house_number: unit.house_number,
            type: unit.type,
            rent_amount: unit.rent_amount,
            amenities: unit.amenities || {}
        });
        setIsUnitModalOpen(true);
    };

    const handleUnitSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditUnitMode) {
                await updateHouse(editingUnitId, unitForm);
            } else {
                await createHouse(selectedProperty.id, unitForm);
            }

            setIsUnitModalOpen(false);
            const data = await getHouses(selectedProperty.id);
            setUnits(data);
            setUnitForm({ house_number: '', type: '1 BDR', rent_amount: 0, amenities: {} });
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <div className="flex gap-4 h-full">
            {/* Properties List */}
            <div className="w-1/2 p-4 bg-white rounded shadow text-black">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Properties</h2>
                    <button onClick={() => setIsPropModalOpen(true)} className="bg-blue-600 text-white px-3 py-1 rounded">Add Property</button>
                </div>
                <ul>
                    {properties.map(p => (
                        <li key={p.id} className={`p-4 border-b cursor-pointer hover:bg-gray-50 flex justify-between ${selectedProperty?.id === p.id ? 'bg-blue-50' : ''}`} onClick={() => handleViewUnits(p)}>
                            <div>
                                <div className="font-bold">{p.name}</div>
                                <div className="text-sm text-gray-500">{p.address}</div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Units List */}
            <div className="w-1/2 p-4 bg-white rounded shadow text-black">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Units {selectedProperty ? `- ${selectedProperty.name}` : ''}</h2>
                    {selectedProperty && (
                        <button onClick={handleAddUnitClick} className="bg-green-600 text-white px-3 py-1 rounded">Add Unit</button>
                    )}
                </div>
                {!selectedProperty && <p className="text-gray-500">Select a property to view units.</p>}
                {selectedProperty && (
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
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.status === 'Occupied' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {u.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2">
                                        <button onClick={() => handleEditUnitClick(u)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Property Modal */}
            {isPropModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded w-96">
                        <h3 className="text-lg font-bold mb-4">Add Property</h3>
                        <form onSubmit={handlePropSubmit}>
                            <input className="border w-full p-2 mb-2" placeholder="Property Name" required
                                value={propForm.name} onChange={e => setPropForm({ ...propForm, name: e.target.value })} />
                            <input className="border w-full p-2 mb-2" placeholder="Address" required
                                value={propForm.address} onChange={e => setPropForm({ ...propForm, address: e.target.value })} />
                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setIsPropModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Unit Modal */}
            {isUnitModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded w-96">
                        <h3 className="text-lg font-bold mb-4">{isEditUnitMode ? 'Edit Unit' : 'Add Unit'}</h3>
                        <form onSubmit={handleUnitSubmit}>
                            <div className="mb-2">
                                <label className="block text-sm font-medium text-gray-700">House Number</label>
                                <input className="border w-full p-2" placeholder="House Number (e.g. A1)" required
                                    value={unitForm.house_number} onChange={e => setUnitForm({ ...unitForm, house_number: e.target.value })} />
                            </div>
                            <div className="mb-2">
                                <label className="block text-sm font-medium text-gray-700">Type</label>
                                <select className="border w-full p-2"
                                    value={unitForm.type} onChange={e => setUnitForm({ ...unitForm, type: e.target.value })}>
                                    <option value="Bedsitter">Bedsitter</option>
                                    <option value="1 BDR">1 BDR</option>
                                    <option value="2 BDR">2 BDR</option>
                                    <option value="3 BDR">3 BDR</option>
                                    <option value="Shop">Shop</option>
                                </select>
                            </div>
                            <div className="mb-2">
                                <label className="block text-sm font-medium text-gray-700">Rent Amount</label>
                                <input type="number" className="border w-full p-2" placeholder="Rent Amount" required
                                    value={unitForm.rent_amount} onChange={e => setUnitForm({ ...unitForm, rent_amount: Number(e.target.value) })} />
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setIsUnitModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
