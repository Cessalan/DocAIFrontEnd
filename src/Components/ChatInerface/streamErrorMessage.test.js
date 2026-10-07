import { applyStreamError } from './streamErrorMessage';

const failure = { messageId:'stream', relatedIds:['intro'], code:'material_support',
  message:'Please upload a clearer copy of notes.pdf.', retryText:'Generate a quiz' };

test('an error appears after the empathetic introduction removed the placeholder', () => {
  const messages=applyStreamError([{id:'intro',role:'assistant',content:'Preparing your quiz',isStreaming:true}],failure);
  expect(messages).toHaveLength(2);
  expect(messages[0].isStreaming).toBe(false);
  expect(messages[1]).toMatchObject({id:'stream',type:'text',error:true,errorMessage:failure.message,isStreaming:false});
});

test('an empty quiz becomes a visible text error instead of a spinning quiz card', () => {
  const messages=applyStreamError([{id:'quiz',type:'quiz',quizData:[],isStreaming:true}],{...failure,messageId:'quiz'});
  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({id:'quiz',type:'text',error:true,isStreaming:false});
  expect(messages[0].quizData).toBeUndefined();
});

test('questions already delivered survive an error and duplicate errors do not add bubbles', () => {
  const question={question:'A source-based question'};
  const first=applyStreamError([{id:'quiz',type:'quiz',quizData:[question],isStreaming:true}],{...failure,messageId:'quiz'});
  const next=applyStreamError(first,{...failure,messageId:'quiz'});
  expect(next).toHaveLength(2);
  expect(next[0]).toMatchObject({quizData:[question],isStreaming:false});
  expect(next[1]).toMatchObject({id:'quiz-error',type:'text',error:true});
});

test('unexpected backend exceptions keep the generic error and timeout remains distinct', () => {
  const [error]=applyStreamError([],{...failure,code:'internal',message:'private stack trace'});
  expect(error.errorMessage).toBe('');
  const [timeout]=applyStreamError([],{...failure,code:'timeout'});
  expect(timeout.errorKey).toBe('chat.timeoutError');
});
