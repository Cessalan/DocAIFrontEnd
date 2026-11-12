import { WebSocketManager } from './WebSocketManager';

/**
 * Watchdog behaviour for the silent-response bug.
 *
 * The scenario these cover is the real one: the socket stays open, the backend
 * acks with status:"processing", and then nothing else ever arrives. Before the
 * watchdog the UI typed forever; two of our most engaged students hit that 10
 * and 32 times and one of them stopped coming back.
 *
 * Timings are asserted relative to the constants' behaviour (45s to the first
 * substantive event, 90s of silence mid-stream) rather than re-declared here,
 * so tuning the constants only breaks these tests if the SHAPE changes.
 */
describe('WebSocketManager silent-response watchdog', () => {
  let mgr;
  let notify;

  beforeEach(() => {
    jest.useFakeTimers();
    mgr = new WebSocketManager();
    notify = jest.fn();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('fails the stream when nothing ever comes back', () => {
    mgr.setActiveStream('chat-1', notify);

    jest.advanceTimersByTime(44000);
    expect(notify).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2000);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', code: 'timeout' })
    );
  });

  test('the "processing" ack does NOT buy the longer stall window', () => {
    mgr.setActiveStream('chat-1', notify);

    // Backend acks immediately, then dies. This is exactly what happened to
    // the messages that vanished: the ack landed, the answer never did.
    jest.advanceTimersByTime(2000);
    mgr.kickWatchdog('chat-1', false); // false = not substantive

    jest.advanceTimersByTime(44000);
    expect(notify).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2000); // 45s after the ack, not after the send
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'timeout' })
    );
  });

  test('a substantive event widens the window to the stall timeout', () => {
    mgr.setActiveStream('chat-1', notify);

    jest.advanceTimersByTime(3000);
    mgr.kickWatchdog('chat-1', true); // first real output

    // Would have fired under the short window; must not now.
    jest.advanceTimersByTime(60000);
    expect(notify).not.toHaveBeenCalled();

    jest.advanceTimersByTime(31000); // past 90s of silence
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'timeout' })
    );
  });

  test('a stream that keeps producing output is never failed', () => {
    mgr.setActiveStream('chat-1', notify);

    // 5 minutes of a slow but live generation — longer than the server's own
    // 300s idle timeout, which is the point: chunks keep it alive.
    for (let i = 0; i < 10; i += 1) {
      jest.advanceTimersByTime(30000);
      mgr.kickWatchdog('chat-1', true);
    }

    expect(notify).not.toHaveBeenCalled();
  });

  test('completing the stream disarms the watchdog', () => {
    mgr.setActiveStream('chat-1', notify);
    mgr.clearActiveStream('chat-1');

    jest.advanceTimersByTime(600000);
    expect(notify).not.toHaveBeenCalled();
  });

  test('a failed stream fires once, not once per window', () => {
    mgr.setActiveStream('chat-1', notify);

    jest.advanceTimersByTime(46000);
    jest.advanceTimersByTime(600000);

    expect(notify).toHaveBeenCalledTimes(1);
  });

  test('kicking with no request in flight is a no-op', () => {
    expect(() => mgr.kickWatchdog('chat-nobody', true)).not.toThrow();
    jest.advanceTimersByTime(600000);
    expect(notify).not.toHaveBeenCalled();
  });

  test('watchdogs are per chat', () => {
    const other = jest.fn();
    mgr.setActiveStream('chat-1', notify);
    jest.advanceTimersByTime(20000);
    mgr.setActiveStream('chat-2', other);

    // chat-2 keeps streaming; chat-1 is silent and should fail on its own.
    jest.advanceTimersByTime(26000);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ code: 'timeout' }));
    expect(other).not.toHaveBeenCalled();
  });
});

/**
 * Keepalive only while the chat is in use. Unconditional pings kept every open
 * tab's socket alive (the server counts a ping as activity) and Cloud Run
 * billed CPU for all of it. A request in flight must still be kept alive no
 * matter how long it runs: that is the upload/long-quiz fix.
 */
describe('WebSocketManager keepalive', () => {
  let mgr;
  let ws;
  const pings = () => ws.send.mock.calls.filter(([m]) => JSON.parse(m).type === 'ping').length;

  beforeEach(() => {
    jest.useFakeTimers();
    mgr = new WebSocketManager();
    ws = { readyState: WebSocket.OPEN, send: jest.fn() };
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    mgr.stopKeepalive('chat-1');
    mgr.clearActiveStream('chat-1');
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('pings for the first minutes after the socket opens', () => {
    mgr.startKeepalive('chat-1', ws);
    jest.advanceTimersByTime(4 * 60 * 1000);
    expect(pings()).toBe(2);
  });

  test('stops pinging once the chat has been idle for 5 minutes', () => {
    mgr.startKeepalive('chat-1', ws);
    jest.advanceTimersByTime(5 * 60 * 1000);
    const before = pings();
    jest.advanceTimersByTime(30 * 60 * 1000);
    expect(pings()).toBe(before);
  });

  test('keeps pinging for as long as a request is in flight', () => {
    mgr.startKeepalive('chat-1', ws);
    mgr.setActiveStream('chat-1', jest.fn());
    // Keep the watchdog fed so the stream stays active, as a long upload would.
    for (let i = 0; i < 15; i += 1) {
      jest.advanceTimersByTime(60 * 1000);
      mgr.kickWatchdog('chat-1', true);
    }
    expect(pings()).toBeGreaterThanOrEqual(7);
  });

  test('resumes pinging when the student comes back', () => {
    mgr.startKeepalive('chat-1', ws);
    jest.advanceTimersByTime(20 * 60 * 1000);
    const idle = pings();
    mgr.markActivity('chat-1');
    jest.advanceTimersByTime(2 * 60 * 1000);
    expect(pings()).toBe(idle + 1);
  });
});

/**
 * Stop. Before 2026-11-11 stop only sent cancel_stream and kept listening; the
 * backend read it after the answer had finished, so the whole answer arrived
 * under the "stopped" one. Stop now has to hold without the backend's help.
 */
describe('WebSocketManager stopStream', () => {
  let mgr;
  let ws;

  beforeEach(() => {
    jest.useFakeTimers();
    mgr = new WebSocketManager();
    ws = { readyState: WebSocket.OPEN, send: jest.fn(), close: jest.fn() };
    mgr.connections.set('chat-1', ws);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('no frame of the stopped answer reaches the listener', () => {
    const onMessage = jest.fn();
    mgr.setupMessageListener('chat-1', onMessage);
    mgr.setActiveStream('chat-1', jest.fn());

    mgr.stopStream('chat-1');

    // A closing socket can still deliver frames already on the wire.
    if (ws.onmessage) ws.onmessage({ data: JSON.stringify({ type: 'stream_chunk', data: { answer_chunk: 'late' } }) });
    expect(onMessage).not.toHaveBeenCalled();
  });

  test('asks the backend to cancel, then closes the socket', () => {
    mgr.stopStream('chat-1');

    expect(JSON.parse(ws.send.mock.calls[0][0]).type).toBe('cancel_stream');
    expect(ws.close).toHaveBeenCalled();
    expect(mgr.connections.has('chat-1')).toBe(false);
  });

  test('a stopped request is not reported as a failure, then or later', () => {
    const notify = jest.fn();
    mgr.setActiveStream('chat-1', notify);

    mgr.stopStream('chat-1');
    jest.advanceTimersByTime(600000);

    expect(notify).not.toHaveBeenCalled();
  });

  test('stopping with no socket open is a no-op', () => {
    expect(mgr.stopStream('chat-nobody')).toBe(false);
  });
});
