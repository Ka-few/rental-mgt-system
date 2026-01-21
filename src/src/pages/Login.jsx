import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login, user } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    useEffect(() => {
        if (user) navigate('/');
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password) {
            toast.warning('Please enter your credentials');
            return;
        }

        setIsLoading(true);
        try {
            await login(username, password);
            toast.success('Successfully logged in!');
            navigate('/');
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-in">
                <div className="bg-blue-600 p-8 text-center text-white">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/30">
                        <span className="text-white text-3xl font-black">R</span>
                    </div>
                    <h2 className="text-3xl font-black tracking-tight">Rental-Mgt</h2>
                    <p className="text-blue-100 mt-2 font-medium opacity-80 uppercase text-xs tracking-widest">Enterprise Edition</p>
                </div>

                <div className="p-10">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Username</label>
                            <input
                                type="text"
                                className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                                value={username}
                                placeholder="Admin"
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Password</label>
                            <input
                                type="password"
                                className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                                value={password}
                                placeholder="••••••••"
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full py-4 rounded-xl text-white font-black text-lg shadow-lg hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-2 ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
                                }`}
                        >
                            {isLoading ? (
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">&copy; 2026 Ka-few Development</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;
