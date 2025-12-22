import React, { useState, useEffect, useCallback } from 'react';
import StudyModeHeader from './StudyModeHeader';
import StudyStepCard from './StudyStepCard';
import StudyPlanOverview from './StudyPlanOverview';
import NurseQuizMascot from '../QuizRoom/NurseQuizMascot';
import BrainMascot from '../QuizRoom/BrainMascot';

import { generate_study_item } from '../../Services/FastAPICalls';
import {
  updateNodeStatus,
  completeNodeAndAdvance,
  addAskedHash,
  saveNodeContent,
  getNodeContent
} from '../../Services/StudySessionService';

import './StudyMode.css';

/**
 * StudyModeContainer - Main orchestrator for study mode
 * Manages state, handles node transitions, and coordinates components
 *
 * Flow:
 * 1. When entering study mode, show the current node content
 * 2. When user exits a node (X button), show StudyPlanOverview
 * 3. When user clicks Continue, advance to next node
 * 4. When user clicks a node in overview, show that node's content
 *
 * @param {string} chatId - Study session chat ID
 * @param {Object} studyState - Study state from Firestore { path, status, askedHashes, ... }
 * @param {Function} onExit - Callback to exit study mode entirely (navigate away)
 * @param {Function} onComplete - Callback when study session is completed
 * @param {string} language - Language for content generation
 */
