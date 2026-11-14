import {
  createSendScope, newSendRecord, parkOnLeave, screenStateFor, stopSendFor, takeParked, NEW_CHAT_KEY,
} from './sendScope';

// A fake screen: the component's setters, recording what reached it.
const makeWorld = (openChat) => {
  const world = {
    open: openChat,
    live: new Map(),
    parked: new Map(),
    messages: [],
    streaming: false,
    aiTyping: false,
    status: null,
    quizMode: false,
    focused: null,
  };
  world.screen = {
    setMessages: (u) => { world.messages = typeof u === 'function' ? u(world.messages) : u; },
    setStreaming: (v) => { world.streaming = v; },
    setAiTyping: (v) => { world.aiTyping = v; },
    setStatus: (v) => { world.status = v; },
    setQuizMode: (v) => { world.quizMode = v; },
    setQuizFocused: (v) => { world.focused = v; },
  };
  world.scope = (chatId) => createSendScope(newSendRecord(chatId), {
    live: world.live, parked: world.parked, currentChatId: () => world.open, screen: world.screen,
  });
  return world;
};

describe('createSendScope', () => {
  it('shows an answer on screen while its chat is open', () => {
    const w = makeWorld('A');
    const send = w.scope('A');
    send.begin();
    send.setMessages(prev => [...prev, { id: 'p' }]);
    expect(w.streaming).toBe(true);
    expect(w.aiTyping).toBe(true);
    expect(w.messages).toEqual([{ id: 'p' }]);
  });

  it('does not show chat A loading while she is in chat B', () => {
    const w = makeWorld('A');
    const send = w.scope('A');
    send.begin();
    w.open = 'B';
    w.streaming = false; w.aiTyping = false; // the switch restored B (idle)
    send.setStatus({ status: 'generating_quiz' });
    send.setQuizMode(true);
    send.setQuizFocused(false);
    expect(w.streaming).toBe(false);
    expect(w.status).toBe(null);
    expect(w.quizMode).toBe(false);
    expect(w.focused).toBe(null);
    expect(screenStateFor(w.live, 'A')).toEqual({ streaming: true, aiTyping: true, status: { status: 'generating_quiz' }, quizMode: true });
    expect(screenStateFor(w.live, 'B')).toEqual({ streaming: false, aiTyping: false, status: null, quizMode: false });
  });

  it('parks chat A messages instead of writing them into chat B', () => {
    const w = makeWorld('A');
    const send = w.scope('A');
    send.begin();
    w.open = 'B';
    w.messages = [{ id: 'b1' }];
    w.parked.set('A', [{ id: 'p', isStreaming: true }]);
    send.setMessages(prev => [...prev, { id: 'quiz', isStreaming: true }]);
    expect(w.messages).toEqual([{ id: 'b1' }]);
    expect(w.parked.get('A')).toEqual([{ id: 'p', isStreaming: true }, { id: 'quiz', isStreaming: true }]);
  });

  it('forgets a send once it is neither streaming nor typing', () => {
    const w = makeWorld('A');
    const send = w.scope('A');
    send.begin();
    send.setStreaming(false);
    expect(w.live.has('A')).toBe(true);
    send.setAiTyping(false);
    expect(w.live.has('A')).toBe(false);
  });

  it('does not forget a newer send in the same chat', () => {
    const w = makeWorld('A');
    const first = w.scope('A');
    first.begin();
    const second = w.scope('A');
    second.begin();
    first.setStreaming(false);
    first.setAiTyping(false);
    expect(w.live.get('A')).toBe(second.record);
  });

  it('re-keys a first message under the chat it created', () => {
    const w = makeWorld(null);
    const send = w.scope(null);
    send.begin();
    expect(w.live.has(NEW_CHAT_KEY)).toBe(true);
    w.open = 'NEW';
    send.moveTo('NEW');
    expect(w.live.has(NEW_CHAT_KEY)).toBe(false);
    expect(w.live.get('NEW')).toBe(send.record);
    expect(send.isHere()).toBe(true);
  });
});

describe('stopSendFor', () => {
  it('stops only the chat it is given', () => {
    const w = makeWorld('A');
    const a = w.scope('A'); a.begin();
    const b = w.scope('B'); b.begin();
    const flushed = jest.fn();
    b.record.onStop = flushed;
    const stopped = stopSendFor(w.live, 'B');
    expect(stopped).toBe(b.record);
    expect(b.wasStopped()).toBe(true);
    expect(flushed).toHaveBeenCalledTimes(1);
    expect(a.wasStopped()).toBe(false);
    expect(w.live.get('A')).toBe(a.record);
  });

  it('returns null when the open chat has nothing live', () => {
    const w = makeWorld('A');
    w.scope('B').begin();
    expect(stopSendFor(w.live, 'A')).toBe(null);
    expect(w.live.has('B')).toBe(true);
  });

  it('stops a first message that is still being saved', () => {
    const w = makeWorld(null);
    const send = w.scope(null);
    send.begin();
    expect(stopSendFor(w.live, null)).toBe(send.record);
  });
});

describe('parking across a chat switch', () => {
  it('keeps a live chat and gives it back while it is still answering', () => {
    const w = makeWorld('A');
    w.scope('A').begin();
    const stores = { live: w.live, parked: w.parked };
    const onScreen = [{ id: 'u' }, { id: 'p', isStreaming: true }];
    parkOnLeave(stores, 'A', onScreen);
    expect(takeParked(stores, 'A')).toEqual(onScreen);
    expect(w.parked.has('A')).toBe(false);
  });

  it('parks nothing for a chat with no live answer', () => {
    const w = makeWorld('A');
    const stores = { live: w.live, parked: w.parked };
    parkOnLeave(stores, 'A', [{ id: 'u' }]);
    expect(takeParked(stores, 'A')).toEqual([]);
  });

  it('keeps only error bubbles when the answer finished while she was away', () => {
    const w = makeWorld('A');
    const send = w.scope('A');
    send.begin();
    const stores = { live: w.live, parked: w.parked };
    parkOnLeave(stores, 'A', [{ id: 'u' }, { id: 'p', isStreaming: true }]);
    w.open = 'B';
    send.setMessages(prev => prev.map(m => (m.id === 'p' ? { ...m, isStreaming: false, error: true } : m)));
    send.setStreaming(false);
    send.setAiTyping(false);
    expect(takeParked(stores, 'A')).toEqual([{ id: 'p', isStreaming: false, error: true }]);
  });
});
