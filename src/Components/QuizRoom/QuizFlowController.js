import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProcessingScreen from './ProcessingScreen';
import SerumReadyScreen from './SerumReadyScreen';
import FileUploadModal from './FileUploadModal';
import './QuizFlowController.css';

/**
 * QuizFlowController - Manages the complete quiz flow
 *
 * Flow:
 * 1. Upload modal appears
 * 2. File is uploaded → ProcessingScreen shows
 * 3. AI generates quiz → SerumReadyScreen shows
 * 4. User clicks Start → Navigate to DedicatedQuizPage
 */

// Flow phases
const PHASES = {
  IDLE: 'idle',
  UPLOAD: 'upload',
  PROCESSING: 'processing',
  READY: 'ready',
  TRANSITIONING: 'transitioning'
};

const QuizFlowController = ({
  isOpen = false,
  onClose,
  onQuizGenerated,
  // API function to generate quiz from file (provided by parent)
  generateQuizFromFile
}) => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [generatedQuiz, setGeneratedQuiz] = useState(null);
  const [error, setError] = useState(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPhase(PHASES.UPLOAD);
      setProgress(0);
      setFileName('');
      setGeneratedQuiz(null);
      setError(null);
    } else {
      setPhase(PHASES.IDLE);
    }
  }, [isOpen]);

  // Simulate progress during processing (for demo/visual feedback)
  useEffect(() => {
    if (phase !== PHASES.PROCESSING) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        // Slow down as we approach 90% (waiting for actual completion)
        if (prev >= 90) return prev;
        const increment = prev < 50 ? 3 : prev < 80 ? 2 : 1;
        return Math.min(prev + increment, 90);
      });
    }, 150);

    return () => clearInterval(interval);
  }, [phase]);

  // Handle file selection from upload modal
  const handleFileSelect = useCallback(async (file) => {
    setFileName(file.name);
    setPhase(PHASES.PROCESSING);
    setProgress(5);
    setError(null);

    try {
      // If a real API function is provided, use it
      if (generateQuizFromFile) {
        const quiz = await generateQuizFromFile(file);
        setGeneratedQuiz(quiz);
      } else {
        // Demo mode: simulate quiz generation
        await simulateQuizGeneration();
      }

      // Complete the progress bar
      setProgress(100);

      // Small delay before showing ready screen
      setTimeout(() => {
        setPhase(PHASES.READY);
      }, 500);

    } catch (err) {
      setError(err.message || 'Failed to generate quiz');
      setPhase(PHASES.UPLOAD);
      setProgress(0);
    }
  }, [generateQuizFromFile]);

  // Demo: Simulate quiz generation (replace with real API call)
  const simulateQuizGeneration = () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const demoQuiz = {
          title: 'Generated Quiz',
          questions: [
            {
              question: "A nurse is caring for a patient with diabetes. What is the priority nursing intervention?",
              options: [
                "Administer insulin as scheduled",
                "Monitor blood glucose levels",
                "Provide dietary education",
                "Assess for complications"
              ],
              answer: "Monitor blood glucose levels",
              topic: "Diabetes Management",
              justification: "Monitoring blood glucose is the priority as it guides all other interventions."
            },
            {
              question: "Which assessment finding indicates a patient may be experiencing hypovolemic shock?",
              options: [
                "Bradycardia",
                "Hypertension",
                "Tachycardia with weak pulse",
                "Flushed skin"
              ],
              answer: "Tachycardia with weak pulse",
              topic: "Shock Assessment",
              justification: "Tachycardia with weak pulse indicates the body's compensatory response to decreased blood volume."
            },
            {
              question: "A patient is prescribed warfarin. Which lab value should the nurse monitor?",
              options: [
                "Hemoglobin",
                "INR",
                "Creatinine",
                "Potassium"
              ],
              answer: "INR",
              topic: "Anticoagulation Monitoring",
              justification: "INR (International Normalized Ratio) is used to monitor warfarin therapy effectiveness."
            },
            {
              question: "What is the most appropriate nursing intervention for a patient with pneumonia?",
              options: [
                "Restrict fluids",
                "Position in supine position",
                "Encourage deep breathing exercises",
                "Limit ambulation"
              ],
              answer: "Encourage deep breathing exercises",
              topic: "Respiratory Care",
              justification: "Deep breathing exercises help mobilize secretions and improve lung expansion."
            },
            {
              question: "A nurse is teaching a patient about heart failure. Which statement indicates understanding?",
              options: [
                "I should weigh myself once a week",
                "I can eat as much salt as I want",
                "I should call my doctor if I gain 3 pounds in one day",
                "Swelling in my legs is normal and expected"
              ],
              answer: "I should call my doctor if I gain 3 pounds in one day",
              topic: "Heart Failure Education",
              justification: "Rapid weight gain indicates fluid retention and requires immediate medical attention."
            }
          ]
        };
        resolve(demoQuiz);
      }, 3000); // 3 second simulation
    });
  };

  // Handle processing complete
  const handleProcessingComplete = useCallback(() => {
    // Progress bar already at 100%, transition handled in handleFileSelect
  }, []);

  // Handle start quiz from ready screen
  const handleStartQuiz = useCallback(() => {
    setPhase(PHASES.TRANSITIONING);

    // Notify parent if callback provided
    if (onQuizGenerated && generatedQuiz) {
      onQuizGenerated(generatedQuiz);
    }

    // Navigate to dedicated quiz page with quiz data
    setTimeout(() => {
      navigate('/quiz/play', {
        state: {
          quizzes: generatedQuiz?.questions || [],
          title: generatedQuiz?.title || 'Room 217',
          fromUpload: true
        }
      });

      // Close the flow controller
      if (onClose) onClose();
    }, 1500);
  }, [navigate, generatedQuiz, onQuizGenerated, onClose]);

  // Handle close/cancel
  const handleClose = useCallback(() => {
    if (phase === PHASES.PROCESSING) {
      // Confirm before canceling during processing
      const confirmed = window.confirm('Quiz is being generated. Are you sure you want to cancel?');
      if (!confirmed) return;
    }
    if (onClose) onClose();
  }, [phase, onClose]);

  // Don't render if not open
  if (!isOpen && phase === PHASES.IDLE) return null;

  return (
    <div className="quiz-flow-controller">
      {/* Upload Modal */}
      {phase === PHASES.UPLOAD && (
        <FileUploadModal
          isOpen={true}
          onClose={handleClose}
          onFileSelect={handleFileSelect}
          error={error}
        />
      )}

      {/* Processing Screen */}
      <ProcessingScreen
        isVisible={phase === PHASES.PROCESSING}
        progress={progress}
        fileName={fileName}
        onComplete={handleProcessingComplete}
      />

      {/* Serum Ready Screen */}
      <SerumReadyScreen
        isVisible={phase === PHASES.READY || phase === PHASES.TRANSITIONING}
        quizTitle={generatedQuiz?.title || 'Your Quiz'}
        questionCount={generatedQuiz?.questions?.length || 5}
        onStartQuiz={handleStartQuiz}
      />
    </div>
  );
};

export default QuizFlowController;
