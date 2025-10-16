// ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../Contexts/AuthContext/AuthContext';

const ProtectedRoute = ({ children }) => {

  const { isUserLoggedIn, isLoading } = useAuth();

  //if (isLoading) return null; // Or a loading spinner

  return isUserLoggedIn ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
