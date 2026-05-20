import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

export const RecordClassProvider = ({ children }) => {
  const navigate = useNavigate();

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

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const startTimeRef = useRef(0);
  const accumulatedMsRef = useRef(0);
  const tickIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const finalDurationMsRef = useRef(0);

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

  const openOverlay = useCallback(() => {
    setIsOverlayOpen(true);
    setIsMinimized(false);
  }, []);

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
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
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
  }, [cleanupAudioAnalysis, stopTimer]);

  const processRecording = useCallback(async (blob) => {
    const user = auth.currentUser;
    if (!user) {
      setTxError('You must be signed in to transcribe a recording.');
      setTxStatus(TX_STATUS.ERROR);
      return;
    }
    if (!blob || blob.size === 0) {
      setTxError('Recording is empty.');
      setTxStatus(TX_STATUS.ERROR);
      return;
    }
    // Whisper hard limit per chunk
    if (blob.size > 25 * 1024 * 1024) {
      setTxError('Recording exceeds 25 MB. Long-lecture chunking is coming soon.');
      setTxStatus(TX_STATUS.ERROR);
      return;
    }

    try {
      setTxError(null);

      setTxStatus(TX_STATUS.UPLOADING);
      const { recording_id } = await recording_start({
        userId: user.uid,
        language: (navigator.language || 'en').split('-')[0],
      });
      setRecordingId(recording_id);

      setTxStatus(TX_STATUS.TRANSCRIBING);
      await recording_upload_chunk(recording_id, blob, 0, finalDurationMsRef.current || 0);

      setTxStatus(TX_STATUS.FINALIZING);
      const result = await recording_finalize(recording_id, { action: 'chat' });

      setResultChatId(result.chat_id || null);
      setResultPreview(result.transcript_preview || '');
      setResultTitle(result.title || '');
      setTxStatus(TX_STATUS.READY);
    } catch (err) {
      console.error('Transcription failed:', err);
      setTxError(err?.message || 'Transcription failed. Please try again.');
      setTxStatus(TX_STATUS.ERROR);
    }
  }, []);

  const openResultChat = useCallback(() => {
    if (!resultChatId) return;
    navigate(`/c/${resultChatId}`);
    reset();
  }, [navigate, reset, resultChatId]);

  const discardResult = useCallback(async () => {
    const id = recordingId;
    reset();
    if (id) {
      try {
        await recording_cancel(id, { deleteChunks: true });
      } catch (e) {
        console.warn('Cancel failed:', e);
      }
    }
  }, [recordingId, reset]);

  const startRecording = useCallback(async () => {
    setError(null);
    setStatus(STATUS.REQUESTING);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
          setBytesRecorded((prev) => prev + e.data.size);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        setAudioBlob(blob);
        setStatus(STATUS.REVIEWING);
        stopTimer();
        cleanupAudioAnalysis();
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
        // Kick off transcription immediately
        processRecording(blob);
      };

      recorder.start(1000);
      setupAudioAnalysis(stream);
      accumulatedMsRef.current = 0;
      finalDurationMsRef.current = 0;
      setElapsedMs(0);
      setBytesRecorded(0);
      setStatus(STATUS.RECORDING);
      startTimer();
    } catch (err) {
      console.error('Mic access failed:', err);
      setError(
        err?.name === 'NotAllowedError'
          ? 'Microphone permission denied. Enable mic access in your browser settings.'
          : 'Could not access microphone.'
      );
      setStatus(STATUS.IDLE);
    }
  }, [cleanupAudioAnalysis, processRecording, setupAudioAnalysis, startTimer, stopTimer]);

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    recorder.pause();
    accumulatedMsRef.current += Date.now() - startTimeRef.current;
    stopTimer();
    setStatus(STATUS.PAUSED);
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'paused') return;
    recorder.resume();
    startTimer();
    setStatus(STATUS.RECORDING);
  }, [startTimer]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    // Capture final duration BEFORE stopping (timer dies after stop)
    const finalMs =
      recorder.state === 'paused'
        ? accumulatedMsRef.current
        : accumulatedMsRef.current + (Date.now() - startTimeRef.current);
    finalDurationMsRef.current = finalMs;
    setElapsedMs(finalMs);

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
    setIsOverlayOpen(true);
    setIsMinimized(false);
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      cleanupAudioAnalysis();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    openOverlay,
    minimize,
    expand,
    reset,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    processRecording,
    openResultChat,
    discardResult,
  };

  return <RecordClassContext.Provider value={value}>{children}</RecordClassContext.Provider>;
};
