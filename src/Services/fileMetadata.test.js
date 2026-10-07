jest.mock('../Firebase/config',()=>({db:{},auth:{},storage:{}}));
jest.mock('firebase/firestore',()=>({doc:jest.fn((...path)=>path),setDoc:jest.fn(),serverTimestamp:()=> 'server-time'}));
jest.mock('./FastAPICalls',()=>({generate_title:jest.fn()}));
import { doc, setDoc } from 'firebase/firestore';
import { SaveFileMetaData } from './FireBaseServiceChats';

beforeEach(()=>{ jest.clearAllMocks(); doc.mockReturnValue({path:'chats/chat/uploads/file'}); });

test('metadata saves before the background upload has produced a download URL',async()=>{
  await SaveFileMetaData('chat',{id:'file',name:'notes.pdf',downloadURL:undefined},undefined,undefined);
  expect(setDoc).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({downloadURL:null,wordCount:0}));
  expect(Object.values(setDoc.mock.calls[0][1])).not.toContain(undefined);
});

test('the existing download URL is retained when no separate URL is supplied',async()=>{
  await SaveFileMetaData('chat',{id:'file',name:'notes.pdf',downloadURL:'https://example.com/notes.pdf'},undefined,100);
  expect(setDoc.mock.calls[0][1]).toMatchObject({downloadURL:'https://example.com/notes.pdf',wordCount:100});
});
