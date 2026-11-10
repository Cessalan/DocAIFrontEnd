/**
 * Which chat an upload's progress belongs to.
 *
 * WHY THIS EXISTS
 *
 * ChatInterface is not remounted when the student opens another chat, and an
 * upload keeps streaming progress after she leaves. Until 2026-11-06 every
 * event updated whatever chat was on screen. Two of the three empty course
 * reports in the first week of PostHog (2026-11-03, 2026-11-04) were students
 * who clicked "+New study session" while their notes were still processing:
 * the finished upload filled the NEW, empty chat, its plan card ran the course
 * report against a chat with no files, and it came back empty. Going back to
 * the original chat worked, because Firestore had the right card all along.
 *
 * The rule: an upload draws only into its own chat, and only while that chat
 * is on screen. What has to survive is saved to its own chat in Firestore
 * regardless, and appears there when she goes back.
 */

/**
 * Is this upload's chat the one on screen? With no chat open yet (landing
 * page, first upload creating the chat) the upload is the screen.
 */
export const isUploadOnScreen = (uploadChatId, currentChatId) =>
  !currentChatId || currentChatId === uploadChatId;

/**
 * May this upload clear the component's shared upload refs? Only while it is
 * still the newest upload: a second upload started in another chat has taken
 * them over, and clearing them would strand its card.
 */
export const ownsSharedUploadState = (upload, activeUpload) =>
  !upload || activeUpload === upload;
