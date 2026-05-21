import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { auth } from '../../Firebase/config';
import {
  recording_start,
  recording_upload_chunk,
  recording_finalize,
  recording_cancel,
} from '../../Services/FastAPICalls';

const RecordClassContext = createContext(null);

export const useRecordClass = () => {
  const ctx = useContext(RecordClassContext);
  if (!ctx) throw new Error('useRecordClass must be used inside RecordClassProvider');
  return ctx;
};

const STATUS = {
  IDLE: 'idle',
  REQUESTING: 'requesting',
  RECORDING: 'recording',
  PAUSED: 'paused',
  REVIEWING: 'reviewing',
};

const TX_STATUS = {
  IDLE: 'idle',
  UPLOADING: 'uploading',
  TRANSCRIBING: 'transcribing',
  FINALIZING: 'finalizing',
  READY: 'ready',
  ERROR: 'error',
};

// Match the current URL against the chat route `/c/:chatId`. Returns null if
// the user isn't on a chat page (e.g. landing). Used so recordings started from
// inside a chat attach to that chat instead of spawning a new one.
const extractChatIdFromPath = (pathname) => {
  if (!pathname) return null;
  const match = pathname.match(/^\/c\/([^/?#]+)/);
  return match ? match[1] : null;
};

export const RECORDING_FILES_REFRESH_EVENT = 'nq:recording-files-refresh';
// Fired whenever the recording overlay opens or closes. App.js listens
// so it can collapse the sidebar while the user is in the recording flow
// and restore it when they exit. Detail: { open: boolean }.
export const RECORDING_OVERLAY_STATE_EVENT = 'nq:recording-overlay-state';

export const RecordClassProvider = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const [status, setStatus] = useState(STATUS.IDLE);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [bytesRecorded, setBytesRecorded] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [error, setError] = useState(null);

  // Transcription pipeline state
  const [txStatus, setTxStatus] = useState(TX_STATUS.IDLE);
  const [txError, setTxError] = useState(null);
  const [recordingId, setRecordingId] = useState(null);
  const [resultChatId, setResultChatId] = useState(null);
  const [resultTitle, setResultTitle] = useState('');
  const [resultPreview, setResultPreview] = useState('');

  // New additions: topic, events and live key points
  const [topic, setTopic] = useState('');
  const [events, setEvents] = useState([]);
  const [liveKeyPoints, setLiveKeyPoints] = useState([]);

  // When the overlay is opened from inside an existing chat, we attach the
  // recording to that chat instead of creating a new one. Tracked as state so
  // the IdleScreen can hide the topic input (we already have a chat title).
  const [attachToChatId, setAttachToChatId] = useState(null);

  // Audio capture source:
  //  - 'mic'    → standard microphone (echo cancellation on, ideal for live
  //              in-person lectures)
  //  - 'device' → getDisplayMedia captures tab/system audio directly (for
  //              recorded videos, Zoom playback, podcasts playing on the
  //              user's own device — echo cancellation would otherwise
  //              filter that audio away).
  const [audioSource, setAudioSource] = useState('mic');

  const recordingIdRef = useRef(null);
  const topicRef = useRef('');
  const eventsRef = useRef([]);
  const attachToChatIdRef = useRef(null);
  // Holds the latest stopRecording function so the getDisplayMedia
  // track-end listener (registered inside startRecording, before
  // stopRecording is in scope) can call it without stale-closure issues.
  const stopRecordingRef = useRef(null);
  const mimeTypeRef = useRef('');
  const isStoppingRef = useRef(false);
  const isPausedRef = useRef(false);
  const chunkTimeoutRef = useRef(null);
  const currentChunkIndexRef = useRef(0);
  const currentChunkChunksRef = useRef([]);
  const chunkStartTimeRef = useRef(0);

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const startTimeRef = useRef(0);
  const accumulatedMsRef = useRef(0);
  const tickIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const finalDurationMsRef = useRef(0);

  // Sync refs with state
  useEffect(() => {
    recordingIdRef.current = recordingId;
  }, [recordingId]);

  useEffect(() => {
    topicRef.current = topic;
  }, [topic]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    attachToChatIdRef.current = attachToChatId;
  }, [attachToChatId]);

  // Broadcast overlay open/closed so App can collapse + restore the sidebar
  // for an immersive recording experience.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(RECORDING_OVERLAY_STATE_EVENT, {
      detail: { open: isOverlayOpen },
    }));
  }, [isOverlayOpen]);

  const cleanupAudioAnalysis = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const stopTimer = useCallback(() => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    startTimeRef.current = Date.now();
    tickIntervalRef.current = setInterval(() => {
      setElapsedMs(accumulatedMsRef.current + (Date.now() - startTimeRef.current));
    }, 200);
  }, [stopTimer]);

  const setupAudioAnalysis = useCallback((stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length / 255;
        setAudioLevel(avg);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.warn('Audio analysis setup failed', e);
    }
  }, []);

  const openOverlay = useCallback((opts = {}) => {
    // If the caller didn't explicitly pass a chatId, infer one from the URL —
    // /c/:chatId means "record into this chat", anywhere else (landing, etc.)
    // means "start a new chat". The sidebar button passes no args.
    const chatId = opts.chatId !== undefined
      ? (opts.chatId || null)
      : extractChatIdFromPath(location.pathname);
    setAttachToChatId(chatId);
    attachToChatIdRef.current = chatId;
    setIsOverlayOpen(true);
    setIsMinimized(false);
  }, [location.pathname]);

  const minimize = useCallback(() => {
    setIsMinimized(true);
    setIsOverlayOpen(false);
  }, []);

  const expand = useCallback(() => {
    setIsMinimized(false);
    setIsOverlayOpen(true);
  }, []);

  const reset = useCallback(() => {
    stopTimer();
    cleanupAudioAnalysis();
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (chunkTimeoutRef.current) {
      clearTimeout(chunkTimeoutRef.current);
      chunkTimeoutRef.current = null;
    }
    mediaRecorderRef.current = null;
    accumulatedMsRef.current = 0;
    finalDurationMsRef.current = 0;
    setAudioBlob(null);
    setElapsedMs(0);
    setBytesRecorded(0);
    setAudioLevel(0);
    setStatus(STATUS.IDLE);
    setIsOverlayOpen(false);
    setIsMinimized(false);
    setError(null);
    setTxStatus(TX_STATUS.IDLE);
    setTxError(null);
    setRecordingId(null);
    setResultChatId(null);
    setResultTitle('');
    setResultPreview('');
    setTopic('');
    setEvents([]);
    setLiveKeyPoints([]);
    setAttachToChatId(null);
    attachToChatIdRef.current = null;
    isStoppingRef.current = false;
    isPausedRef.current = false;
    currentChunkIndexRef.current = 0;
    currentChunkChunksRef.current = [];
  }, [cleanupAudioAnalysis, stopTimer]);

  const uploadChunk = useCallback(async (blob, index, durationMs) => {
    if (!recordingIdRef.current) return;
    try {
      const res = await recording_upload_chunk(recordingIdRef.current, blob, index, durationMs);
      if (res && res.key_points && Array.isArray(res.key_points)) {
        setLiveKeyPoints((prev) => [...prev, ...res.key_points]);
      }
    } catch (err) {
      console.error(`Chunk ${index} upload failed:`, err);
    }
  }, []);

  const startChunk = useCallback((index) => {
    if (isStoppingRef.current) return;

    currentChunkIndexRef.current = index;
    currentChunkChunksRef.current = [];
    chunkStartTimeRef.current = Date.now();

    const recorder = new MediaRecorder(
      mediaStreamRef.current,
      mimeTypeRef.current ? { mimeType: mimeTypeRef.current } : undefined
    );
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        currentChunkChunksRef.current.push(e.data);
        setBytesRecorded((prev) => prev + e.data.size);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(currentChunkChunksRef.current, {
        type: mimeTypeRef.current || 'audio/webm',
      });

      let uploadPromise = Promise.resolve();
      if (blob.size > 0 && recordingIdRef.current) {
        const chunkIdx = index;
        const duration = Date.now() - chunkStartTimeRef.current;
        uploadPromise = uploadChunk(blob, chunkIdx, duration);
      }

      if (isStoppingRef.current) {
        setTxStatus(TX_STATUS.TRANSCRIBING);
        try {
          await uploadPromise;

          setTxStatus(TX_STATUS.FINALIZING);
          const result = await recording_finalize(recordingIdRef.current, {
            topic: topicRef.current,
            action: 'chat',
            events: eventsRef.current,
          });

          setResultChatId(result.chat_id || null);
          setResultPreview(result.transcript_preview || '');
          setResultTitle(result.title || '');
          setTxStatus(TX_STATUS.READY);
          if (result.chat_id) {
            window.dispatchEvent(new CustomEvent(RECORDING_FILES_REFRESH_EVENT, {
              detail: { chatId: result.chat_id }
            }));
          }
        } catch (err) {
          console.error('Finalization/Upload failed:', err);
          setTxError(err?.message || t('chat.recordErrorFinalize'));
          setTxStatus(TX_STATUS.ERROR);
        }
      } else if (!isPausedRef.current) {
        // Start next chunk
        startChunk(index + 1);
      }
    };

    recorder.start(1000);

    // Rotate chunk every 30 seconds
    chunkTimeoutRef.current = setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    }, 30000);
  }, [uploadChunk]);

  const startRecording = useCallback(async (selectedTopic) => {
    setError(null);
    setStatus(STATUS.REQUESTING);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error(t('chat.recordErrorSignIn'));
      }

      let stream;
      if (audioSource === 'device') {
        // Capture tab / system audio directly via the screen-share API.
        // We don't actually want the video tracks — we strip them right
        // after the user picks a source. This produces clean lossless
        // audio from videos / Zoom / podcasts playing on the device,
        // which echo cancellation on the mic would otherwise strip out.
        if (!navigator.mediaDevices?.getDisplayMedia) {
          throw new Error(t('chat.recordErrorUnsupported'));
        }
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        const audioTracks = displayStream.getAudioTracks();
        if (!audioTracks.length) {
          displayStream.getTracks().forEach((track) => track.stop());
          throw new Error(t('chat.recordErrorNoAudio'));
        }
        // Drop the video tracks immediately — we only want audio.
        displayStream.getVideoTracks().forEach((track) => track.stop());
        stream = new MediaStream(audioTracks);

        // If the user clicks "Stop sharing" in the browser's screen-share
        // bar while recording, treat it as a clean stop so we still
        // finalize whatever's been captured up to that moment.
        audioTracks.forEach((track) => {
          track.addEventListener('ended', () => {
            if (isStoppingRef.current) return;
            stopRecordingRef.current?.();
          });
        });
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
      }
      mediaStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
      mimeTypeRef.current = mimeType;

      const finalTopic = selectedTopic || 'Lecture Recording';
      setTopic(finalTopic);
      topicRef.current = finalTopic;

      // Start the recording session on the backend
      const { recording_id } = await recording_start({
        userId: user.uid,
        topic: finalTopic,
        chatId: attachToChatIdRef.current,
        language: (navigator.language || 'en').split('-')[0],
      });

      setRecordingId(recording_id);
      recordingIdRef.current = recording_id;

      // Reset refs & state
      isStoppingRef.current = false;
      isPausedRef.current = false;
      setLiveKeyPoints([]);
      setEvents([]);
      eventsRef.current = [];

      startChunk(0);
      setupAudioAnalysis(stream);

      accumulatedMsRef.current = 0;
      finalDurationMsRef.current = 0;
      setElapsedMs(0);
      setBytesRecorded(0);
      setStatus(STATUS.RECORDING);
      startTimer();
    } catch (err) {
      console.error('Recording start failed:', err);
      let msg;
      if (err?.name === 'NotAllowedError') {
        msg = audioSource === 'device'
          ? t('chat.recordErrorShareCancelled')
          : t('chat.recordErrorMicDenied');
      } else {
        msg = err?.message || t('chat.recordErrorStart');
      }
      setError(msg);
      setStatus(STATUS.IDLE);
    }
  }, [startChunk, setupAudioAnalysis, startTimer, audioSource, t]);

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;

    // Clear chunk timeout
    if (chunkTimeoutRef.current) {
      clearTimeout(chunkTimeoutRef.current);
      chunkTimeoutRef.current = null;
    }

    isPausedRef.current = true;
    recorder.pause();
    accumulatedMsRef.current += Date.now() - startTimeRef.current;
    stopTimer();
    setStatus(STATUS.PAUSED);
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'paused') return;

    isPausedRef.current = false;
    recorder.resume();
    startTimer();
    setStatus(STATUS.RECORDING);

    // Resume chunk window with a fresh timeout
    chunkStartTimeRef.current = Date.now();
    chunkTimeoutRef.current = setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    }, 30000);
  }, [startTimer]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    const finalMs =
      isPausedRef.current
        ? accumulatedMsRef.current
        : accumulatedMsRef.current + (Date.now() - startTimeRef.current);
    finalDurationMsRef.current = finalMs;
    setElapsedMs(finalMs);

    if (chunkTimeoutRef.current) {
      clearTimeout(chunkTimeoutRef.current);
      chunkTimeoutRef.current = null;
    }

    isStoppingRef.current = true;
    setStatus(STATUS.REVIEWING);
    stopTimer();
    cleanupAudioAnalysis();

    if (recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      (async () => {
        setTxStatus(TX_STATUS.FINALIZING);
        try {
          const result = await recording_finalize(recordingIdRef.current, {
            topic: topicRef.current,
            action: 'chat',
            events: eventsRef.current,
          });
          setResultChatId(result.chat_id || null);
          setResultPreview(result.transcript_preview || '');
          setResultTitle(result.title || '');
          setTxStatus(TX_STATUS.READY);
          if (result.chat_id) {
            window.dispatchEvent(new CustomEvent(RECORDING_FILES_REFRESH_EVENT, {
              detail: { chatId: result.chat_id }
            }));
          }
        } catch (err) {
          console.error('Finalization failed:', err);
          setTxError(err?.message || t('chat.recordErrorFinalize'));
          setTxStatus(TX_STATUS.ERROR);
        }
      })();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    setIsOverlayOpen(true);
    setIsMinimized(false);
  }, [cleanupAudioAnalysis, stopTimer]);

  // Expose stopRecording through a ref so listeners attached inside
  // startRecording (where stopRecording isn't yet in scope) can call it
  // without stale closures.
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  const openResultChat = useCallback(() => {
    if (!resultChatId) return;
    // When we attached to an existing chat, the user is already viewing it —
    // just dismiss the overlay so the (already-refreshed) file list shows.
    if (attachToChatIdRef.current && attachToChatIdRef.current === resultChatId) {
      reset();
      return;
    }
    navigate(`/c/${resultChatId}`);
    reset();
  }, [navigate, reset, resultChatId]);

  const discardResult = useCallback(async () => {
    const id = recordingId;
    // Capture the attached chat id BEFORE reset() clears it — needed so we
    // can refresh that chat's file list once the backend has finished
    // tearing down the transcript + vectors.
    const refreshChatId = attachToChatIdRef.current;
    reset();
    if (id) {
      try {
        await recording_cancel(id, { deleteChunks: true });
        if (refreshChatId) {
          window.dispatchEvent(new CustomEvent(RECORDING_FILES_REFRESH_EVENT, {
            detail: { chatId: refreshChatId }
          }));
        }
      } catch (e) {
        console.warn('Cancel failed:', e);
      }
    }
  }, [recordingId, reset]);

  const formatTime = (ms) => {
    const totalSecs = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = (num) => String(num).padStart(2, '0');
    return `${hrs > 0 ? hrs + ':' : ''}${pad(mins)}:${pad(secs)}`;
  };

  const addEvent = useCallback((type) => {
    const timestamp_ms = elapsedMs;
    const newEvent = { timestamp_ms, type };
    setEvents((prev) => [...prev, newEvent]);
    eventsRef.current = [...eventsRef.current, newEvent];

    const timeStr = formatTime(timestamp_ms);
    const note = type === 'important'
      ? t('chat.recordEventImportant', { time: timeStr })
      : t('chat.recordEventConfusion', { time: timeStr });

    setLiveKeyPoints((prev) => [...prev, { text: note, isEvent: true, type }]);
  }, [elapsedMs, t]);

  useEffect(() => {
    return () => {
      stopTimer();
      cleanupAudioAnalysis();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (chunkTimeoutRef.current) {
        clearTimeout(chunkTimeoutRef.current);
      }
    };
  }, [cleanupAudioAnalysis, stopTimer]);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (status === STATUS.RECORDING || status === STATUS.PAUSED) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [status]);

  const value = {
    STATUS,
    TX_STATUS,
    status,
    txStatus,
    txError,
    isOverlayOpen,
    isMinimized,
    elapsedMs,
    bytesRecorded,
    audioLevel,
    audioBlob,
    recordingId,
    resultChatId,
    resultTitle,
    resultPreview,
    error,
    topic,
    events,
    liveKeyPoints,
    attachToChatId,
    audioSource,
    setAudioSource,
    openOverlay,
    minimize,
    expand,
    reset,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    openResultChat,
    discardResult,
    addEvent,
    setTopic,
  };

  return <RecordClassContext.Provider value={value}>{children}</RecordClassContext.Provider>;
};
