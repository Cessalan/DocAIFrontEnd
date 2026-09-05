import React, { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";

import ProtectedRoute from "./Components/Auth/ProtectedRoute";
import QuizRoomLanding from "./Components/QuizRoom/QuizRoomLanding";
import './index.css';

// ============================================
// CODE SPLITTING
// ============================================
// Only the landing page ships in the main bundle — it's what an unauthenticated
// visitor sees at "/" (via ProtectedRoute), so it must paint without a second
// round trip. Everything else loads on demand, which keeps the PDF viewer,
// mindmap engine and the whole chat/study surface out of the first download.
// ============================================

const ChatLayout = lazy(() => import("./ChatLayout"));
const Login = lazy(() => import("./Components/Auth/Login"));
const Signup = lazy(() => import("./Components/Auth/SignUp"));
const ForgotPassword = lazy(() => import("./Components/Auth/ForgotPassword"));
const PublicQuizView = lazy(() => import("./Components/PublicQuiz/PublicQuizView"));
const BlogList = lazy(() => import("./Components/Blog/BlogList"));
const BlogPost = lazy(() => import("./Components/Blog/BlogPost"));
const NclexQuestionGenerator = lazy(() => import("./Components/LandingPages/NclexQuestionGenerator"));
const QuestionBankAdmin = lazy(() => import("./Components/Admin/QuestionBankAdmin"));
const SatisfactionDashboard = lazy(() => import("./Components/Admin/SatisfactionDashboard"));
const ConversationReader = lazy(() => import("./Components/Admin/ConversationReader"));

/**
 * Route-level loading state. Deliberately self-contained (inline styles, brand
 * colours read from the global CSS variables in index.css) so it can render
 * before any chunk-specific stylesheet has arrived.
 */
function RouteFallback() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-primary, #fdfaf7)'
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '3px solid var(--primary-peach, #f8c8c4)',
          borderTopColor: 'var(--primary-coral, #e88d7d)',
          animation: 'nq-route-spin 0.7s linear infinite'
        }}
      />
      <style>{'@keyframes nq-route-spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development';

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/start" element={<QuizRoomLanding />} />
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/quiz/:shareId" element={<PublicQuizView />} />

        {/* Blog Routes - Public for SEO */}
        <Route path="/blog" element={<BlogList />} />
        <Route path="/blog/:slug" element={<BlogPost />} />

        {/* SEO Landing Pages */}
        <Route path="/nclex-question-generator" element={<NclexQuestionGenerator />} />
        <Route path="/ai-nclex-question-generator" element={<NclexQuestionGenerator />} />

        {/* Admin Routes - DEV ONLY */}
        {isDev && (
          <Route path="/admin/question-bank" element={<QuestionBankAdmin />} />
        )}
        {isDev && (
          <Route path="/admin/satisfaction" element={<SatisfactionDashboard />} />
        )}
        {isDev && (
          <Route path="/admin/conversations" element={<ConversationReader />} />
        )}

        {/* Home - Redirect to chat */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ChatLayout />
            </ProtectedRoute>
          }
        />

        {/* QuizRoom routes - hidden for now, can be re-enabled later */}
        {/* <Route path="/quiz-room" element={<DedicatedQuizPage />} /> */}
        {/* <Route path="/quiz/play" element={<DedicatedQuizPage />} /> */}

        {/* Protected Chat Layout - with chat ID in URL */}
        <Route
          path="/c/:chatId"
          element={
            <ProtectedRoute>
              <ChatLayout />
            </ProtectedRoute>
          }
        />

        {/* Exam Drill. Renders ChatLayout, which swaps the chat pane for the
            drill — so leaving a drill is a state change instead of a full
            remount of the sidebar, its listeners and the chat. */}
        <Route
          path="/drill/:chatId"
          element={
            <ProtectedRoute>
              <ChatLayout />
            </ProtectedRoute>
          }
        />

        {/* Protected Chat Layout - without specific chat (new chat view) */}
        <Route
          path="/c"
          element={
            <ProtectedRoute>
              <ChatLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}

export default App;
