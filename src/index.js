import { BrowserRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import clarity from '@microsoft/clarity';
import App from './App';
import { AuthProvider } from './Contexts/AuthContext/AuthContext';
import { ProgressProvider } from './Contexts/ProgressContext/ProgressContext';
import './i18n/i18n'; // important for translation

if (process.env.NODE_ENV === 'production') {
  clarity.init('wjgn4x5pp6');
}

const root = createRoot(document.getElementById('root'));

root.render(
  <BrowserRouter>
    <AuthProvider>
      <ProgressProvider>
        <App/>
      </ProgressProvider>
    </AuthProvider>
  </BrowserRouter>
);

