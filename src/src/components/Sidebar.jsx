import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/logo.png';

const navigation = [
    { name: 'Dashboard', href: '/' },
    { name: 'Tenants', href: '/tenants' },
    { name: 'Properties', href: '/properties' },
    { name: 'Finance', href: '/finance' },
    { name: 'Maintenance', href: '/maintenance' },
    { name: 'Reports', href: '/reports' },
    { name: 'Settings', href: '/settings' },
];

export default function Sidebar() {
    const location = useLocation();

    return (
        <div className="flex flex-col w-64 bg-slate-900 h-screen text-white">
            <div className="flex items-center justify-center h-36 shadow-md px-4 py-6">
                <div className="relative flex items-center justify-center w-28 h-28 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-full shadow-lg">
                    <img
                        src={logo}
                        alt="Logo"
                        className="w-20 h-20 object-contain p-2"
                    />
                </div>
            </div>
            <ul className="flex-col py-4">
                {navigation.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                        <li key={item.name}>
                            <Link
                                to={item.href}
                                className={`flex flex-row items-center h-12 transform hover:translate-x-2 transition-transform ease-in duration-200 ${isActive ? 'text-blue-400 bg-slate-800 border-l-4 border-blue-400' : 'text-gray-400 hover:text-gray-200'
                                    }`}
                            >
                                <span className="inline-flex items-center justify-center h-12 w-12 text-lg text-gray-400">
                                    <i className="bx bx-home"></i>{/* Icon placeholder (mock) */}
                                </span>
                                <span className="text-sm font-medium">{item.name}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
            <div className="mt-auto p-4 border-t border-slate-700">
                <div className="text-xs text-gray-500">System v1.0</div>
            </div>
        </div>
    );
}
