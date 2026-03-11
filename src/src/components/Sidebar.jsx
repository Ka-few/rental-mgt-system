import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useHelp } from '../context/HelpContext';
import { useAuth } from '../context/AuthContext';
import { useLicense } from '../context/LicenseContext';
import logo from '../assets/logo.png';

const navigation = [
    { name: 'Dashboard', href: '/', icon: 'bx-grid-alt', restricted: false },
    { name: 'Tenants', href: '/tenants', icon: 'bx-user', restricted: false },
    { name: 'Properties', href: '/properties', icon: 'bx-building-house', restricted: false },
    { name: 'Finance', href: '/finance', icon: 'bx-money', restricted: false },
    { name: 'Maintenance', href: '/maintenance', icon: 'bx-wrench', restricted: false },
    { name: 'Expenditures', href: '/expenses', icon: 'bx-wallet', restricted: false },
    { name: 'MRI Tax', href: '/mri', icon: 'bx-receipt', restricted: true },
    { name: 'Reports', href: '/reports', icon: 'bx-stats', restricted: true },
    { name: 'System Users', href: '/users', icon: 'bx-group', restricted: true },
    { name: 'Settings', href: '/settings', icon: 'bx-cog', restricted: false },
];

export default function Sidebar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { setIsHelpDrawerOpen } = useHelp();
    const { logout, user } = useAuth();
    const { license } = useLicense();
    const userRole = user?.role || JSON.parse(localStorage.getItem('user') || '{}').role;

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to sign out?')) {
            logout();
        }
    };

    // Filter based on role if needed, currently showing all but locking some
    const filteredNavigation = navigation;

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
                    const isLocked = item.restricted && license.status === 'TRIAL';

                    if (item.name === 'Properties' && userRole !== 'admin') return null;
                    if (item.name === 'Settings' && userRole !== 'admin') return null;
                    if (item.name === 'System Users' && userRole !== 'admin') return null;
                    if (item.name === 'Reports' && userRole !== 'admin') return null;
                    if (item.name === 'MRI Tax' && userRole !== 'admin') return null;
                    if (item.name === 'Expenditures' && userRole !== 'admin') return null;

                    return (
                        <li key={item.name}>
                            <Link
                                to={isLocked ? '#' : item.href}
                                onClick={(e) => {
                                    if (isLocked) {
                                        e.preventDefault();
                                        alert('This feature is locked in the Trial Version. Please activate to access.');
                                    }
                                }}
                                className={`flex flex-row items-center h-12 px-4 transition-all duration-200 group ${isActive ? 'text-white bg-blue-600/10 border-r-4 border-blue-500' : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800/50'} ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <span className={`inline-flex items-center justify-center h-12 w-10 text-xl transition-colors ${isActive ? 'text-blue-500' : 'text-gray-500 group-hover:text-gray-300'}`}>
                                    <i className={`bx ${item.icon}`}></i>
                                </span>
                                <span className="text-sm font-bold tracking-tight flex-1">{item.name}</span>
                                {isLocked && <i className='bx bx-lock-alt text-gray-500 ml-2'></i>}
                            </Link>
                        </li>
                    );
                })}
            </ul>

            {/* Trial Banner */}
            {license.status === 'TRIAL' && (
                <div className="px-4 py-2 shrink-0">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-3 text-center shadow-lg border border-indigo-400/30">
                        <p className="text-xs font-bold text-white uppercase tracking-wider mb-1">Trial Version</p>
                        <p className="text-xs text-indigo-100 mb-2">{license.daysRemaining} days remaining</p>
                        <Link
                            to="/activation"
                            className="block w-full bg-white text-indigo-600 text-xs font-bold py-1.5 rounded shadow hover:bg-gray-50 transition-colors"
                        >
                            Activate Now
                        </Link>
                    </div>
                </div>
            )}

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
