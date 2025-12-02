import { BrowserRouter } from 'react-router-dom';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './Contexts/AuthContext/AuthContext';
import { ProgressProvider } from './Contexts/ProgressContext/ProgressContext';
import './i18n/i18n'; // important for translation


const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <BrowserRouter>
    <AuthProvider>
      <ProgressProvider>
        <App/>
      </ProgressProvider>
    </AuthProvider>
  </BrowserRouter>
);

