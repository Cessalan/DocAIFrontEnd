import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminEmail from './AdminEmail';
import { adminRequest } from '../../Services/AdminService';
jest.mock('../../Services/AdminService', () => ({ adminRequest: jest.fn() }));
const draft = { id:'draft1', to:'student@example.com', subject:'Hello', html:'<p>Rendered message</p>', from:'Team', sendingEnabled:true };
test('empty fields allow a layout preview without a send action', async () => {
  adminRequest.mockImplementation(path => Promise.resolve(path.endsWith('/layout-preview') ? {previewOnly:true,subject:'(No subject yet)',to:'Recipient not confirmed',html:'<p>Preview</p>'} : {items:[]}));
  render(<AdminEmail />);
  fireEvent.click(screen.getByRole('button',{name:'Preview email'}));
  await screen.findByTitle('Rendered email');
  expect(screen.queryByRole('button',{name:'Send email'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Record dry run'})).not.toBeInTheDocument();
  expect(adminRequest.mock.calls.some(([path])=>path.endsWith('/layout-preview'))).toBe(true);
});
test('design appears in the main preview and keeps the copy editable', async () => {
  render(<AdminEmail />);
  fireEvent.change(screen.getByLabelText('Subject'), {target:{value:'Original'}});
  fireEvent.change(screen.getByLabelText('Message'), {target:{value:'My exact words'}});
  fireEvent.change(screen.getByLabelText('AI instructions'), {target:{value:'Coral header'}});
  adminRequest.mockImplementation(path => Promise.resolve(path.endsWith('/ai-draft') ? {subject:'Changed',message:'Rewritten',html:'<h1>My exact words</h1>'} : path.endsWith('/layout-preview') ? {previewOnly:true,html:'<h1>My exact words</h1>'} : {items:[]}));
  fireEvent.click(screen.getByRole('button',{name:'Design my email'}));
  const frame = await screen.findByTitle('Rendered email');
  expect(frame).toHaveAttribute('srcdoc','<h1>My exact words</h1>');
  expect(screen.getByLabelText('Subject')).toHaveValue('Original');
  expect(screen.getByLabelText('Message')).toHaveValue('My exact words');
  expect(screen.queryByRole('button',{name:'Use this design'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Send email'})).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Message'), {target:{value:'New copy'}});
  expect(screen.queryByTitle('Rendered email')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Design my email'})).toBeInTheDocument();
});
beforeEach(() => { jest.clearAllMocks(); adminRequest.mockImplementation((path) => Promise.resolve(path.endsWith('/preview') ? draft : path.endsWith('/send') ? {status:'sent'} : {items:[]})); });
async function preview() {
  fireEvent.change(screen.getByLabelText('To'), {target:{value:'student@example.com'}});
  fireEvent.change(screen.getByLabelText('Subject'), {target:{value:'Hello'}});
  fireEvent.change(screen.getByLabelText('Message'), {target:{value:'My message'}});
  fireEvent.click(screen.getByRole('button',{name:'Preview email'}));
  return screen.findByTitle('Rendered email');
}
test('previews server HTML in a sandbox and only sends on explicit click', async () => {
  render(<AdminEmail />);
  const frame=await preview();
  expect(frame).toHaveAttribute('srcdoc',draft.html);
  expect(frame).toHaveAttribute('sandbox','');
  expect(adminRequest.mock.calls.some(([p])=>p.endsWith('/send'))).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'Send email'}));
  await screen.findByRole('status');
  expect(adminRequest.mock.calls.filter(([p])=>p.endsWith('/send'))).toHaveLength(1);
  expect(screen.queryByRole('button',{name:'Send email'})).not.toBeInTheDocument();
});
test('editing invalidates reviewed draft', async () => {
  render(<AdminEmail />); await preview();
  fireEvent.change(screen.getByLabelText('Message'),{target:{value:'Updated message'}});
  expect(screen.queryByTitle('Rendered email')).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Send email'})).not.toBeInTheDocument();
});
test('failed send removes send control to avoid ambiguous retries',async()=>{
  render(<AdminEmail />); await preview();
  adminRequest.mockImplementation(path=>path.endsWith('/send')?Promise.reject(new Error('Outcome uncertain')):Promise.resolve({items:[]}));
  fireEvent.click(screen.getByRole('button',{name:'Send email'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Outcome uncertain');
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Send email'})).not.toBeInTheDocument());
});
test('all students previews an audience without requiring a single email',async()=>{
  adminRequest.mockImplementation(path=>Promise.resolve(path.endsWith('/preview')?{...draft,kind:'campaign',total:2,to:'2 students',excluded:1,remainingToday:20,recipients:[{uid:'a',to:'a@example.com'},{uid:'b',to:'b@example.com'}]}:{items:[]}));
  render(<AdminEmail />);
  fireEvent.change(screen.getByLabelText('Audience'),{target:{value:'all'}});
  expect(screen.queryByLabelText('To')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Subject'),{target:{value:'News'}});
  fireEvent.change(screen.getByLabelText('Message'),{target:{value:'New feature'}});
  fireEvent.click(screen.getByRole('button',{name:'Preview email'}));
  await screen.findByRole('button',{name:'Send to 2 students'});
  expect(screen.getByText('a@example.com')).toBeInTheDocument();
  expect(adminRequest.mock.calls.find(([p])=>p.endsWith('/campaign/preview'))[1].body).toContain('"audience":"all"');
  expect(adminRequest.mock.calls.some(([p])=>p.endsWith('/batch'))).toBe(false);
});

