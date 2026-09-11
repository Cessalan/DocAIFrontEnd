import React from 'react';
export default function Empty() { return null; }
export function useTranslation() { return { i18n: { language: 'en' }, t: (key, fallback) => (typeof fallback === 'string' ? fallback : fallback?.defaultValue || key.split('.').pop()).replace(/\{\{(\w+)\}\}/g, (match, name) => fallback?.[name] ?? match) }; }
const quota = { isPro: false, remaining: 0, refresh() {}, openUpgrade() {} };
export function useUsageLimit() { return quota; }
export const savePractice = async () => {};
export const copyPracticeToOwnChat = async () => 'preview-copy';
export const streamPracticeBatch = async () => {};
export const extend_quiz_stream = async () => {};
export const askPracticeTutor = async () => ({ action: 'explain', reply: 'Try explaining the idea without looking at your notes. If you get stuck, that gives us a specific point to work on together. Your question and answer stay here while we discuss it.', sources: [] });
export function devLog() {}
export function playCorrectSound() {}
export function playIncorrectSound() {}
export function playCelebrationSound() {}
export function playMilestoneSound() {}
export const fetchQuizRationale = async () => ({});
export const rewrite_text = async () => '';
export function useGlossary() { return { rationaleRef: { current: null }, rationaleHandlers: {}, popover: null }; }
