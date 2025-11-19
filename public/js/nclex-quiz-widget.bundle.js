// ============================================
// NCLEX QUIZ WIDGET - Vanilla JavaScript
// No dependencies, just drop in and use
// ============================================

(function() {
  'use strict';

  // Quiz Questions Data
  const QUIZ_QUESTIONS = [
    {
      id: 1,
      topic: 'Prioritization',
      topicIcon: '🎯',
      question: 'A nurse receives report on four clients. Which client should the nurse assess FIRST?',
      options: [
        { letter: 'A', text: 'A client with COPD and oxygen saturation of 91% on 2L nasal cannula' },
        { letter: 'B', text: 'A client 1 day post-appendectomy with pain rated 6/10' },
        { letter: 'C', text: 'A client with diabetes mellitus and a blood glucose of 58 mg/dL' },
        { letter: 'D', text: 'A client with heart failure who gained 2 pounds overnight' }
      ],
      correctAnswer: 'C',
      rationaleKey: 'Hypoglycemia is an immediate life-threatening emergency.',
      rationaleDetail: 'Blood glucose of 58 mg/dL can rapidly progress to <span class="qw-rationale-warning">seizures and death</span> if not treated immediately. Other clients need assessment but none are immediately life-threatening. Remember: <span class="qw-rationale-highlight">ABCs and Maslow\'s hierarchy</span>—physiological needs first.'
    },
    {
      id: 2,
      topic: 'Prioritization',
      topicIcon: '🎯',
      question: 'The nurse is caring for multiple clients. Which finding requires immediate intervention?',
      options: [
        { letter: 'A', text: 'A postoperative client with a temperature of 99.2°F (37.3°C)' },
        { letter: 'B', text: 'A client receiving a blood transfusion who reports itching and hives' },
        { letter: 'C', text: 'A client with pneumonia and productive cough of yellow sputum' },
        { letter: 'D', text: 'A client 2 days post-MI with sinus bradycardia at 58 bpm' }
      ],
      correctAnswer: 'B',
      rationaleKey: 'Allergic transfusion reaction can escalate to anaphylaxis.',
      rationaleDetail: 'Itching and hives = <span class="qw-rationale-warning">STOP transfusion immediately</span> and notify provider. Low-grade fever post-op is expected. Productive cough shows effective clearance. Bradycardia at 58 may be therapeutic from beta-blockers.'
    },
    {
      id: 3,
      topic: 'Pharmacology',
      topicIcon: '💊',
      question: 'A client is prescribed metoprolol 50 mg PO twice daily. Which assessment finding should the nurse report to the provider before administering the medication?',
      options: [
        { letter: 'A', text: 'Blood pressure of 118/76 mmHg' },
        { letter: 'B', text: 'Heart rate of 52 beats per minute' },
        { letter: 'C', text: 'Respiratory rate of 16 breaths per minute' },
        { letter: 'D', text: 'Temperature of 98.8°F (37.1°C)' }
      ],
      correctAnswer: 'B',
      rationaleKey: 'Hold beta-blockers when HR < 60 bpm.',
      rationaleDetail: 'Metoprolol decreases heart rate and BP. At <span class="qw-rationale-highlight">52 bpm</span>, administering could cause symptomatic bradycardia or heart block. <span class="qw-rationale-warning">Hold dose and notify provider</span>. Other vitals are within normal limits.'
    },
    {
      id: 4,
      topic: 'Pharmacology',
      topicIcon: '💊',
      question: 'A nurse is preparing to administer insulin lispro (Humalog) to a client before breakfast. When should the nurse administer this medication?',
      options: [
        { letter: 'A', text: '30 to 45 minutes before the meal' },
        { letter: 'B', text: '15 minutes before or with the meal' },
        { letter: 'C', text: '1 hour before the meal' },
        { letter: 'D', text: '2 hours after the meal' }
      ],
      correctAnswer: 'B',
      rationaleKey: 'Rapid-acting insulin = give 15 min before or with meal.',
      rationaleDetail: 'Lispro onset: <span class="qw-rationale-highlight">15 minutes</span>, peak: 1-2 hours. Giving 30-60 min before risks hypoglycemia. Giving after defeats purpose. <span class="qw-rationale-warning">Timing is critical</span> for insulin safety.'
    },
    {
      id: 5,
      topic: 'Safety',
      topicIcon: '🛡️',
      question: 'A nurse is preparing to administer medications. Which action demonstrates correct medication administration safety?',
      options: [
        { letter: 'A', text: 'Crushing an extended-release tablet for a client with dysphagia' },
        { letter: 'B', text: 'Leaving medications at the bedside for the client to take after lunch' },
        { letter: 'C', text: 'Scanning the client\'s armband and the medication barcode before administration' },
        { letter: 'D', text: 'Having another nurse witness administration of an oral pain medication' }
      ],
      correctAnswer: 'C',
      rationaleKey: 'Barcode scanning reduces medication errors by up to 50%.',
      rationaleDetail: '<span class="qw-rationale-highlight">BCMA</span> verifies right patient + right medication at point of care. Crushing ER meds = dose dumping. Bedside meds = no direct observation. Witness only needed for <span class="qw-rationale-highlight">controlled substances</span>.'
    },
    {
      id: 6,
      topic: 'Safety',
      topicIcon: '🛡️',
      question: 'A nurse is caring for a client at high risk for falls. Which intervention is MOST important to include in the plan of care?',
      options: [
        { letter: 'A', text: 'Place a "Fall Risk" sign above the client\'s bed' },
        { letter: 'B', text: 'Keep all four side rails up at all times' },
        { letter: 'C', text: 'Ensure the call light is within reach and the client knows how to use it' },
        { letter: 'D', text: 'Administer sedative medications to keep the client calm' }
      ],
      correctAnswer: 'C',
      rationaleKey: 'Call light accessibility = most effective fall prevention.',
      rationaleDetail: 'Allows clients to request help before attempting activities alone. Signs are passive only. <span class="qw-rationale-warning">Four rails up = restraint</span> and increases injury severity. Sedatives <span class="qw-rationale-warning">increase</span> fall risk.'
    },
    {
      id: 7,
      topic: 'SBAR',
      topicIcon: '📋',
      question: 'A nurse needs to contact the provider about a client\'s deteriorating condition. Using SBAR format, which information should be stated FIRST?',
      options: [
        { letter: 'A', text: '"The client\'s blood pressure has dropped from 130/80 to 88/60 in the last hour."' },
        { letter: 'B', text: '"I am calling about Mr. Johnson in room 412, admitted yesterday for pneumonia."' },
        { letter: 'C', text: '"I recommend a fluid bolus and reassessment in 30 minutes."' },
        { letter: 'D', text: '"The client received his last dose of antibiotics at 0800."' }
      ],
      correctAnswer: 'B',
      rationaleKey: 'SBAR: Situation comes FIRST.',
      rationaleDetail: '<span class="qw-rationale-highlight">S</span>ituation = identify yourself, client, reason for calling. BP drop = <span class="qw-rationale-highlight">A</span>ssessment. Antibiotics = <span class="qw-rationale-highlight">B</span>ackground. Fluid bolus = <span class="qw-rationale-highlight">R</span>ecommendation.'
    },
    {
      id: 8,
      topic: 'SBAR',
      topicIcon: '📋',
      question: 'During shift handoff, the nurse reports: "Mrs. Chen is stable, her vitals are fine, and she had an okay night." What is the PRIMARY problem with this communication?',
      options: [
        { letter: 'A', text: 'The nurse did not use the client\'s full name' },
        { letter: 'B', text: 'The information is vague and lacks specific, measurable data' },
        { letter: 'C', text: 'The nurse should have waited for questions first' },
        { letter: 'D', text: 'The report was too brief and needs more subjective data' }
      ],
      correctAnswer: 'B',
      rationaleKey: '"Stable," "fine," "okay" = no actionable information.',
      rationaleDetail: 'Effective handoff needs <span class="qw-rationale-highlight">specific data</span>: actual vital values, I&O, pain scores, pending tasks. Vague terms can lead to <span class="qw-rationale-warning">missed deterioration and patient harm</span>.'
    },
    {
      id: 9,
      topic: 'Pathophysiology',
      topicIcon: '🫀',
      question: 'A client with heart failure asks why they need to weigh themselves daily. Which response by the nurse BEST explains the rationale?',
      options: [
        { letter: 'A', text: '"Daily weights help monitor your nutritional status and muscle mass."' },
        { letter: 'B', text: '"Sudden weight gain indicates fluid retention that could worsen your heart failure."' },
        { letter: 'C', text: '"We need to ensure you are not losing too much weight from your medications."' },
        { letter: 'D', text: '"Weight monitoring is required for all clients with chronic diseases."' }
      ],
      correctAnswer: 'B',
      rationaleKey: 'Weight gain = fluid retention = worsening heart failure.',
      rationaleDetail: '<span class="qw-rationale-warning">2-3 lbs in 24h or 5 lbs in a week</span> = fluid overload requiring diuretic adjustment. Daily weights are an early warning system. Remember: <span class="qw-rationale-highlight">1 liter fluid = 2.2 lbs</span>.'
    },
    {
      id: 10,
      topic: 'Pathophysiology',
      topicIcon: '🫀',
      question: 'A client with chronic kidney disease has a potassium level of 6.2 mEq/L. Which finding should the nurse anticipate?',
      options: [
        { letter: 'A', text: 'Muscle cramps and tetany' },
        { letter: 'B', text: 'Tall, peaked T waves on ECG' },
        { letter: 'C', text: 'Hyperactive bowel sounds' },
        { letter: 'D', text: 'Excessive thirst and urination' }
      ],
      correctAnswer: 'B',
      rationaleKey: 'Hyperkalemia causes peaked T waves and fatal arrhythmias.',
      rationaleDetail: 'K+ >5.0 = <span class="qw-rationale-highlight">tall peaked T waves</span>, widened QRS, flattened P waves. At 6.2, <span class="qw-rationale-warning">cardiac arrest risk</span>. Muscle cramps = hypocalcemia. CKD patients can\'t excrete K+ properly.'
    }
  ];

  const TOPIC_META = {
    'Prioritization': { icon: '🎯', color: '#9f7aea', description: 'Clinical decision-making & triage' },
    'Pharmacology': { icon: '💊', color: '#ed8936', description: 'Medication safety & administration' },
    'Safety': { icon: '🛡️', color: '#48bb78', description: 'Patient safety & error prevention' },
    'SBAR': { icon: '📋', color: '#4299e1', description: 'Clinical communication' },
    'Pathophysiology': { icon: '🫀', color: '#f56565', description: 'Disease processes & assessment' }
  };

  // Quiz State
  let currentScreen = 'intro';
  let currentQuestionIndex = 0;
  let selectedAnswer = null;
  let showFeedback = false;
  let answers = [];

  // DOM Elements
  let modalRoot = null;

  // Inject CSS
  function injectStyles() {
    if (document.getElementById('nclex-quiz-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'nclex-quiz-styles';
    style.textContent = `
      .quiz-widget-overlay {
        position: fixed;
        inset: 0;
        background: rgba(45, 45, 45, 0.6);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
        animation: qw-overlayFadeIn 0.3s ease-out;
      }
      
      .quiz-widget-overlay.closing {
        animation: qw-overlayFadeOut 0.3s ease-out forwards;
      }
      
      @keyframes qw-overlayFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes qw-overlayFadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      
      .quiz-widget-modal {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(173, 125, 195, 0.2);
        border-radius: 24px;
        width: 100%;
        max-width: 700px;
        max-height: 95vh;
        overflow-y: auto;
        box-shadow: 0 16px 48px rgba(155, 111, 176, 0.25);
        position: relative;
        animation: qw-modalSlideUp 0.3s ease-out;
        scrollbar-width: thin;
        scrollbar-color: rgba(173, 125, 195, 0.3) transparent;
      }
      
      .quiz-widget-modal::-webkit-scrollbar {
        width: 6px;
      }
      
      .quiz-widget-modal::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .quiz-widget-modal::-webkit-scrollbar-thumb {
        background: rgba(173, 125, 195, 0.3);
        border-radius: 3px;
      }
      
      .quiz-widget-overlay.closing .quiz-widget-modal {
        animation: qw-modalSlideDown 0.3s ease-out forwards;
      }
      
      @keyframes qw-modalSlideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      @keyframes qw-modalSlideDown {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(20px); }
      }
      
      .quiz-widget-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: none;
        background: rgba(255, 255, 255, 0.8);
        color: #5f6368;
        font-size: 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        z-index: 10;
      }
      
      .quiz-widget-close:hover {
        background: rgba(173, 125, 195, 0.15);
        color: #5a2d82;
      }
      
      .quiz-widget-intro {
        padding: 40px 32px;
      }
      
      .qw-intro-header {
        text-align: center;
        margin-bottom: 32px;
      }
      
      .qw-intro-badge {
        display: inline-block;
        background: #f3e8ff;
        color: #5a2d82;
        padding: 6px 16px;
        border-radius: 100px;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 16px;
      }
      
      .qw-intro-title {
        font-size: 28px;
        font-weight: 700;
        color: #1f1f1f;
        margin-bottom: 12px;
      }
      
      .qw-intro-description {
        font-size: 16px;
        color: #5f6368;
        line-height: 1.6;
      }
      
      .qw-intro-topics {
        background: rgba(243, 232, 255, 0.5);
        border-radius: 16px;
        padding: 20px 24px;
        margin-bottom: 32px;
      }
      
      .qw-intro-topics h3 {
        font-size: 14px;
        font-weight: 600;
        color: #5a2d82;
        margin-bottom: 12px;
      }
      
      .qw-intro-topics ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .qw-intro-topics li {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        color: #5f6368;
      }
      
      .qw-intro-footer {
        text-align: center;
      }
      
      .qw-btn-start {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: linear-gradient(135deg, #ad7dc3 0%, #663a82 100%);
        color: white;
        border: none;
        padding: 14px 32px;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 16px rgba(155, 111, 176, 0.3);
      }
      
      .qw-btn-start:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(155, 111, 176, 0.4);
      }
      
      .qw-intro-time {
        font-size: 13px;
        color: #718096;
        margin-top: 16px;
      }
      
      .quiz-widget-quiz {
        padding: 24px;
      }
      
      .qw-progress {
        margin-bottom: 24px;
      }
      
      .qw-progress-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        padding-right: 30px;
      }
      
      .qw-progress-label {
        font-size: 14px;
        font-weight: 600;
        color: #5a2d82;
      }
      
      .qw-progress-topic {
        font-size: 13px;
        color: #718096;
      }
      
      .qw-progress-track {
        height: 8px;
        background: #f3e8ff;
        border-radius: 100px;
        overflow: hidden;
      }
      
      .qw-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #d2bde7 0%, #ad7dc3 100%);
        border-radius: 100px;
        transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      .qw-question {
        margin-bottom: 20px;
      }
      
      .qw-question-text {
        font-size: 16px;
        font-weight: 500;
        color: #1f1f1f;
        line-height: 1.6;
        margin: 0;
      }
      
      .qw-options {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
      }
      
      .qw-option {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        padding: 12px 14px;
        background: #f9f5fd;
        border: 2px solid #e0d6f5;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
        width: 100%;
        font-family: inherit;
        font-size: 13px;
      }
      
      .qw-option:hover:not(:disabled) {
        background: #f1e9fc;
        transform: translateY(-1px);
      }
      
      .qw-option.selected {
        border-color: #ad7dc3;
        background: #f1e9fc;
      }
      
      .qw-option.correct {
        background: #d4f4e4;
        border-color: #38a169;
        animation: qw-correctPulse 0.3s ease-out;
      }
      
      .qw-option.incorrect {
        background: #fcebea;
        border-color: #e53e3e;
        animation: qw-shake 0.4s ease-in-out;
      }
      
      @keyframes qw-correctPulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.02); }
        100% { transform: scale(1); }
      }
      
      @keyframes qw-shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-6px); }
        50% { transform: translateX(6px); }
        75% { transform: translateX(-6px); }
      }
      
      .qw-option-content {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        flex: 1;
      }
      
      .qw-option-letter {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        background: rgba(255, 255, 255, 0.8);
        border: 1px solid #e0d6f5;
        border-radius: 50%;
        font-weight: 600;
        font-size: 12px;
        flex-shrink: 0;
      }
      
      .qw-option.correct .qw-option-letter {
        background: #38a169;
        border-color: #38a169;
        color: white;
      }
      
      .qw-option.incorrect .qw-option-letter {
        background: #e53e3e;
        border-color: #e53e3e;
        color: white;
      }
      
      .qw-option-text {
        line-height: 1.5;
        color: #1f1f1f;
      }
      
      .qw-answer-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        flex-shrink: 0;
        color: white;
        font-weight: bold;
        font-size: 14px;
      }
      
      .qw-answer-icon.checkmark {
        background: #38a169;
      }
      
      .qw-answer-icon.x-mark {
        background: #e53e3e;
      }
      
      .qw-feedback {
        margin-bottom: 16px;
        animation: qw-fadeIn 0.3s ease-out;
      }
      
      @keyframes qw-fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .qw-feedback-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-radius: 8px;
        margin-bottom: 10px;
        font-weight: 600;
        font-size: 14px;
      }
      
      .qw-feedback-header.correct {
        background: #d4f4e4;
        color: #276749;
      }
      
      .qw-feedback-header.incorrect {
        background: #fcebea;
        color: #822727;
      }
      
      .qw-rationale {
        background: #f3e8ff;
        border-radius: 10px;
        padding: 12px 14px;
        max-height: 140px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: rgba(173, 125, 195, 0.3) transparent;
      }
      
      .qw-rationale::-webkit-scrollbar {
        width: 4px;
      }
      
      .qw-rationale::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .qw-rationale::-webkit-scrollbar-thumb {
        background: rgba(173, 125, 195, 0.3);
        border-radius: 2px;
      }
      
      .qw-rationale h4 {
        font-size: 13px;
        font-weight: 600;
        color: #5a2d82;
        margin-bottom: 8px;
      }
      
      .qw-rationale-content {
        font-size: 13px;
        color: #4a5568;
        line-height: 1.6;
        margin: 0;
      }
      
      .qw-rationale-key {
        display: block;
        font-weight: 600;
        color: #276749;
        background: rgba(56, 161, 105, 0.1);
        padding: 6px 10px;
        border-radius: 6px;
        margin-bottom: 8px;
        border-left: 3px solid #38a169;
      }
      
      .qw-rationale-detail {
        display: block;
        color: #5f6368;
        padding-left: 2px;
      }
      
      .qw-rationale-highlight {
        background: rgba(173, 125, 195, 0.15);
        padding: 1px 4px;
        border-radius: 3px;
        font-weight: 500;
        color: #5a2d82;
      }
      
      .qw-rationale-warning {
        color: #c53030;
        font-weight: 500;
      }
      
      .qw-actions {
        display: flex;
        justify-content: center;
      }
      
      .qw-btn-submit,
      .qw-btn-next {
        padding: 12px 24px;
        border-radius: 10px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
      }
      
      .qw-btn-submit {
        background: linear-gradient(135deg, #ad7dc3 0%, #663a82 100%);
        color: white;
        box-shadow: 0 4px 12px rgba(155, 111, 176, 0.25);
      }
      
      .qw-btn-submit:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(155, 111, 176, 0.35);
      }
      
      .qw-btn-submit:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .qw-btn-next {
        background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
        color: white;
        box-shadow: 0 4px 12px rgba(72, 187, 120, 0.25);
      }
      
      .qw-btn-next:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(72, 187, 120, 0.35);
      }
      
      .quiz-widget-results {
        padding: 24px;
      }
      
      .qw-results-summary {
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 24px;
        color: white;
        text-align: center;
      }
      
      .qw-results-summary.outstanding {
        background: linear-gradient(135deg, #68d391 0%, #38a169 100%);
      }
      
      .qw-results-summary.excellent {
        background: linear-gradient(135deg, #9ae6b4 0%, #68d391 100%);
      }
      
      .qw-results-summary.good {
        background: linear-gradient(135deg, #fbd38d 0%, #ed8936 100%);
      }
      
      .qw-results-summary.moderate {
        background: linear-gradient(135deg, #f6ad55 0%, #dd6b20 100%);
      }
      
      .qw-results-summary.study {
        background: linear-gradient(135deg, #fc8181 0%, #e53e3e 100%);
      }
      
      .qw-summary-header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-bottom: 16px;
      }
      
      .qw-summary-emoji {
        font-size: 48px;
      }
      
      .qw-summary-title {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 4px;
      }
      
      .qw-summary-message {
        font-size: 14px;
        opacity: 0.95;
        margin: 0;
      }
      
      .qw-summary-score {
        font-size: 42px;
        font-weight: 700;
      }
      
      .qw-score-percent {
        font-size: 24px;
        opacity: 0.9;
        margin-left: 8px;
      }
      
      .qw-breakdown {
        margin-bottom: 24px;
      }
      
      .qw-breakdown-section {
        margin-bottom: 20px;
      }
      
      .qw-section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 12px;
      }
      
      .qw-section-title.strengths {
        color: #38a169;
      }
      
      .qw-section-title.needs-work {
        color: #e53e3e;
      }
      
      .qw-topic-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .qw-topic-item {
        background: #f9f5fd;
        border-radius: 12px;
        padding: 14px 16px;
      }
      
      .qw-topic-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }
      
      .qw-topic-icon {
        font-size: 18px;
      }
      
      .qw-topic-name {
        font-weight: 600;
        color: #1f1f1f;
        flex: 1;
      }
      
      .qw-topic-score {
        font-weight: 600;
        color: #5a2d82;
      }
      
      .qw-topic-bar {
        height: 6px;
        background: #e0d6f5;
        border-radius: 100px;
        overflow: hidden;
      }
      
      .qw-topic-fill {
        height: 100%;
        border-radius: 100px;
      }
      
      .qw-topic-description {
        font-size: 12px;
        color: #718096;
        margin-top: 8px;
        margin-bottom: 0;
      }
      
      .qw-cta {
        background: linear-gradient(135deg, rgba(173, 125, 195, 0.1) 0%, rgba(102, 58, 130, 0.1) 100%);
        border-radius: 16px;
        padding: 24px;
        text-align: center;
        margin-bottom: 16px;
      }
      
      .qw-cta-focus {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }
      
      .qw-focus-label {
        font-size: 14px;
        color: #5f6368;
      }
      
      .qw-focus-topics {
        font-size: 16px;
        font-weight: 700;
        color: #e53e3e;
      }
      
      .qw-cta-success h3 {
        display: inline;
        font-size: 16px;
        font-weight: 600;
        color: #38a169;
        margin-bottom: 12px;
      }
      
      .qw-cta p {
        font-size: 14px;
        color: #5f6368;
        margin-bottom: 20px;
        line-height: 1.6;
      }
      
      .qw-cta-subtext {
        font-size: 12px !important;
        color: #718096 !important;
        margin-bottom: 0 !important;
        margin-top: 12px !important;
      }
      
      .qw-cta-buttons {
        display: flex;
        gap: 12px;
        justify-content: center;
        flex-wrap: wrap;
      }
      
      .qw-btn-signup {
        display: inline-flex;
        align-items: center;
        padding: 12px 24px;
        background: linear-gradient(135deg, #ad7dc3 0%, #663a82 100%);
        color: white;
        border-radius: 10px;
        font-weight: 600;
        text-decoration: none;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(155, 111, 176, 0.25);
      }
      
      .qw-btn-signup:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(155, 111, 176, 0.35);
        color: white;
      }
      
      .qw-btn-retry {
        padding: 12px 24px;
        background: rgba(255, 255, 255, 0.8);
        color: #5a2d82;
        border: 2px solid rgba(173, 125, 195, 0.3);
        border-radius: 10px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .qw-btn-retry:hover {
        background: white;
        border-color: #ad7dc3;
      }
      
      .qw-disclaimer {
        font-size: 11px;
        color: #718096;
        text-align: center;
        margin: 0;
      }
      
      /* Results header tiers */
      .qw-results-header.outstanding {
        background: linear-gradient(135deg, #68d391 0%, #38a169 100%);
      }
      
      .qw-results-header.excellent {
        background: linear-gradient(135deg, #9ae6b4 0%, #68d391 100%);
      }
      
      .qw-results-header.good {
        background: linear-gradient(135deg, #fbd38d 0%, #ed8936 100%);
      }
      
      .qw-results-header.moderate {
        background: linear-gradient(135deg, #f6ad55 0%, #dd6b20 100%);
      }
      
      .qw-results-header.study {
        background: linear-gradient(135deg, #fc8181 0%, #e53e3e 100%);
      }
      
      .qw-header-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .qw-header-emoji {
        font-size: 32px;
      }
      
      .qw-header-text {
        display: flex;
        flex-direction: column;
      }
      
      .qw-header-title {
        font-size: 20px;
        font-weight: 700;
      }
      
      .qw-header-score {
        font-size: 14px;
        opacity: 0.95;
      }
      
      .qw-disclaimer-inline {
        font-size: 11px;
        color: #a0aec0;
      }
      
      /* Animations for results */
      @keyframes qw-slideInUp {
        from {
          opacity: 0;
          transform: translateY(15px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes qw-fadeInScale {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      
      @keyframes qw-slideInLeft {
        from {
          opacity: 0;
          transform: translateX(-15px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      
      @keyframes qw-barFill {
        from {
          width: 0%;
        }
      }
      
      .quiz-widget-results-compact {
        padding: 16px 20px;
      }
      
      .qw-results-header {
        border-radius: 12px;
        padding: 14px 18px;
        margin-bottom: 12px;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: qw-fadeInScale 0.3s ease-out;
      }
      
      /* Topics section */
      .qw-topics-compact {
        margin-bottom: 12px;
      }
      
      .qw-topic-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 0;
        border-bottom: 1px solid #f0e6f5;
        animation: qw-slideInLeft 0.3s ease-out both;
      }
      
      .qw-topic-row:last-child {
        border-bottom: none;
      }
      
      .qw-topic-row .qw-topic-icon {
        font-size: 12px;
        flex-shrink: 0;
      }
      
      .qw-topic-row .qw-topic-name {
        font-size: 12px;
        font-weight: 500;
        color: #1f1f1f;
        min-width: 85px;
      }
      
      .qw-topic-row.weak .qw-topic-name {
        color: #c53030;
      }
      
      .qw-topic-bar-inline {
        flex: 1;
        height: 5px;
        background: #f0e6f5;
        border-radius: 3px;
        overflow: hidden;
      }
      
      .qw-topic-fill-inline {
        height: 100%;
        border-radius: 3px;
        animation: qw-barFill 0.6s ease-out 0.3s both;
      }
      
      .qw-topic-score-inline {
        font-size: 11px;
        font-weight: 600;
        color: #5a2d82;
        min-width: 24px;
        text-align: right;
      }
      
      .qw-topic-row.weak .qw-topic-score-inline {
        color: #c53030;
      }
      
      /* CTA */
      .qw-cta-compact {
        background: linear-gradient(135deg, rgba(173, 125, 195, 0.1) 0%, rgba(102, 58, 130, 0.15) 100%);
        border-radius: 12px;
        padding: 14px;
        text-align: center;
        margin-bottom: 10px;
        animation: qw-slideInUp 0.4s ease-out 0.5s both;
      }
      
      .qw-cta-text {
        font-size: 13px;
        color: #4a5568;
        margin: 0 0 10px 0;
        line-height: 1.4;
      }
      
      .qw-cta-text strong {
        color: #c53030;
      }
      
      .qw-btn-signup-compact {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: linear-gradient(135deg, #ad7dc3 0%, #663a82 100%);
        color: white;
        padding: 12px 24px;
        border-radius: 10px;
        font-weight: 600;
        font-size: 14px;
        text-decoration: none;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(155, 111, 176, 0.3);
      }
      
      .qw-btn-signup-compact:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(155, 111, 176, 0.4);
        color: white;
      }
      
      .qw-btn-icon {
        font-size: 14px;
      }
      
      .qw-cta-note {
        display: block;
        font-size: 10px;
        color: #718096;
        margin-top: 6px;
      }
      
      .qw-results-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        animation: qw-fadeInScale 0.3s ease-out 0.6s both;
      }
      
      .qw-btn-retry-small {
        background: none;
        border: none;
        color: #718096;
        font-size: 11px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: all 0.2s ease;
      }
      
      .qw-btn-retry-small:hover {
        background: #f0e6f5;
        color: #5a2d82;
      }
      
      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .qw-results-header,
        .qw-topic-row,
        .qw-cta-compact,
        .qw-results-footer,
        .qw-topic-fill-inline {
          animation: none !important;
        }
      }
      
      @media (max-width: 640px) {
        .quiz-widget-modal {
          border-radius: 20px;
          max-height: 95vh;
        }
        
        .quiz-widget-intro {
          padding: 32px 20px;
        }
        
        .qw-intro-title {
          font-size: 24px;
        }
        
        .quiz-widget-quiz,
        .quiz-widget-results {
          padding: 20px 16px;
        }
        
        .qw-question-text {
          font-size: 15px;
        }
        
        .qw-option {
          padding: 12px 14px;
        }
        
        .qw-summary-emoji {
          font-size: 36px;
        }
        
        .qw-summary-title {
          font-size: 20px;
        }
        
        .qw-summary-score {
          font-size: 36px;
        }
        
        .qw-cta-buttons {
          flex-direction: column;
        }
      }
      
      @media (prefers-reduced-motion: reduce) {
        .quiz-widget-overlay,
        .quiz-widget-modal,
        .qw-option,
        .qw-feedback {
          animation: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Calculate results
  function calculateResults() {
    const topicScores = {};
    Object.keys(TOPIC_META).forEach(topic => {
      topicScores[topic] = { correct: 0, total: 0 };
    });
    answers.forEach(answer => {
      topicScores[answer.topic].total++;
      if (answer.correct) {
        topicScores[answer.topic].correct++;
      }
    });
    const results = Object.entries(topicScores).map(([topic, scores]) => ({
      topic,
      ...TOPIC_META[topic],
      correct: scores.correct,
      total: scores.total,
      percentage: scores.total > 0 ? Math.round((scores.correct / scores.total) * 100) : 0
    }));
    const strengths = results.filter(r => r.percentage >= 50).sort((a, b) => b.percentage - a.percentage);
    const needsWork = results.filter(r => r.percentage < 50).sort((a, b) => a.percentage - b.percentage);
    
    const totalCorrect = answers.filter(a => a.correct).length;
    const overallPercentage = Math.round((totalCorrect / QUIZ_QUESTIONS.length) * 100);
    
    return { strengths, needsWork, totalCorrect, overallPercentage };
  }

  // Get performance tier
  function getPerformanceTier(percentage) {
    if (percentage >= 90) return { emoji: '🏆', title: 'Outstanding!', message: "You're NCLEX ready!", tierClass: 'outstanding' };
    if (percentage >= 80) return { emoji: '🌟', title: 'Excellent!', message: 'Strong clinical judgment', tierClass: 'excellent' };
    if (percentage >= 70) return { emoji: '👏', title: 'Good Work!', message: 'Solid foundation', tierClass: 'good' };
    if (percentage >= 60) return { emoji: '💪', title: 'Keep Going!', message: "You're making progress", tierClass: 'moderate' };
    return { emoji: '📚', title: 'Keep Studying!', message: 'Focus on weak areas', tierClass: 'study' };
  }

  // Render intro screen
  function renderIntro() {
    const topicsList = Object.entries(TOPIC_META).map(([topic, meta]) => 
      `<li><span>${meta.icon}</span><span>${topic}</span></li>`
    ).join('');
    return `
      <div class="quiz-widget-intro">
        <div class="qw-intro-header">
          <span class="qw-intro-badge">🩺 NCLEX Practice</span>
          <h2 class="qw-intro-title">Ready to Test Your Knowledge?</h2>
          <p class="qw-intro-description">
            10 clinical judgment questions covering the core NCLEX topics.
            Get instant feedback with detailed rationales.
          </p>
        </div>
        
        <div class="qw-intro-topics">
          <h3>Topics Covered:</h3>
          <ul>${topicsList}</ul>
        </div>
        
        <div class="qw-intro-footer">
          <button class="qw-btn-start" id="qw-start-btn">
            <span>🚀</span>
            Start Quiz
          </button>
          <p class="qw-intro-time">⏱️ Takes about 5-8 minutes</p>
        </div>
      </div>
    `;
  }

  // Render quiz screen
  function renderQuiz() {
    const question = QUIZ_QUESTIONS[currentQuestionIndex];
    const progress = ((currentQuestionIndex + (showFeedback ? 1 : 0)) / QUIZ_QUESTIONS.length) * 100;
    const optionsHtml = question.options.map(option => {
      const isSelected = selectedAnswer === option.letter;
      const isCorrect = option.letter === question.correctAnswer;
      
      let optionClass = 'qw-option';
      let iconHtml = '';
      
      if (showFeedback) {
        if (isCorrect) {
          optionClass += ' correct';
          iconHtml = '<span class="qw-answer-icon checkmark">✓</span>';
        } else if (isSelected && !isCorrect) {
          optionClass += ' incorrect';
          iconHtml = '<span class="qw-answer-icon x-mark">✗</span>';
        }
      } else if (isSelected) {
        optionClass += ' selected';
      }

      return `
        <button class="${optionClass}" data-letter="${option.letter}" ${showFeedback ? 'disabled' : ''}>
          <span class="qw-option-content">
            <span class="qw-option-letter">${option.letter}</span>
            <span class="qw-option-text">${option.text}</span>
          </span>
          ${iconHtml}
        </button>
      `;
    }).join('');

    const feedbackHtml = showFeedback ? `
      <div class="qw-feedback">
        <div class="qw-feedback-header ${selectedAnswer === question.correctAnswer ? 'correct' : 'incorrect'}">
          <span>${selectedAnswer === question.correctAnswer ? '✓' : '✗'}</span>
          <span>${selectedAnswer === question.correctAnswer ? 'Correct!' : 'Incorrect'}</span>
        </div>
        <div class="qw-rationale">
          <h4>💡 Rationale</h4>
          <p>${question.rationaleDetail}</p>
        </div>
      </div>
    ` : '';
    
    const actionHtml = !showFeedback 
      ? `<button class="qw-btn-submit" id="qw-submit-btn" ${!selectedAnswer ? 'disabled' : ''}>Submit Answer</button>`
      : `<button class="qw-btn-next" id="qw-next-btn">${currentQuestionIndex < QUIZ_QUESTIONS.length - 1 ? 'Next Question →' : 'View Results →'}</button>`;

    return `
      <div class="quiz-widget-quiz">
        <div class="qw-progress">
          <div class="qw-progress-info">
            <span class="qw-progress-label">Question ${currentQuestionIndex + 1} of ${QUIZ_QUESTIONS.length}</span>
            <span class="qw-progress-topic">${question.topicIcon} ${question.topic}</span>
          </div>
          <div class="qw-progress-track">
            <div class="qw-progress-fill" style="width: ${progress}%"></div>
          </div>
        </div>

        <div class="qw-question">
          <p class="qw-question-text">${question.question}</p>
        </div>

        <div class="qw-options">${optionsHtml}</div>

        ${feedbackHtml}

        <div class="qw-actions">${actionHtml}</div>
      </div>
    `;
  }

  // Render results screen
  // Render results screen
function renderResults() {
  const { strengths, needsWork, totalCorrect, overallPercentage } = calculateResults();
  const tier = getPerformanceTier(overallPercentage);

  // Sort all topics by performance for display
  const allTopics = [
    ...strengths.map(t => ({...t, isWeak: false})),
    ...needsWork.map(t => ({...t, isWeak: true}))
  ].sort((a, b) => b.percentage - a.percentage);
  
  const topicsHtml = allTopics.map((topic, index) => `
    <div class="qw-topic-row ${topic.isWeak ? 'weak' : ''}" style="animation-delay: ${0.2 + index * 0.08}s">
      <span class="qw-topic-icon">${topic.icon}</span>
      <span class="qw-topic-name">${topic.topic}</span>
      <div class="qw-topic-bar-inline">
        <div class="qw-topic-fill-inline" style="width: ${topic.percentage}%; background: ${topic.isWeak ? '#e53e3e' : topic.color}"></div>
      </div>
      <span class="qw-topic-score-inline">${topic.correct}/${topic.total}</span>
    </div>
  `).join('');
  
  // --- FIX: Define focusTopics from needsWork array ---
  const focusTopics = needsWork.map(t => t.topic);
  
  // Generate the prompt that will be pre-filled in ChatInterface
  const targetedPrompt = needsWork.length > 0 
    ? `I just took a practice quiz and scored ${overallPercentage}%. I need to improve on: ${focusTopics.join(', ')}. Can you quiz me on these weak areas with 5 targeted questions?`
    : `I just scored ${overallPercentage}% on a practice quiz! Challenge me with 5 advanced questions.`;

  // Encode the prompt for URL - link to chat with pre-filled prompt
  const promptParam = encodeURIComponent(targetedPrompt);
  const signupUrl = `/chat?prompt=${promptParam}`;
  
  // CTA text based on performance
  const ctaText = needsWork.length > 0 
    ? `Get AI practice targeting <strong>${focusTopics.slice(0, 2).join(' & ')}</strong>`
    : 'Challenge yourself with advanced questions';
    
  return `
    <div class="quiz-widget-results-compact">
      <div class="qw-results-header ${tier.tierClass}">
        <div class="qw-header-content">
          <span class="qw-header-emoji">${tier.emoji}</span>
          <div class="qw-header-text">
            <span class="qw-header-title">${tier.title}</span>
            <span class="qw-header-score">${totalCorrect}/10 (${overallPercentage}%)</span>
          </div>
        </div>
      </div>

      <div class="qw-topics-compact">
        ${topicsHtml}
      </div>

      <div class="qw-cta-compact">
        <p class="qw-cta-text">${ctaText}</p>
        <a href="${signupUrl}" class="qw-btn-signup-compact">
          <span class="qw-btn-icon">🚀</span>
          Start Targeted Practice
        </a>
        <span class="qw-cta-note">Free • AI adapts to your weak areas</span>
      </div>

      <div class="qw-results-footer">
        <button class="qw-btn-retry-small" id="qw-retry-btn">↻ Retry Quiz</button>
        <span class="qw-disclaimer-inline">Educational purposes only</span>
      </div>
    </div>
  `;
}

  // Render current screen
  function render() {
    let content = '';
    switch (currentScreen) {
      case 'intro':
        content = renderIntro();
        break;
      case 'quiz':
        content = renderQuiz();
        break;
      case 'results':
        content = renderResults();
        break;
    }

    modalRoot.innerHTML = `
      <div class="quiz-widget-overlay" id="qw-overlay">
        <div class="quiz-widget-modal">
          <button class="quiz-widget-close" id="qw-close-btn">×</button>
          ${content}
        </div>
      </div>
    `;
    attachEventListeners();
  }

  // Update only option selection without full re-render
  function updateOptionSelection(letter) {
    const options = document.querySelectorAll('.qw-option');
    options.forEach(option => {
      if (option.dataset.letter === letter) {
        option.classList.add('selected');
      } else {
        option.classList.remove('selected');
      }
    });
    // Enable submit button
    const submitBtn = document.getElementById('qw-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = false;
    }
  }

  // Show feedback without full re-render
  function showFeedbackUI() {
    const question = QUIZ_QUESTIONS[currentQuestionIndex];
    const options = document.querySelectorAll('.qw-option');
    
    // Update option styles
    options.forEach(option => {
      const letter = option.dataset.letter;
      const isCorrect = letter === question.correctAnswer;
      const isSelected = letter === selectedAnswer;
      
      option.disabled = true;
      option.classList.remove('selected');
      
      if (isCorrect) {
        option.classList.add('correct');
        // Add checkmark
        const iconSpan = document.createElement('span');
        iconSpan.className = 'qw-answer-icon checkmark';
        iconSpan.textContent = '✓';
        option.appendChild(iconSpan);
      } else if (isSelected && !isCorrect) {
        option.classList.add('incorrect');
        // Add X mark
        const iconSpan = document.createElement('span');
        iconSpan.className = 'qw-answer-icon x-mark';
        iconSpan.textContent = '✗';
        option.appendChild(iconSpan);
      }
    });
    
    // Add feedback section
    const actionsDiv = document.querySelector('.qw-actions');
    const feedbackHtml = `
      <div class="qw-feedback">
        <div class="qw-feedback-header ${selectedAnswer === question.correctAnswer ? 'correct' : 'incorrect'}">
          <span>${selectedAnswer === question.correctAnswer ? '✓' : '✗'}</span>
          <span>${selectedAnswer === question.correctAnswer ? 'Correct!' : 'Incorrect'}</span>
        </div>
        <div class="qw-rationale">
          <h4>💡 Rationale</h4>
          <div class="qw-rationale-content">
            <span class="qw-rationale-key">${question.rationaleKey}</span>
            <span class="qw-rationale-detail">${question.rationaleDetail}</span>
          </div>
        </div>
      </div>
    `;
    actionsDiv.insertAdjacentHTML('beforebegin', feedbackHtml);
    
    // Replace submit button with next button
    actionsDiv.innerHTML = `<button class="qw-btn-next" id="qw-next-btn">${currentQuestionIndex < QUIZ_QUESTIONS.length - 1 ? 'Next Question →' : 'View Results →'}</button>`;
    
    // Attach next button listener
    document.getElementById('qw-next-btn').addEventListener('click', () => {
      if (currentQuestionIndex < QUIZ_QUESTIONS.length - 1) {
        currentQuestionIndex++;
        selectedAnswer = null;
        showFeedback = false;
        render();
      } else {
        currentScreen = 'results';
        render();
      }
    });
    
    // Update progress bar
    const progressFill = document.querySelector('.qw-progress-fill');
    if (progressFill) {
      const progress = ((currentQuestionIndex + 1) / QUIZ_QUESTIONS.length) * 100;
      progressFill.style.width = progress + '%';
    }
    
    // Scroll to feedback if needed
    const feedback = document.querySelector('.qw-feedback');
    if (feedback) {
      feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Attach event listeners
  function attachEventListeners() {
    // Close button
    const closeBtn = document.getElementById('qw-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeQuiz);
    }

    // Overlay click to close
    const overlay = document.getElementById('qw-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeQuiz();
      });
    }

    // Start button
    const startBtn = document.getElementById('qw-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        currentScreen = 'quiz';
        render();
      });
    }

    // Option buttons - use optimized selection update
    const options = document.querySelectorAll('.qw-option');
    options.forEach(option => {
      option.addEventListener('click', () => {
        if (!showFeedback) {
          selectedAnswer = option.dataset.letter;
          updateOptionSelection(selectedAnswer);
        }
      });
    });
    
    // Submit button - use optimized feedback display
    const submitBtn = document.getElementById('qw-submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        if (selectedAnswer && !showFeedback) {
          const question = QUIZ_QUESTIONS[currentQuestionIndex];
          const isCorrect = selectedAnswer === question.correctAnswer;
          answers.push({
            questionId: question.id,
            selected: selectedAnswer,
            correct: isCorrect,
            topic: question.topic
          });
          showFeedback = true;
          showFeedbackUI();
        }
      });
    }

    // Next button (only attached in initial render, re-attached in showFeedbackUI)
    const nextBtn = document.getElementById('qw-next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentQuestionIndex < QUIZ_QUESTIONS.length - 1) {
          currentQuestionIndex++;
          selectedAnswer = null;
          showFeedback = false;
          render();
        } else {
          currentScreen = 'results';
          render();
        }
      });
    }

    // Retry button
    const retryBtn = document.getElementById('qw-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        currentScreen = 'intro';
        currentQuestionIndex = 0;
        selectedAnswer = null;
        showFeedback = false;
        answers = [];
        render();
      });
    }

    // Escape key
    document.addEventListener('keydown', handleEscape);
  }

  function handleEscape(e) {
    if (e.key === 'Escape') closeQuiz();
  }

  function closeQuiz() {
    const overlay = document.getElementById('qw-overlay');
    if (overlay) {
      overlay.classList.add('closing');
      setTimeout(() => {
        modalRoot.innerHTML = '';
        modalRoot.setAttribute('aria-hidden', 'true');
        document.removeEventListener('keydown', handleEscape);
        // Reset state
        currentScreen = 'intro';
        currentQuestionIndex = 0;
        selectedAnswer = null;
        showFeedback = false;
        answers = [];
      }, 300);
    }
  }

  // Public mount function
  window.NCLEXQuizWidget = {
    mount: function(containerId) {
      modalRoot = document.getElementById(containerId);
      if (modalRoot) {
        injectStyles();
        render();
      }
    }
  };

})();