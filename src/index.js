import { BrowserRouter } from 'react-router-dom';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './Contexts/AuthContext/AuthContext';
import './i18n/i18n'; // important for translation


const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <BrowserRouter>
    <AuthProvider>
        <App/>
    </AuthProvider> 
  </BrowserRouter>
);

