import { BrowserRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import clarity from '@microsoft/clarity';
import App from './App';
import { AuthProvider } from './Contexts/AuthContext/AuthContext';
import { ProgressProvider } from './Contexts/ProgressContext/ProgressContext';
import { UsageProvider } from './Contexts/UsageContext/UsageContext';
import { initStudyReminders } from './Services/StudyReminderService';
import './i18n/i18n'; // important for translation

if (process.env.NODE_ENV === 'production') {
  clarity.init('wjgn4x5pp6');
}

// Fire any study reminder that came due while the app was closed, and re-arm
// pending ones. No-op unless the user explicitly opted in and granted
// notification permission.
initStudyReminders();

const root = createRoot(document.getElementById('root'));

root.render(
  <BrowserRouter>
    <AuthProvider>
      <UsageProvider>
        <ProgressProvider>
          <App/>
        </ProgressProvider>
      </UsageProvider>
    </AuthProvider>
  </BrowserRouter>
);

