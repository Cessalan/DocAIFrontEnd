# Mindmap Feature Implementation Plan

## Overview
Add the ability to generate interactive mindmaps from uploaded documents. This feature will extract key concepts, topics, and their relationships from documents and visualize them as an interactive mindmap.

---

## Architecture Summary

### Current System
- **Frontend**: React app with components for chat, quiz, flashcards, study sheets
- **Backend**: Separate FastAPI service (not in this repo) at `https://ragfastapi-*.run.app`
- **Storage**: Firebase (Firestore + Storage)
- **Pattern**: Upload files → Backend processes → Frontend displays generated content

### Mindmap Flow
```
User uploads document
    → Backend extracts text & embeddings (existing)
    → User clicks "Mindmap" button
    → Frontend calls new /chat/generate-mindmap endpoint
    → Backend extracts concepts & relationships using LLM
    → Frontend renders interactive mindmap
```

---

## Implementation Steps

### Phase 1: Frontend - UI Components

#### 1.1 Create MindmapViewer Component
**File**: `src/Components/Mindmap/MindmapViewer.js`

- Interactive node-based visualization
- Pan and zoom support
- Click nodes to expand/collapse branches
- Color-coded by topic/category
- Export as image option

**Library Recommendation**: [React Flow](https://reactflow.dev/)
- MIT licensed, actively maintained
- Built for React, handles pan/zoom/interactions
- Supports custom node styling
- ~50KB gzipped

Alternative: [D3.js](https://d3js.org/) for more custom control

#### 1.2 Create MindmapNode Component
**File**: `src/Components/Mindmap/MindmapNode.js`

- Custom styled nodes matching app theme
- Hospital/neon glow aesthetic
- Expandable/collapsible
- Shows topic name and optionally key points

#### 1.3 Create ChatMindmap Component
**File**: `src/Components/ChatInerface/ChatMindmap.js`

- Wrapper component for displaying mindmap in chat
- Similar structure to ChatQuiz, ChatFlashcard, ChatStudySheet
- Loading state with animation
- Error handling

#### 1.4 Add Mindmap CSS
**File**: `src/Components/Mindmap/MindmapViewer.css`

- Dark mode support
- Neon glow effects matching existing theme
- Responsive sizing
- Animation for node appearance

---

### Phase 2: Frontend - Integration

#### 2.1 Update PostUploadActions
**File**: `src/Components/ChatInerface/PostUploadActions.js`

Add mindmap action button:
```javascript
actions={[
  { id: 'quiz', label: 'Quiz me', icon: '🧪' },
  { id: 'flashcards', label: 'Create flashcards', icon: '📇' },
  { id: 'studysheet', label: 'Study sheet', icon: '📝' },
  { id: 'mindmap', label: 'Generate mindmap', icon: '🧠' },  // NEW
  { id: 'audio', label: 'Listen', icon: '🎧' }
]}
```

#### 2.2 Update i18n Translations
**File**: `src/i18n/i18n.js`

Add translation keys:
```javascript
postUpload: {
  mindmapLabel: 'Generate mindmap',
  // French
  mindmapLabel: 'Générer une carte mentale'
}
```

#### 2.3 Update ChatInterface Handler
**File**: `src/Components/ChatInerface/ChatInterface.js`

Add handler in `handlePostUploadAction`:
```javascript
case 'mindmap':
  await handleGenerateMindmap(selectedFile);
  break;
```

Add new function `handleGenerateMindmap`:
- Call API
- Show loading state
- Display mindmap component
- Handle errors

#### 2.4 Add State for Mindmap
In ChatInterface.js, add state:
```javascript
const [mindmapData, setMindmapData] = useState(null);
const [isMindmapLoading, setIsMindmapLoading] = useState(false);
```

---

### Phase 3: Frontend - API Service

#### 3.1 Add Mindmap API Function
**File**: `src/Services/FastAPICalls.js`

```javascript
/**
 * Generates a mindmap from uploaded document content
 * @param {string} chat_id - The chat/session ID
 * @param {string} file_name - Name of the uploaded file
 * @param {string} language - Language for labels ('en' or 'fr')
 * @returns {Promise<Object>} Mindmap data structure
 */
export const generate_mindmap = async (chat_id, file_name, language = 'en') => {
  const requestBody = JSON.stringify({
    chat_id: chat_id,
    filename: file_name,
    language: language
  });

  try {
    const response = await fetch(`${FAST_API_BASE}/chat/generate-mindmap`, {
      method: "POST",
      headers: header,
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mindmap generation failed: ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error during mindmap generation:", error);
    throw error;
  }
};
```

---

### Phase 4: Backend - API Endpoint

#### 4.1 Create Mindmap Endpoint
**Endpoint**: `POST /chat/generate-mindmap`

**Request Body**:
```json
{
  "chat_id": "string",
  "filename": "string",
  "language": "en"
}
```

**Response**:
```json
{
  "mindmap": {
    "central_topic": "Document Title/Main Topic",
    "nodes": [
      {
        "id": "node_1",
        "label": "Main Concept 1",
        "type": "main",
        "children": ["node_1a", "node_1b"],
        "summary": "Brief description of this concept"
      },
      {
        "id": "node_1a",
        "label": "Sub-concept 1a",
        "type": "sub",
        "parent": "node_1",
        "children": [],
        "summary": "Details about sub-concept"
      }
    ],
    "edges": [
      { "source": "root", "target": "node_1", "label": "" },
      { "source": "node_1", "target": "node_1a", "label": "includes" }
    ]
  }
}
```

#### 4.2 LLM Prompt for Mindmap Generation

```python
prompt = f"""
Analyze the following document and create a hierarchical mindmap structure.

Instructions:
1. Identify the MAIN TOPIC (central node)
2. Extract 4-8 KEY CONCEPTS as primary branches
3. For each key concept, identify 2-4 SUB-CONCEPTS
4. Keep labels concise (2-5 words)
5. Add brief summaries (1 sentence) for each node
6. Identify relationships between concepts

Document Content:
{document_text}

Return JSON format:
{{
  "central_topic": "Main Document Topic",
  "nodes": [
    {{
      "id": "unique_id",
      "label": "Concept Name",
      "type": "main|sub|detail",
      "children": ["child_id1", "child_id2"],
      "parent": "parent_id or null for main nodes",
      "summary": "One sentence description"
    }}
  ],
  "edges": [
    {{
      "source": "parent_id",
      "target": "child_id",
      "label": "relationship type (optional)"
    }}
  ]
}}
"""
```

---

### Phase 5: Install Dependencies

```bash
npm install reactflow
# or
npm install @xyflow/react  # v12+ (newer naming)
```

---

## Data Structure

### Mindmap Node Schema
```typescript
interface MindmapNode {
  id: string;           // Unique identifier
  label: string;        // Display text (2-5 words)
  type: 'central' | 'main' | 'sub' | 'detail';
  children: string[];   // Array of child node IDs
  parent: string | null;
  summary: string;      // Brief description
  position?: { x: number, y: number };  // For React Flow
}

interface MindmapEdge {
  source: string;       // Parent node ID
  target: string;       // Child node ID
  label?: string;       // Relationship description
}

interface MindmapData {
  central_topic: string;
  nodes: MindmapNode[];
  edges: MindmapEdge[];
}
```

---

## File Structure (New Files)

```
src/
├── Components/
│   ├── Mindmap/
│   │   ├── MindmapViewer.js      # Main visualization component
│   │   ├── MindmapViewer.css     # Styles
│   │   ├── MindmapNode.js        # Custom node component
│   │   └── MindmapNode.css       # Node styles
│   └── ChatInerface/
│       └── ChatMindmap.js        # Chat wrapper component
└── Services/
    └── FastAPICalls.js           # Add generate_mindmap function
```

---

## Modified Files

| File | Changes |
|------|---------|
| `PostUploadActions.js` | Add mindmap action button |
| `ChatInterface.js` | Add mindmap state, handler, and render |
| `FastAPICalls.js` | Add `generate_mindmap` function |
| `i18n.js` | Add translation keys |
| `package.json` | Add reactflow dependency |

---

## UI/UX Considerations

### Mindmap Interactions
- **Click node**: Show summary tooltip
- **Double-click node**: Expand/collapse children
- **Drag**: Pan the canvas
- **Scroll**: Zoom in/out
- **Hover**: Highlight connected nodes

### Visual Design
- Central node: Larger, distinct color (primary blue/teal)
- Main branches: Medium size, category colors
- Sub-concepts: Smaller, lighter shades
- Neon glow on hover (matching app theme)
- Curved edges with optional labels

### Export Options
- Download as PNG
- Copy to clipboard
- Full-screen view mode

---

## Backend Requirements Document

Create file: `BACKEND_REQUIREMENTS_MINDMAP.md`

```markdown
# Backend Requirements for Mindmap Generation

## Endpoint
POST /chat/generate-mindmap

## Request
{
  "chat_id": "string",
  "filename": "string",
  "language": "en" | "fr"
}

## Processing
1. Retrieve document content from vector store using chat_id + filename
2. Send to LLM with mindmap extraction prompt
3. Parse and validate JSON response
4. Return structured mindmap data

## Response Schema
[See data structure above]

## Quality Guidelines
- Central topic should be clear and concise
- 4-8 main branches (not too sparse, not overwhelming)
- 2-4 sub-concepts per main branch
- Labels: 2-5 words maximum
- Summaries: 1 sentence maximum
```

---

## Testing Checklist

- [ ] Mindmap generates for PDF documents
- [ ] Mindmap generates for DOCX documents
- [ ] Mindmap generates for TXT/MD documents
- [ ] French language labels work correctly
- [ ] Loading state displays properly
- [ ] Error handling works (invalid file, API error)
- [ ] Pan and zoom work smoothly
- [ ] Nodes are clickable
- [ ] Export to image works
- [ ] Responsive on mobile
- [ ] Dark mode styling correct
- [ ] Integrates with existing PostUploadActions

---

## Estimated Complexity

| Component | Complexity | Notes |
|-----------|------------|-------|
| MindmapViewer | Medium | React Flow handles most complexity |
| ChatMindmap | Low | Similar to existing chat components |
| API Integration | Low | Same pattern as quiz/flashcards |
| Backend Endpoint | Medium | LLM prompt engineering needed |
| Styling | Medium | Custom theme to match app |

---

## Alternative Approaches Considered

1. **D3.js Force Graph**: More control but higher complexity
2. **Canvas-based**: Better performance but harder to style
3. **SVG Manual**: Full control but significant development time
4. **Mermaid.js**: Simple but less interactive

**Chosen**: React Flow - best balance of features, ease of use, and React integration.

---

## Next Steps

1. Approve this plan
2. Install React Flow dependency
3. Create MindmapViewer component
4. Add API function
5. Integrate into ChatInterface
6. Implement backend endpoint (separate repo)
7. Test and iterate

---

*Created: 2025-12-16*
*Status: Ready for Review*
