import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ adminOnly }) => {
    const { user } = useAuth();

    if (!user) return <Navigate to="/login" replace />;

    if (adminOnly && user.role !== 'admin') {
        return <Navigate to="/tenants" replace />;
    }

    return <Outlet />;
};

export default PrivateRoute;
