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
