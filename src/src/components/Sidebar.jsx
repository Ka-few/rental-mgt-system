import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useHelp } from '../context/HelpContext';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

const navigation = [
    { name: 'Dashboard', href: '/', icon: 'bx-grid-alt', adminOnly: true },
    { name: 'Tenants', href: '/tenants', icon: 'bx-user' },
    { name: 'Properties', href: '/properties', icon: 'bx-building-house', adminOnly: true },
    { name: 'Finance', href: '/finance', icon: 'bx-money' },
    { name: 'Expenditures', href: '/expenses', icon: 'bx-wallet' },
    { name: 'MRI Tax', href: '/mri', icon: 'bx-receipt', adminOnly: true },
    { name: 'Reports', href: '/reports', icon: 'bx-stats', adminOnly: true },
    { name: 'System Users', href: '/users', icon: 'bx-group', adminOnly: true },
    { name: 'Settings', href: '/settings', icon: 'bx-cog', adminOnly: true },
];

export default function Sidebar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { setIsHelpDrawerOpen } = useHelp();
    const { logout, user } = useAuth();
    const userRole = user?.role || JSON.parse(localStorage.getItem('user') || '{}').role;

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to sign out?')) {
            logout();
            navigate('/login');
        }
    };

    const filteredNavigation = navigation.filter(item => !item.adminOnly || userRole === 'admin');

    return (
        <div className="flex flex-col w-64 bg-slate-900 h-screen text-white overflow-hidden">
            <div className="flex items-center justify-center h-36 border-b border-slate-800 shadow-xl px-4 py-6 shrink-0">
                <div className="relative flex items-center justify-center w-28 h-28 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg rotate-3">
                    <img
                        src={logo}
                        alt="Logo"
                        className="w-20 h-20 object-contain p-2 -rotate-3"
                    />
                </div>
            </div>

            {/* Scrollable Navigation Area */}
            <ul className="flex-1 py-6 space-y-1 overflow-y-auto custom-scrollbar">
                {filteredNavigation.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                        <li key={item.name}>
                            <Link
                                to={item.href}
                                className={`flex flex-row items-center h-12 px-4 transition-all duration-200 group ${isActive ? 'text-white bg-blue-600/10 border-r-4 border-blue-500' : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800/50'
                                    }`}
                            >
                                <span className={`inline-flex items-center justify-center h-12 w-10 text-xl transition-colors ${isActive ? 'text-blue-500' : 'text-gray-500 group-hover:text-gray-300'}`}>
                                    <i className={`bx ${item.icon}`}></i>
                                </span>
                                <span className="text-sm font-bold tracking-tight">{item.name}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>

            <div className="mt-auto p-4 space-y-2 border-t border-slate-800 shrink-0">
                <button
                    onClick={() => setIsHelpDrawerOpen(true)}
                    className="flex flex-row items-center h-12 w-full text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg px-2 transition-all group"
                >
                    <span className="inline-flex items-center justify-center h-12 w-10 text-xl group-hover:text-blue-400">
                        <i className="bx bx-help-circle"></i>
                    </span>
                    <span className="text-sm font-bold">Help Center</span>
                </button>
                <button
                    onClick={handleLogout}
                    className="flex flex-row items-center h-12 w-full text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg px-2 transition-all group"
                >
                    <span className="inline-flex items-center justify-center h-12 w-10 text-xl group-hover:scale-110 transition-transform">
                        <i className="bx bx-log-out"></i>
                    </span>
                    <span className="text-sm font-bold uppercase tracking-wider">Log Out</span>
                </button>
                <div className="text-[10px] text-gray-600 mt-2 text-center uppercase tracking-widest font-black">Build 2026.01.21.01</div>
            </div>
        </div>
    );
}
