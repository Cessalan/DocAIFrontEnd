import React, { useState, useRef, useEffect } from 'react';

import { 
  AppendToChat, 
} from '../../Services/FireBaseServiceChats.js';
import { v4 as uuidv4 } from 'uuid';

// translation
import { useTranslation } from 'react-i18next';

import { 
  generate_study_guide_plan,
  generate_study_guide_section,
  search_for_study_guide
} from '../../Services/FastAPICalls.js';

export default function StudyGuideGenerator({ topic, chatId, numSections }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const iframeRef = useRef(null);
  const htmlRef = useRef('');
  const hasGenerated = useRef(false); // ← Add this
  
  const { t } = useTranslation();

  useEffect(() => {
    // Auto-generate when component mounts
    // Only generate if not already done
    if (!hasGenerated.current) {
      hasGenerated.current = true;
      generateGuide();
    }
  }, []);
  
  async function generateGuide() {
    setLoading(true);
    
    try {
      // STEP 1: Get plan
      console.log('📋 Getting plan...');
      const planRes = await generate_study_guide_plan(topic, chatId, numSections);
 
      const { sections } = planRes;

      setProgress({ current: 0, total: sections.length });
      console.log(`✓ Plan: ${sections.length} sections`);
      
      
      // STEP 2: Build skeleton
      const skeleton = buildSkeleton(sections, topic);
      htmlRef.current = skeleton;
      iframeRef.current.srcdoc = skeleton;
      console.log('✓ Skeleton displayed');
      
      
      // STEP 3: Get RAG context ONCE
      console.log('📚 Retrieving documents...');

      // Call your existing search endpoint or use the search tool
      const searchRes = await search_for_study_guide(topic ,chatId)
      
      const { context } = searchRes;
      console.log('✓ Context retrieved');
      
      
      // STEP 4: Generate each section
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        
        console.log(`🔨 Generating ${i+1}/${sections.length}: ${section.title}`);
        
        const contentRes = await generate_study_guide_section(section.title,topic,chatId,context);
        
        const { content } = contentRes;
        
        if(content){
             // Replace placeholder
            htmlRef.current = htmlRef.current.replace(
            `{{CONTENT_${section.id}}}`,
            content
            );
        
        }
       
        // Update badge
        // Replace entire badge span (more reliable)
        // STEP 2: Replace the badge
        const oldBadge = new RegExp(
        `<span\\s+class="badge\\s+badge-loading"\\s+id="badge-${section.id}">\\s*<span\\s+class="spinner"></span>\\s*</span>`,
        'gs'
        );

        const newBadge = `<span class="badge badge-loaded" id="badge-${section.id}">✓</span>`;
        
        htmlRef.current = htmlRef.current.replace(oldBadge, newBadge);

        // Update iframe
        iframeRef.current.srcdoc = htmlRef.current;
        
        setProgress({ current: i + 1, total: sections.length });
        console.log(`✓ Section ${i+1}/${sections.length} complete`);
      }
      
      console.log('✅ Study guide complete!');

        const studySheetMessage = {
            id: uuidv4(),
            role: "assistant",
            content: `${t("chat.studysheetgenerated")}`,
            // html generate by anthropic to create the study sheet that will be didplayed in an iframe
            html: htmlRef.current, 
            type: "studysheet",
            timestamp: new Date(),
            isStreaming: false
        };
    
        await AppendToChat(chatId, studySheetMessage);
      
    } catch (error) {
      console.error('Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }
  
    
  function buildSkeleton(sections, topic) {
  const sectionsHTML = sections.map(s => `
    <div class="section ${s.color}" id="section-${s.id}">
      <div class="section-header" onclick="toggleSection(this)">
        <div class="section-title">
          <span>${s.title}</span>
        </div>
        <div class="section-badges">
          <span class="badge badge-loading" id="badge-${s.id}">
            <span class="spinner"></span>
               
          </span>
          <span class="chevron">▼</span>
        </div>
      </div>
      <div class="section-content">
        <div id="content-${s.id}">
          {{CONTENT_${s.id}}}
        </div>
      </div>
    </div>
  `).join('');
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body { 
      font-family: system-ui, -apple-system, sans-serif;
      padding: 8px;
      min-height: 100vh;
    }
    
    @media (min-width: 768px) {
      body { padding: 20px; }
    }
    
    .container { 
      max-width: 1000px; 
      margin: 0 auto; 
    }
    
    .header { 
      background: white; 
      padding: 16px;
      border-radius: 12px; 
      margin-bottom: 12px; 
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    
    @media (min-width: 768px) {
      .header { 
        padding: 30px; 
        margin-bottom: 20px; 
      }
    }
    
    .header h1 { 
      color: #667eea; 
      font-size: 1.5rem;
      margin-bottom: 4px;
      word-wrap: break-word;
    }
    
    @media (min-width: 768px) {
      .header h1 { font-size: 2rem; }
    }
    
    .header p {
      color: #64748b;
      font-size: 0.9rem;
    }
    
    .section { 
      background: white; 
      margin: 8px 0;
      border-radius: 8px; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
      overflow: hidden; 
    }
    
    @media (min-width: 768px) {
      .section { 
        margin: 15px 0; 
        border-radius: 12px; 
      }
    }
    
    .section-header { 
      padding: 12px;
      cursor: pointer; 
      display: flex; 
      justify-content: space-between;
      align-items: center;
      background: #f8fafc; 
      border-bottom: 2px solid #e5e7eb;
      gap: 8px;
    }
    
    @media (min-width: 768px) {
      .section-header { padding: 20px; }
    }
    
    .section-header:hover { background: #f1f5f9; }
    
    .section-title { 
      font-size: 1rem;
      font-weight: 700; 
      color: #1e293b;
      flex: 1;
      word-wrap: break-word;
      line-height: 1.3;
    }
    
    @media (min-width: 768px) {
      .section-title { font-size: 1.2rem; }
    }
    
    .section-content { 
      padding: 12px;
      display: none; 
      overflow-x: auto;
    }
    
    @media (min-width: 768px) {
      .section-content { padding: 20px; }
    }
    
    .section.open .section-content { display: block; }
    
    .badge { 
      padding: 4px 8px;
      border-radius: 12px; 
      font-size: 0.75rem;
      font-weight: 600; 
      display: inline-flex; 
      align-items: center; 
      gap: 4px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    
    @media (min-width: 768px) {
      .badge { 
        padding: 6px 12px; 
        font-size: 0.85rem; 
        gap: 6px;
      }
    }
    
    .badge-loading { background: #fef3c7; color: #92400e; }
    .badge-loaded { background: #dcfce7; color: #166534; }
    
    .spinner { 
      width: 10px;
      height: 10px;
      border: 2px solid currentColor; 
      border-top-color: transparent; 
      border-radius: 50%; 
      animation: spin 1s linear infinite; 
    }
    
    @media (min-width: 768px) {
      .spinner { width: 12px; height: 12px; }
    }
    
    @keyframes spin { to { transform: rotate(360deg); } }
    
    .chevron { 
      transition: transform 0.3s;
      font-size: 1rem;
    }
    
    .section.open .chevron { transform: rotate(180deg); }
    
    h3 { 
      color: #667eea; 
      margin: 16px 0 8px;
      font-size: 1.1rem;
      word-wrap: break-word;
    }
    
    @media (min-width: 768px) {
      h3 { 
        margin: 24px 0 12px; 
        font-size: 1.3rem; 
      }
    }
    
    p { 
      margin: 10px 0;
      line-height: 1.6; 
      color: #334155;
      word-wrap: break-word;
    }
    
    @media (min-width: 768px) {
      p { 
        margin: 12px 0; 
        line-height: 1.7; 
      }
    }
    
    ul { margin: 10px 0 10px 20px; }
    
    @media (min-width: 768px) {
      ul { margin: 12px 0 12px 24px; }
    }
    
    li { 
      margin: 6px 0;
      color: #475569;
      line-height: 1.5;
      word-wrap: break-word;
    }
    
    @media (min-width: 768px) {
      li { 
        margin: 8px 0; 
        line-height: 1.6; 
      }
    }
    
    .card { 
      border: 2px solid #e5e7eb; 
      border-radius: 6px;
      padding: 12px;
      margin: 12px 0;
      word-wrap: break-word;
    }
    
    @media (min-width: 768px) {
      .card { 
        border-radius: 8px; 
        padding: 16px; 
        margin: 16px 0; 
      }
    }
    
    .card-blue { background: #eff6ff; border-color: #93c5fd; }
    .card-green { background: #f0fdf4; border-color: #86efac; }
    .card-yellow { background: #fefce8; border-color: #fde047; }
    
    .card-title { 
      font-weight: 700; 
      margin-bottom: 6px;
      color: #1e293b;
      font-size: 0.95rem;
    }
    
    @media (min-width: 768px) {
      .card-title { 
        margin-bottom: 8px; 
        font-size: 1rem;
      }
    }
    
    .highlight { 
      background: #fef08a; 
      padding: 2px 4px;
      border-radius: 3px; 
      font-weight: 600; 
    }
    
    strong { color: #1e293b; font-weight: 700; }
    
    /* Ensure images are responsive */
    img { max-width: 100%; height: auto; }
    
    /* Prevent horizontal scroll on small screens */
    .section-content * {
      max-width: 100%;
      overflow-wrap: break-word;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${topic}</h1>
    </div>
    ${sectionsHTML}
  </div>
  <script>
    function toggleSection(header) {
      header.parentElement.classList.toggle('open');
    }
    document.querySelector('.section')?.classList.add('open');
  </script>
</body>
</html>
`;
}
  return (
    <div style={{ padding: '20px' }}>
      {progress.total > 0 && (
        <div style={{
          background: 'white',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontWeight: '600' }}>Progress</span>
            <span>{progress.current}/{progress.total} sections</span>
          </div>
          <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              width: `${(progress.current / progress.total) * 100}%`,
              height: '100%',
              background: 'linear-gradient(to right, #667eea, #764ba2)',
              transition: 'width 0.3s'
            }} />
          </div>
        </div>
      )}
      
      <iframe
        ref={iframeRef}
        style={{
          width: '100%',
          height: '600px',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          background: 'white'
        }}
        title="Study Guide"
      />
    </div>
  );
}