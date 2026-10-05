import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AdminEmail from './AdminEmail';
import { adminRequest } from '../../Services/AdminService';
jest.mock('../../Services/AdminService', () => ({adminRequest:jest.fn()}));
const draft = {id:'review1',actor:'admin',kind:'campaign',subject:'Hello',message:'My message',html:'<p><b>My message</b></p>',to:'2 students',from:'Team',sendingEnabled:true,total:2,remainingToday:50,recipients:[{uid:'a',to:'alex@example.com',status:'pending'},{uid:'b',to:'sam@example.com',status:'pending'}]};
let rows, templates, settings, batches;
beforeEach(() => {
  rows=[]; templates=[]; batches=0;
  settings={enabled:true,ready:true,testEmail:'secretary@example.com',remainingToday:50,issues:[]};
  adminRequest.mockReset();
  adminRequest.mockImplementation((path, options) => {
    if (path.endsWith('/settings')) return Promise.resolve(settings);
    if (path.includes('/students?')) return Promise.resolve({items:[{uid:'a',name:'Alex Nurse',email:'alex@example.com'},{uid:'b',name:'Sam Nurse',email:'sam@example.com'}],cursor:null});
    if (path.endsWith('/templates')) return Promise.resolve(options ? {id:'template1'} : {items:templates});
    if (path.endsWith('/drafts')) return Promise.resolve({id:'saved1'});
    if (path.endsWith('/test')) return Promise.resolve({status:'sent',to:'secretary@example.com'});
    if (path.endsWith('/batch')) { batches++; return Promise.resolve({canContinue:false,counts:{sent:2,dry_run:0,skipped:0,failed:0,pending:0}}); }
    if (path.endsWith('/preview')) return Promise.resolve({...draft,sendingEnabled:settings.enabled});
    return Promise.resolve({items:rows});
  });
});
async function renderEmail() {
  render(<AdminEmail actorUid="admin" />);
  await act(async () => { await Promise.resolve(); });
}
const changeMessage = (text, html='<p>'+text+'</p>') => {
  const editor=screen.getByRole('textbox',{name:'Message'});
  editor.innerHTML=html; fireEvent.input(editor);
};
async function compose(kind='Announcement') {
  fireEvent.click(screen.getByRole('button',{name:'Write an email'}));
  fireEvent.click(screen.getByRole('button',{name:new RegExp(kind)}));
  fireEvent.change(screen.getByLabelText('Subject'),{target:{value:'Hello'}});
  changeMessage('My message','<p><b>My message</b></p>');
}
async function review() {
  await compose(); fireEvent.click(screen.getByRole('button',{name:'Review email'}));
  await screen.findByTitle('Rendered email');
}
test('starts on an email home screen, with separate compose and review screens',async()=>{
  await renderEmail();
  expect(screen.queryByRole('textbox',{name:'Message'})).not.toBeInTheDocument();
  await review();
  expect(screen.queryByRole('textbox',{name:'Message'})).not.toBeInTheDocument();
  expect(screen.getByTitle('Rendered email')).toHaveAttribute('sandbox','');
  expect(screen.getByTitle('Rendered email')).toHaveAttribute('srcdoc',draft.html);
  expect(screen.getByRole('button',{name:'Send to 2 students'})).toBeEnabled();
  expect(batches).toBe(0);
});
test('formatting is included in the reviewed payload',async()=>{
  await renderEmail(); await review();
  const call=adminRequest.mock.calls.find(([path])=>path.endsWith('/campaign/preview'));
  expect(JSON.parse(call[1].body).html).toBe('<p><b>My message</b></p>');
});
test('back to editing keeps content and requires another review',async()=>{
  await renderEmail(); await review();
  fireEvent.click(screen.getByRole('button',{name:'Back to editing'}));
  expect(screen.getByRole('textbox',{name:'Message'})).toHaveTextContent('My message');
  changeMessage('Changed');
  expect(screen.queryByRole('button',{name:'Send to 2 students'})).not.toBeInTheDocument();
});
test('searchable student selection sends only selected account addresses to preview',async()=>{
  await renderEmail(); await compose();
  fireEvent.change(screen.getByLabelText('Audience'),{target:{value:'selected'}});
  fireEvent.change(screen.getByLabelText('Find a student'),{target:{value:'Alex'}});
  fireEvent.click(await screen.findByRole('checkbox',{name:/Alex Nurse/}));
  fireEvent.click(screen.getByRole('button',{name:'Review email'}));
  await screen.findByTitle('Rendered email');
  const call=adminRequest.mock.calls.find(([path])=>path.endsWith('/campaign/preview'));
  expect(JSON.parse(call[1].body).emails).toEqual(['alex@example.com']);
  expect(adminRequest.mock.calls.some(([path])=>path.endsWith('/students?q=Alex'))).toBe(true);
});
test('invalid pasted emails stay in compose with an explanation',async()=>{
  await renderEmail(); await compose();
  fireEvent.change(screen.getByLabelText('Audience'),{target:{value:'selected'}});
  fireEvent.click(screen.getByText('Paste a list of email addresses'));
  fireEvent.change(screen.getByLabelText('Student emails'),{target:{value:'invalid'}});
  fireEvent.click(screen.getByRole('button',{name:'Review email'}));
  expect(screen.getByRole('alert')).toHaveTextContent('each email address is valid');
  expect(adminRequest.mock.calls.some(([path])=>path.endsWith('/campaign/preview'))).toBe(false);
});
test('an incomplete draft can be saved and closed without sending',async()=>{
  await renderEmail();
  fireEvent.click(screen.getByRole('button',{name:'Write an email'}));
  fireEvent.click(screen.getByRole('button',{name:/Personal message/}));
  fireEvent.click(screen.getByRole('button',{name:'Save draft & close'}));
  await screen.findByRole('button',{name:'Write an email'});
  const call=adminRequest.mock.calls.find(([path])=>path.endsWith('/drafts'));
  expect(JSON.parse(call[1].body).subject).toBe('');
  expect(batches).toBe(0);
});
test('saved drafts restore their content and reuse their save id',async()=>{
  rows=[{id:'saved1',actor:'admin',status:'composing',audience:'all',subject:'Saved note',message:'Saved words',html:'<p>Saved words</p>'}];
  await renderEmail();
  fireEvent.click(await screen.findByRole('button',{name:'Continue writing'}));
  expect(screen.getByLabelText('Subject')).toHaveValue('Saved note');
  expect(screen.getByRole('textbox',{name:'Message'})).toHaveTextContent('Saved words');
  fireEvent.click(screen.getByRole('button',{name:'Save draft & close'}));
  await screen.findByRole('button',{name:'Write an email'});
  expect(JSON.parse(adminRequest.mock.calls.find(([path])=>path.endsWith('/drafts'))[1].body).draft_id).toBe('saved1');
});
test('inbox check calls only the test endpoint and leaves the group ready to send',async()=>{
  await renderEmail(); await review();
  fireEvent.click(screen.getByRole('button',{name:'Send myself a test'}));
  expect(await screen.findByRole('status')).toHaveTextContent('secretary@example.com');
  expect(adminRequest.mock.calls.filter(([path])=>path.endsWith('/review1/test'))).toHaveLength(1);
  expect(batches).toBe(0);
  expect(screen.getByRole('button',{name:'Test sent to your inbox'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Send to 2 students'})).toBeEnabled();
});
test('practice mode disables real test emails and labels the group action clearly',async()=>{
  settings.enabled=false;
  await renderEmail(); await review();
  expect(screen.getByRole('button',{name:'Send myself a test'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Try a practice send'})).toBeEnabled();
});
test('sending happens only on the final action and returns to email history',async()=>{
  await renderEmail(); await review();
  fireEvent.click(screen.getByRole('button',{name:'Send to 2 students'}));
  await screen.findByRole('button',{name:'Write an email'});
  expect(batches).toBe(1);
  expect(screen.getByRole('status')).toHaveTextContent('2 sent');
});
test('large groups continue in batches only after the explicit send action',async()=>{
  const original=adminRequest.getMockImplementation();
  adminRequest.mockImplementation((path,options)=>path.endsWith('/batch')?Promise.resolve({canContinue:++batches<2,counts:{sent:batches,dry_run:0,skipped:0,failed:0,pending:2-batches}}):original(path,options));
  await renderEmail(); await review();
  expect(batches).toBe(0);
  fireEvent.click(screen.getByRole('button',{name:'Send to 2 students'}));
  await screen.findByRole('button',{name:'Write an email'});
  expect(batches).toBe(2);
});
test('an uncertain group send returns to history without an automatic retry',async()=>{
  const original=adminRequest.getMockImplementation();
  adminRequest.mockImplementation((path,options)=>path.endsWith('/batch')?Promise.reject(new Error('Send outcome is uncertain. Check history.')):original(path,options));
  await renderEmail(); await review();
  fireEvent.click(screen.getByRole('button',{name:'Send to 2 students'}));
  await screen.findByRole('button',{name:'Write an email'});
  expect(screen.getByRole('alert')).toHaveTextContent('outcome is uncertain');
  expect(adminRequest.mock.calls.filter(([path])=>path.endsWith('/batch'))).toHaveLength(1);
});
test('saving a template includes content but no recipient information',async()=>{
  await renderEmail(); await compose();
  fireEvent.click(screen.getByText('Save this message as a template'));
  fireEvent.change(screen.getByLabelText('Template name'),{target:{value:'Weekly hello'}});
  fireEvent.click(screen.getByRole('button',{name:'Save template',exact:true}));
  await screen.findByRole('status');
  const body=JSON.parse(adminRequest.mock.calls.find(([path,options])=>path.endsWith('/templates')&&options)[1].body);
  expect(body).toEqual({name:'Weekly hello',subject:'Hello',message:'My message',html:'<p><b>My message</b></p>'});
});
test('saved template starts a new email without reusing recipient addresses',async()=>{
  templates=[{id:'t1',name:'Weekly hello',subject:'Checking in',message:'How are you?',html:'<p>How are you?</p>',email:'must-not-carry@example.com'}];
  await renderEmail();
  await waitFor(()=>expect(adminRequest).toHaveBeenCalledWith('/admin/workspace/email/templates'));
  fireEvent.click(screen.getByRole('button',{name:'Write an email'}));
  fireEvent.click(await screen.findByRole('button',{name:/Weekly hello/}));
  expect(screen.getByLabelText('Subject')).toHaveValue('Checking in');
  expect(screen.getByText('0 students selected')).toBeInTheDocument();
  expect(screen.queryByText('must-not-carry@example.com')).not.toBeInTheDocument();
});
test('paused campaigns review remaining recipients and cannot be accidentally edited into a new send',async()=>{
  rows=[{...draft,status:'paused',recipients:[{uid:'a',to:'alex@example.com',status:'sent'},{uid:'b',to:'sam@example.com',status:'pending'}]}];
  adminRequest.mockImplementation(path=>Promise.resolve(path.endsWith('/preview')?rows[0]:path.endsWith('/settings')?settings:{items:rows}));
  await renderEmail();
  fireEvent.click(await screen.findByRole('button',{name:'Review remaining students'}));
  await screen.findByRole('button',{name:'Send to 1 student'});
  expect(screen.queryByRole('button',{name:'Back to editing'})).not.toBeInTheDocument();
});
