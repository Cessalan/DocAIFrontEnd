  // -------------- Utility Functions --------------
  /**
   * Formats file size in human-readable format
   * 
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size (e.g., "2.5 MB")
   */
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  /**
   * Formats a date for display
   * 
   * @param {Date} date - Date to format
   * @returns {string} Formatted date string
   */
  const formatDate = (date) => {
  
    if(!date)
      return;

    // If it's a string or number, try converting to Date
  if (!(date instanceof Date)) {
    date = new Date(date);
  }

    return date.toLocaleDateString([], { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };
  
  /**
   * Formats a timestamp for display in chat
   * 
   * @param {Date} date - Date to format
   * @returns {string} Formatted time string (e.g., "14:32")
   */
  const formatTimeForChat = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  export {formatDate,formatTimeForChat,formatFileSize}