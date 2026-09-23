import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminGuard from './AdminGuard';
import { onIdTokenChanged } from 'firebase/auth';
import { adminRequest } from '../../Services/AdminService';
jest.mock('firebase/auth', () => ({ onIdTokenChanged: jest.fn() }));
jest.mock('../../Firebase/config', () => ({ auth: {} }));
jest.mock('../../Services/AdminService', () => ({ adminRequest: jest.fn() }));
jest.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/admin', search: '' }), Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>, Outlet: () => <div>Private workspace</div> }), { virtual: true });
const mount = () => render(<AdminGuard />);
beforeEach(() => { jest.clearAllMocks(); onIdTokenChanged.mockImplementation((auth, callback) => { callback({ uid: 'u' }); return jest.fn(); }); });
test('does not render private content for a denied user', async () => {
  adminRequest.mockRejectedValue(new Error('Admin access is required.')); mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('Admin access is required.');
  expect(screen.queryByText('Private workspace')).not.toBeInTheDocument();
});
test('owner sees admin management', async () => {
  adminRequest.mockResolvedValue({ role: 'owner', email: 'owner@example.com' }); mount();
  expect(await screen.findByText('Private workspace')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Admin access' })).toBeInTheDocument();
});
test('regular admin does not get the management navigation', async () => {
  adminRequest.mockResolvedValue({ role: 'admin' }); mount();
  await screen.findByText('Private workspace');
  expect(screen.queryByRole('link', { name: 'Admin access' })).not.toBeInTheDocument();
});
test('connection failures can be retried without asking the user to sign in again', async () => {
  adminRequest.mockRejectedValueOnce(new Error('Cannot connect to the admin backend.'))
    .mockResolvedValueOnce({ role: 'owner' });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Retry connection' }));
  expect(await screen.findByText('Private workspace')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
});
