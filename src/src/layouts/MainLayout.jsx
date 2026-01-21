import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import HelpDrawer from '../components/Help/HelpDrawer';
import GuidedTour from '../components/Help/GuidedTour';

export default function MainLayout() {
    const { logout, user } = useAuth();

    return (
        <div className="flex flex-row h-screen w-screen overflow-hidden bg-gray-100">
            <Sidebar />
            <div className="flex-1 overflow-y-auto flex flex-col">
                <div className="bg-white shadow p-4 flex justify-between items-center sticky top-0 z-10">
                    <h2 className="text-xl font-semibold text-gray-800">Welcome, {user?.username}</h2>
                    <button onClick={logout} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm">
                        Logout
                    </button>
                </div>
                <div className="p-8">
                    <Outlet />
                </div>
            </div>
            <HelpDrawer />
            <GuidedTour />
        </div>
    );
}
