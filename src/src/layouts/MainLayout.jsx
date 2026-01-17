import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

export default function MainLayout() {
    return (
        <div className="flex flex-row h-screen w-screen overflow-hidden bg-gray-100">
            <Sidebar />
            <div className="flex-1 overflow-y-auto">
                <div className="p-8">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
