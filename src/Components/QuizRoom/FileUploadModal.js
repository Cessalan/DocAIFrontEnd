import React, { useState, useRef, useCallback } from 'react';
import './FileUploadModal.css';

/**
 * FileUploadModal - Premium file upload experience
 * Hospital UI theme with soft neon glow
 * "What do you want to study today?"
 */
const FileUploadModal = ({
  isOpen = false,
  onClose,
  onFileSelect,
  error = null
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  // Accepted file types
  const acceptedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
    'application/vnd.ms-powerpoint', // ppt
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
    'application/msword', // doc
    'text/plain',
    'text/markdown'
  ];

  const acceptedExtensions = '.pdf,.ppt,.pptx,.doc,.docx,.txt,.md';

  // Handle drag events
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  // Handle file selection
  const handleFile = useCallback((file) => {
    // Validate file type
    const isValidType = acceptedTypes.includes(file.type) ||
      /\.(pdf|ppt|pptx|doc|docx|txt|md)$/i.test(file.name);

    if (!isValidType) {
      alert('Please upload a PDF, PowerPoint, Word document, or text file.');
      return;
    }

    // Validate file size (max 25MB)
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File is too large. Maximum size is 25MB.');
      return;
    }

    setSelectedFile(file);
  }, [acceptedTypes]);

  // Handle file input change
  const handleFileInputChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  // Handle click on drop zone
  const handleDropZoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle confirm upload
  const handleConfirmUpload = useCallback(() => {
    if (selectedFile && onFileSelect) {
      onFileSelect(selectedFile);
    }
  }, [selectedFile, onFileSelect]);

  // Handle close
  const handleClose = useCallback(() => {
    setSelectedFile(null);
    setIsDragging(false);
    if (onClose) onClose();
  }, [onClose]);

  // Get file icon based on type
  const getFileIcon = (fileName) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6C5.44772 2 5 2.44772 5 3V21C5 21.5523 5.44772 22 6 22H18C18.5523 22 19 21.5523 19 21V7L14 2Z"
              stroke="currentColor" strokeWidth="1.5" fill="rgba(239,68,68,0.1)"/>
            <path d="M14 2V7H19" stroke="currentColor" strokeWidth="1.5"/>
            <text x="12" y="16" textAnchor="middle" fill="currentColor" fontSize="6" fontWeight="bold">PDF</text>
          </svg>
        );
      case 'ppt':
      case 'pptx':
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6C5.44772 2 5 2.44772 5 3V21C5 21.5523 5.44772 22 6 22H18C18.5523 22 19 21.5523 19 21V7L14 2Z"
              stroke="currentColor" strokeWidth="1.5" fill="rgba(249,115,22,0.1)"/>
            <path d="M14 2V7H19" stroke="currentColor" strokeWidth="1.5"/>
            <text x="12" y="16" textAnchor="middle" fill="currentColor" fontSize="5" fontWeight="bold">PPT</text>
          </svg>
        );
      case 'doc':
      case 'docx':
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6C5.44772 2 5 2.44772 5 3V21C5 21.5523 5.44772 22 6 22H18C18.5523 22 19 21.5523 19 21V7L14 2Z"
              stroke="currentColor" strokeWidth="1.5" fill="rgba(59,130,246,0.1)"/>
            <path d="M14 2V7H19" stroke="currentColor" strokeWidth="1.5"/>
            <text x="12" y="16" textAnchor="middle" fill="currentColor" fontSize="4.5" fontWeight="bold">DOC</text>
          </svg>
        );
      default:
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6C5.44772 2 5 2.44772 5 3V21C5 21.5523 5.44772 22 6 22H18C18.5523 22 19 21.5523 19 21V7L14 2Z"
              stroke="currentColor" strokeWidth="1.5"/>
            <path d="M14 2V7H19" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 13H16M8 17H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="file-upload-modal-overlay" onClick={handleClose}>
      <div className="file-upload-modal" onClick={e => e.stopPropagation()}>
        {/* Close button */}
        <button className="modal-close-btn" onClick={handleClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Ambient glow */}
        <div className="modal-ambient-glow" />

        {/* Content */}
        <div className="modal-content">
          {/* Header */}
          <div className="modal-header">
            <h2 className="modal-title">What do you want to study today?</h2>
            <p className="modal-subtitle">
              Upload your notes, slides, or documents and we'll create a personalized quiz.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="upload-error">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Drop zone or selected file */}
          {!selectedFile ? (
            <div
              className={`drop-zone ${isDragging ? 'dragging' : ''}`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleDropZoneClick}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedExtensions}
                onChange={handleFileInputChange}
                className="file-input-hidden"
              />

              <div className="drop-zone-content">
                <div className="drop-icon">
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6C5.44772 2 5 2.44772 5 3V21C5 21.5523 5.44772 22 6 22H18C18.5523 22 19 21.5523 19 21V7L14 2Z"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M14 2V7H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 18V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M9 14L12 11L15 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <div className="drop-icon-glow" />
                </div>

                <p className="drop-text-main">
                  {isDragging ? 'Drop your file here' : 'Drag & drop or tap to upload'}
                </p>
                <p className="drop-text-sub">
                  PDF, PowerPoint, Word, or text files (max 25MB)
                </p>
              </div>

              {/* Animated border */}
              <div className="drop-zone-border" />
            </div>
          ) : (
            <div className="selected-file-preview">
              <div className="file-preview-icon">
                {getFileIcon(selectedFile.name)}
              </div>
              <div className="file-preview-info">
                <span className="file-preview-name">{selectedFile.name}</span>
                <span className="file-preview-size">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
              <button
                className="file-remove-btn"
                onClick={() => setSelectedFile(null)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="modal-actions">
            {selectedFile ? (
              <button className="upload-confirm-btn" onClick={handleConfirmUpload}>
                <span>Generate Quiz</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            ) : (
              <button className="browse-btn" onClick={handleDropZoneClick}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12 3V15M12 15L7 10M12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Browse Files</span>
              </button>
            )}
          </div>

          {/* Supported formats hint */}
          <div className="supported-formats">
            <span className="format-label">Supported:</span>
            <span className="format-badge">PDF</span>
            <span className="format-badge">PowerPoint</span>
            <span className="format-badge">Word</span>
            <span className="format-badge">Text</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUploadModal;
