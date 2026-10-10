import { applyUploadEvent, anyUploading, displayProgress, fileKind, markAll, newComposerFile, STAGE_FLOOR } from './composerUploadModel';

const start = () => [newComposerFile({ name: 'Evaluation ABCDE.pdf' }, 'a'), newComposerFile({ name: 'Week 3.pptx' }, 'b')];

test('file kinds come from the extension', () => {
  expect(fileKind('notes.PDF')).toBe('pdf');
  expect(fileKind('deck.pptx')).toBe('slides');
  expect(fileKind('essay.docx')).toBe('doc');
  expect(fileKind('scan.jpeg')).toBe('image');
  expect(fileKind('README')).toBe('text');
});

test('stages advance each file by its own events, matched by id once known', () => {
  let files = start();
  files = applyUploadEvent(files, { type: 'file_start', filename: 'Evaluation ABCDE.pdf', file_id: 'f1' });
  files = applyUploadEvent(files, { type: 'embedding_start', file_id: 'f1' });
  files = applyUploadEvent(files, { type: 'embedding_progress', file_id: 'f1', stage: 'loaded_pages' });
  expect(files[0].fileId).toBe('f1');
  expect(files[0].stage).toBe('loaded_pages');
  expect(files[1].stage).toBe('queued');
});

test('a stage never moves a file backwards', () => {
  let files = start();
  files = applyUploadEvent(files, { type: 'insight_batch', filename: 'Week 3.pptx' });
  files = applyUploadEvent(files, { type: 'file_start', filename: 'Week 3.pptx', file_id: 'f2' });
  expect(files[1].stage).toBe('insight_batch');
  expect(files[1].fileId).toBe('f2');
});

test('only file_complete makes a file ready; errors stay errors', () => {
  let files = start();
  files = applyUploadEvent(files, { type: 'file_complete', filename: 'Evaluation ABCDE.pdf' });
  files = applyUploadEvent(files, { type: 'file_error', filename: 'Week 3.pptx' });
  expect(files.map(f => f.status)).toEqual(['ready', 'error']);
  expect(anyUploading(files)).toBe(false);
  expect(applyUploadEvent(files, { type: 'all_complete' })[1].status).toBe('error');
});

test('unknown events and an empty composer are left alone', () => {
  const files = start();
  expect(applyUploadEvent(files, { type: 'firebase_start' })).toBe(files);
  expect(applyUploadEvent([], { type: 'file_start', filename: 'x.pdf' })).toEqual([]);
});

test('the ring creeps toward the next stage but never claims it', () => {
  const entry = { ...newComposerFile({ name: 'a.pdf' }, 'a'), stage: 'embedding_start', floor: STAGE_FLOOR.embedding_start, stageAt: 0 };
  expect(displayProgress(entry, 0)).toBe(STAGE_FLOOR.embedding_start);
  const later = displayProgress(entry, 3000);
  expect(later).toBeGreaterThan(STAGE_FLOOR.embedding_start);
  expect(displayProgress(entry, 10 * 60 * 1000)).toBeLessThan(STAGE_FLOOR.loaded_pages);
  expect(displayProgress({ ...entry, status: 'ready' }, 0)).toBe(100);
});

test('markAll finishes or fails only the files still uploading', () => {
  const files = [{ ...start()[0], status: 'error' }, start()[1]];
  expect(markAll(files, 'ready').map(f => f.status)).toEqual(['error', 'ready']);
  expect(markAll(files, 'error').map(f => f.status)).toEqual(['error', 'error']);
});