const StudyModeContainer = ({
  chatId,
  studyState,
  onExit,
  onComplete,
  language = 'en'
}) => {
  // View state: 'node' (showing content) | 'overview' (showing plan)
  const [view, setView] = useState('overview');

  // State
  const [nodes, setNodes] = useState([]);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [activeNode, setActiveNode] = useState(null);
  const [currentContent, setCurrentContent] = useState(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioMessage, setAudioMessage] = useState('');
  const [askedHashes, setAskedHashes] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const [mascotState, setMascotState] = useState({
    type: 'nurse', // 'nurse' | 'brain'
    isExcited: false,
    isSurprised: false,
    lookDirection: 'center'
  });

  // Initialize from studyState
  useEffect(() => {
    if (studyState?.path) {
      setNodes(studyState.path.nodes || []);
      setActiveNodeId(studyState.path.activeNodeId);
      setAskedHashes(studyState.askedHashes || []);
      setIsComplete(studyState.status === 'completed');
    }
  }, [studyState]);

  // Update active node when activeNodeId changes
  useEffect(() => {
    if (nodes.length > 0 && activeNodeId) {
      const node = nodes.find(n => n.id === activeNodeId);
      setActiveNode(node);
    }
  }, [nodes, activeNodeId]);

  // Calculate progress
  const completedCount = nodes.filter(n => n.status === 'done').length;
  const currentStep = completedCount + 1;
  const totalSteps = nodes.length;

  // Handle starting/loading a node's content
  const handleStartNode = useCallback(async (node) => {
    console.log('📚 Starting node:', node);
    setView('node');
    setIsLoadingContent(true);
    setCurrentContent(null);
    setActiveNode(node);
    setActiveNodeId(node.id);

    // Set mascot to thinking
    setMascotState({
      type: 'brain',
      isExcited: false,
      isSurprised: false,
      lookDirection: 'center'
    });

    try {
      // ========================================
      // CHECK FOR SAVED CONTENT FIRST
      // If node has messageId, retrieve saved content instead of regenerating
      // ========================================
      if (node.messageId) {
        console.log('📬 Node has messageId, checking for saved content:', node.messageId);
        const savedContent = await getNodeContent(chatId, node.messageId);

        if (savedContent?.studyContent) {
          console.log('✅ Retrieved saved content, skipping generation');
          setCurrentContent(savedContent.studyContent);

          // Set mascot back to nurse
          setMascotState({
            type: 'nurse',
            isExcited: false,
            isSurprised: false,
            lookDirection: 'down-center'
          });

          setIsLoadingContent(false);
          return; // Exit early - no need to generate
        } else {
          console.log('⚠️ messageId exists but content not found, will regenerate');
        }
      }

      // ========================================
      // GENERATE NEW CONTENT (no saved content found)
      // ========================================
      console.log('🔄 Generating new content for node:', node.id);
      const result = await generate_study_item(
        chatId,
        node.type,
        node.label,
        node.tags || [],
        askedHashes,
        language
      );

      // Save the content hash for anti-repeat
      if (result.hash) {
        await addAskedHash(chatId, result.hash);
        setAskedHashes(prev => [...prev, result.hash]);
      }

      // Save content as a message and link to node
      const messageId = await saveNodeContent(
        chatId,
        node.id,
        result.content,
        node.type
      );

      // Update node with messageId
      await updateNodeStatus(chatId, node.id, { messageId });

      // Update local state
      setNodes(prev => prev.map(n =>
        n.id === node.id ? { ...n, messageId } : n
      ));

      setCurrentContent(result.content);

      // Set mascot back to nurse
      setMascotState({
        type: 'nurse',
        isExcited: false,
        isSurprised: false,
        lookDirection: 'down-center'
      });

    } catch (error) {
      console.error('❌ Error generating content:', error);
      // Show error state
      setMascotState({
        type: 'nurse',
        isExcited: false,
        isSurprised: true,
        lookDirection: 'center'
      });
    } finally {
      setIsLoadingContent(false);
    }
  }, [chatId, askedHashes, language]);

  // Handle quiz answer
  const handleAnswer = useCallback((answerData) => {
    console.log('📝 Answer submitted:', answerData);

    // Update mascot based on correctness
    setMascotState({
      type: 'nurse',
      isExcited: answerData.isCorrect,
      isSurprised: !answerData.isCorrect,
      lookDirection: 'center'
    });

    // Reset surprised state after a moment
    if (!answerData.isCorrect) {
      setTimeout(() => {
        setMascotState(prev => ({
          ...prev,
          isSurprised: false
        }));
      }, 1500);
    }
  }, []);

  // Handle flashcard review
  const handleReview = useCallback((reviewData) => {
    console.log('📖 Flashcard reviewed:', reviewData);

    // Set excited if they got it
    if (reviewData.status === 'got_it') {
      setMascotState({
        type: 'nurse',
        isExcited: true,
        isSurprised: false,
        lookDirection: 'center'
      });
    }
  }, []);

  // Handle audio generation trigger
  const handleGenerateAudio = useCallback(async (audioConfig) => {
    console.log('🎵 Generating audio:', audioConfig);
    setIsGeneratingAudio(true);
    setAudioMessage('Creating your audio lesson...');

    // Audio generation would be handled by the existing audio pipeline
    // This is a placeholder - the actual implementation would call your backend

    // For now, simulate completion after a delay
    setTimeout(() => {
      setIsGeneratingAudio(false);
      setAudioMessage('');
    }, 3000);
  }, []);

  // Handle continue to next node
  const handleContinue = useCallback(async () => {
    console.log('➡️ Continuing to next node');

    // Set mascot excited
    setMascotState({
      type: 'nurse',
      isExcited: true,
      isSurprised: false,
      lookDirection: 'center'
    });

    try {
      // Complete current node and advance
      const result = await completeNodeAndAdvance(chatId, activeNodeId);

      // Update local state
      setNodes(prev => prev.map(n => {
        if (n.id === activeNodeId) {
          return { ...n, status: 'done' };
        }
        if (n.id === result.nextNodeId) {
          return { ...n, status: 'active' };
        }
        return n;
      }));

      if (result.isComplete) {
        // Study session complete!
        setIsComplete(true);
        setView('overview'); // Show overview with all nodes completed
        if (onComplete) {
          onComplete();
        }
      } else {
        // Go back to overview to show progress, user can click next node
        setActiveNodeId(result.nextNodeId);
        setCurrentContent(null);
        setView('overview');

        // Reset mascot
        setMascotState({
          type: 'nurse',
          isExcited: false,
          isSurprised: false,
          lookDirection: 'center'
        });
      }
    } catch (error) {
      console.error('❌ Error advancing to next node:', error);
    }
  }, [chatId, activeNodeId, onComplete]);

  // Handle exit from node view - go back to overview
  const handleExitNode = useCallback(() => {
    console.log('📚 Exiting node, returning to overview');
    setCurrentContent(null);
    setView('overview');
    setMascotState({
      type: 'nurse',
      isExcited: false,
      isSurprised: false,
      lookDirection: 'center'
    });
  }, []);

  // Handle exit from overview - leave study mode entirely
  const handleExitStudy = useCallback(() => {
    console.log('📚 Exiting study mode');
    if (onExit) {
      onExit();
    }
  }, [onExit]);

  // Handle node selection from overview
  const handleNodeSelect = useCallback((node) => {
    console.log('📚 Node selected from overview:', node);
    handleStartNode(node);
  }, [handleStartNode]);

  // Build studyState for overview (with updated nodes)
  const currentStudyState = {
    ...studyState,
    path: {
      ...studyState?.path,
      nodes: nodes
    }
  };

  // Render overview (Duolingo-style path)
  if (view === 'overview') {
    return (
      <StudyPlanOverview
        studyState={currentStudyState}
        onNodeSelect={handleNodeSelect}
        onExit={handleExitStudy}
      />
    );
  }

  // Render node content view
  return (
    <div className="study-mode-container study-mode-focused">
      <StudyModeHeader
        unitTitle={studyState?.path?.unitTitle || activeNode?.label || 'Study Session'}
        unitSubtitle={studyState?.path?.unitSubtitle || ''}
        currentStep={currentStep}
        totalSteps={totalSteps}
        onExit={handleExitNode}
      />

      <div className="study-main-content">
        {/* Centered content - no path view, just the current step */}
        <div className="study-focused-layout">
          <div className="study-content-centered">
            {isLoadingContent ? (
              <div className="study-step-card">
                <div className="study-loading">
                  <div className="study-loading-spinner" />
                  <p className="study-loading-text">
                    Preparing your {activeNode?.type || 'lesson'}...
                  </p>
                </div>
              </div>
            ) : currentContent ? (
              <StudyStepCard
                node={activeNode}
                content={currentContent}
                isLoading={false}
                isGeneratingAudio={isGeneratingAudio}
                audioGeneratingMessage={audioMessage}
                onAnswer={handleAnswer}
                onReview={handleReview}
                onGenerateAudio={handleGenerateAudio}
                onContinue={handleContinue}
              />
            ) : (
              <div className="study-step-card">
                <div className="study-loading">
                  <div className="study-loading-spinner" />
                  <p className="study-loading-text">
                    Starting your study session...
                  </p>
                </div>
              </div>
            )}

            {/* Mascot - positioned to the side */}
            <div className="study-mascot-side">
              {mascotState.type === 'brain' ? (
                <BrainMascot size={90} />
              ) : (
                <NurseQuizMascot
                  size={90}
                  isExcited={mascotState.isExcited}
                  isSurprised={mascotState.isSurprised}
                  lookDirection={mascotState.lookDirection}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudyModeContainer;
