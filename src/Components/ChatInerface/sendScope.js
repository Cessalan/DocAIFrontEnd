/**
 * sendScope: one chat answer's view of the screen.
 *
 * WHY THIS EXISTS
 *
 * One ChatInterface serves every chat; it is not remounted when she opens
 * another one. Until 2026-11-14 the state of a chat answer (isStreaming,
 * isAiTyping, streamingStatus, the quiz flag, the stop target) was a single
 * value in that component, so:
 *
 *  - an answer loading in chat A showed as loading in chat B: the Stop
 *    button, and a disabled message box and paperclip, until A finished;
 *  - A's late events (a new quiz bubble, the web-sources panel) were
 *    appended to whatever chat was open;
 *  - Stop in chat B closed the socket of whichever chat had sent last.
 *
 * The backend was never the problem: it runs one socket per chat and a
 * cancel only reaches the answers on that socket.
 *
 * Now every send owns a record, keyed by its chat. The on-screen state is a
 * mirror of the OPEN chat's record and nothing else. A send whose chat is not
 * on screen writes its messages to that chat's parked list instead, which is
 * restored when she opens the chat again (Firestore fills in the rest).
 */

/** Key for a first message whose chat does not exist yet. */
export const NEW_CHAT_KEY = '__new_chat__';

export const sendKey = (chatId) => chatId || NEW_CHAT_KEY;

export const newSendRecord = (chatId) => ({
  chatId: chatId || null,
  stopped: false,
  streaming: true,
  aiTyping: true,
  status: null,
  quizMode: false,
  // Set by the send: flushes and cancels its text throttle when stopped.
  onStop: null,
});

const isLive = (record) => Boolean(record && (record.streaming || record.aiTyping));

/**
 * The setters a send uses instead of the component's. Each one updates the
 * send's own record, and touches the screen only while its chat is open.
 *
 * `screen` holds the component's real setters; `live` and `parked` are the
 * component's Maps; `currentChatId()` reads the chat on screen right now.
 */
export const createSendScope = (record, { live, parked, currentChatId, screen }) => {
  // A first message has no chat id until it is saved; it is on screen.
  const isHere = () => !record.chatId || currentChatId() === record.chatId;

  // A send that is neither streaming nor typing is over: forget it, unless a
  // newer send in the same chat has already taken its place.
  const settle = () => {
    if (isLive(record)) return;
    const key = sendKey(record.chatId);
    if (live.get(key) === record) live.delete(key);
  };

  return {
    record,
    isHere,
    wasStopped: () => record.stopped,

    begin() {
      live.set(sendKey(record.chatId), record);
      if (!isHere()) return;
      screen.setAiTyping(true);
      screen.setStatus(null);
      screen.setStreaming(true);
      screen.setQuizMode(false);
    },

    /** The first message created the chat: re-key the record under its id. */
    moveTo(chatId) {
      if (!chatId || chatId === record.chatId) return;
      const oldKey = sendKey(record.chatId);
      if (live.get(oldKey) === record) live.delete(oldKey);
      record.chatId = chatId;
      if (isLive(record)) live.set(chatId, record);
    },

    setMessages(update) {
      if (isHere()) {
        screen.setMessages(update);
        return;
      }
      const base = parked.get(record.chatId) || [];
      parked.set(record.chatId, typeof update === 'function' ? update(base) : update);
    },
    setStreaming(value) {
      record.streaming = value;
      if (isHere()) screen.setStreaming(value);
      settle();
    },
    setAiTyping(value) {
      record.aiTyping = value;
      if (isHere()) screen.setAiTyping(value);
      settle();
    },
    setStatus(value) {
      record.status = value;
      if (isHere()) screen.setStatus(value);
    },
    setQuizMode(value) {
      record.quizMode = value;
      if (isHere()) screen.setQuizMode(value);
    },
    setQuizFocused(value) {
      if (isHere()) screen.setQuizFocused(value);
    },
  };
};

/** What the screen shows for a chat: its live answer's state, or idle. */
export const screenStateFor = (live, chatId) => {
  const record = live.get(sendKey(chatId));
  return {
    streaming: Boolean(record?.streaming),
    aiTyping: Boolean(record?.aiTyping),
    status: record?.status ?? null,
    quizMode: Boolean(record?.quizMode),
  };
};

/** Leaving a chat: keep its messages if an answer is still coming in. */
export const parkOnLeave = ({ live, parked }, chatId, messages) => {
  if (chatId && isLive(live.get(chatId))) parked.set(chatId, messages);
};

/**
 * Opening a chat: the messages to show before Firestore answers. While its
 * answer is still coming, everything parked. If it finished while she was
 * away, Firestore already has what was saved, so only the error bubbles
 * (never saved, and the only place her Retry lives) are kept.
 */
export const takeParked = ({ live, parked }, chatId) => {
  const messages = parked.get(chatId);
  parked.delete(chatId);
  if (!messages) return [];
  if (isLive(live.get(chatId))) return messages;
  return messages.filter((message) => message.error && !message.isStreaming);
};

/**
 * Stop the answer in ONE chat. Returns its record (null when that chat has
 * nothing live), already marked stopped and forgotten.
 */
export const stopSendFor = (live, chatId) => {
  const key = sendKey(chatId);
  const record = live.get(key);
  if (!record) return null;
  record.stopped = true;
  record.streaming = false;
  record.aiTyping = false;
  live.delete(key);
  if (typeof record.onStop === 'function') record.onStop();
  return record;
};
