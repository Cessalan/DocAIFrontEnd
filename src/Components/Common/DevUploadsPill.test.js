/**
 * DevUploadsPill smoke test.
 *
 * The pill is unreachable in a signed-out browser and needs a real chatId, so
 * this covers the two things that would otherwise only show up in front of a
 * live session: that it stays invisible outside development, and that it
 * renders the row shape production actually stores.
 *
 * The sample rows below are copied from real `chats/{id}/uploads` documents —
 * note `size` is a formatted STRING, not bytes, and `uploadedAt` is a Firestore
 * Timestamp. Both tripped the first version of humanSize.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DevUploadsPill from './DevUploadsPill';
import { GetChatUploads } from '../../Services/FireBaseServiceChats';

jest.mock('../../Services/FireBaseServiceChats', () => ({
  GetChatUploads: jest.fn(),
}));

const REAL_ROWS = [
  {
    id: '7896610e-bb68-42e8-bc95-d77fc6ff480a',
    name: 'Patel2019_Article_ImpairedSleepIsAssociatedWithL.pdf',
    size: '868.5 KB',           // string, straight from Firestore
    downloadURL: 'https://firebasestorage.googleapis.com/v0/b/x/o/a.pdf?alt=media&token=t',
    wordCount: 3665,
    uploadedAt: 1760317923092,
    orphan: false,
  },
  {
    id: 'chats/abc/uploads/orphan.pptx',
    name: 'Post-op 2025 (Student).pptx',
    size: 10182451,             // number of bytes, from Storage metadata
    downloadURL: 'https://firebasestorage.googleapis.com/v0/b/x/o/b.pptx?alt=media&token=t',
    wordCount: null,
    uploadedAt: 1760826678583,
    orphan: true,
  },
];

// NODE_ENV must stay 'development' for the WHOLE test, not just the initial
// render: the guard runs on every render, so restoring it before a click
// unmounts the tree mid-test.
const REAL_ENV = process.env.NODE_ENV;

describe('DevUploadsPill', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    GetChatUploads.mockReset();
    GetChatUploads.mockResolvedValue(REAL_ROWS);
  });

  afterEach(() => {
    process.env.NODE_ENV = REAL_ENV;
  });

  it('renders nothing outside a development build', () => {
    process.env.NODE_ENV = 'production';
    const { container } = render(<DevUploadsPill chatId="abc123" />);
    expect(container).toBeEmptyDOMElement();
    expect(GetChatUploads).not.toHaveBeenCalled();
  });

  it('renders nothing without a chatId', () => {
    const { container } = render(<DevUploadsPill chatId={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not hit Firestore until the panel is opened', () => {
    render(<DevUploadsPill chatId="abc123" />);
    expect(screen.getByText('UPLOADS')).toBeInTheDocument();
    expect(GetChatUploads).not.toHaveBeenCalled();
  });

  it('lists the session files, formatting both size shapes', async () => {
    render(<DevUploadsPill chatId="abc123" />);

    fireEvent.click(screen.getByTitle(/list and download/i));

    await waitFor(() =>
      expect(screen.getByText(/Patel2019_Article/)).toBeInTheDocument()
    );
    expect(GetChatUploads).toHaveBeenCalledWith('abc123');

    // String sizes pass through; byte counts get formatted.
    expect(screen.getByText(/868\.5 KB/)).toBeInTheDocument();
    expect(screen.getByText(/9\.7 MB/)).toBeInTheDocument();

    // wordCount shown when present, omitted when null.
    expect(screen.getByText(/3665 words/)).toBeInTheDocument();

    // The Storage-only file is flagged, so a missing Firestore row is visible.
    expect(screen.getByText(/orphan/)).toBeInTheDocument();

    // One save button per file, plus the separate "download everything" one.
    expect(
      screen.getByTitle('Download Patel2019_Article_ImpairedSleepIsAssociatedWithL.pdf')
    ).toBeEnabled();
    expect(screen.getByTitle('Download Post-op 2025 (Student).pptx')).toBeEnabled();
    expect(screen.getByTitle(/Download every file/)).toBeInTheDocument();
  });

  it('surfaces a read failure instead of showing an empty list', async () => {
    GetChatUploads.mockRejectedValue(new Error('permission-denied'));
    render(<DevUploadsPill chatId="abc123" />);

    fireEvent.click(screen.getByTitle(/list and download/i));

    await waitFor(() =>
      expect(screen.getByText(/Could not read uploads/i)).toBeInTheDocument()
    );
  });
});
