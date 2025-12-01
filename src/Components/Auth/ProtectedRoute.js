// ProtectedRoute.jsx
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import QuizRoomLanding from '../QuizRoom/QuizRoomLanding';

const ProtectedRoute = ({ children }) => {

  const { isUserLoggedIn, isLoading } = useAuth();

  if (isLoading) return null; // Avoid flashing the landing page while auth loads

  // Show landing page for unauthenticated users (no redirect)
  return isUserLoggedIn ? children : <QuizRoomLanding />;
};

export default ProtectedRoute;
