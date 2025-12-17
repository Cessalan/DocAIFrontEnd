# Mindmap Feature Implementation Plan

## Overview
Add the ability to generate interactive mindmaps from uploaded documents. The mindmap is triggered **through chat conversation** (like quizzes and flashcards) - user types "create a mindmap" and the backend generates it.

---

## Architecture Summary

### Current System
- **Frontend**: React app with components for chat, quiz, flashcards, study sheets
- **Backend**: Separate FastAPI service at `c:\Users\Billion\Desktop\NQBackEnd\NQBackEnd2`
- **Trigger Pattern**: User asks in chat → LLM calls tool → Backend streams status → Frontend renders

### How It Works (Same Pattern as Quiz)
```
User types: "Create a mindmap from my notes"
    → WebSocket sends message to backend
    → LLM detects intent → calls generate_mindmap_stream tool
    → Tool returns: { status: "mindmap_streaming_initiated" }
    → Orchestrator calls stream_mindmap_data()
    → Backend sends: { status: "mindmap_generating", message: "..." }
    → Backend sends: { status: "mindmap_complete", mindmap_data: {...} }
    → Frontend renders ChatMindmap component
```

---

## Implementation Steps

### Phase 1: Frontend - UI Components

#### 1.1 Create MindmapViewer Component
**File**: `src/Components/Mindmap/MindmapViewer.js`

- Interactive node-based visualization using React Flow
- Pan and zoom support
- Click nodes to show summary tooltip
- Color-coded by node type (central/main/sub/detail)

#### 1.2 Create ChatMindmap Component
**File**: `src/Components/ChatInerface/ChatMindmap.js`

- Wrapper component for displaying mindmap in chat messages
- Loading state with animation
- Error handling
- Similar structure to ChatQuiz, ChatFlashcard

#### 1.3 Add Mindmap CSS
**File**: `src/Components/Mindmap/MindmapViewer.css`

- Dark mode support
- Neon glow effects matching existing theme
- Responsive sizing

---

### Phase 2: Frontend - WebSocket/Streaming Integration

#### 2.1 Update WebSocketManager.js
**File**: `src/Services/WebSocketManager.js`

Add handlers around line 260 (after quiz_complete handler):

```javascript
// Handle mindmap generation
else if (data.status === "mindmap_generating") {
  onStatusUpdate({
    status: "mindmap_generating",
    message: data.message
  });
}
else if (data.status === "mindmap_complete") {
  onStatusUpdate({
    status: "mindmap_complete",
    mindmap_data: data.mindmap_data
  });
}
```

---

### Phase 3: Frontend - ChatInterface Integration

#### 3.1 Update ChatInterface.js Status Handler
**File**: `src/Components/ChatInerface/ChatInterface.js`

Add after flashcard handling (around line 1010):

```javascript
// Mindmap generation started
if (statusUpdate.status === "mindmap_generating") {
  console.log("🧠 Mindmap generation started");

  setChatMessages(prev => {
    return prev.map(msg => {
      if (msg.id === streamingMessageId) {
        return {
          ...msg,
          type: 'mindmap',
          content: statusUpdate.message || 'Generating mindmap...',
          mindmapData: null,
          isStreaming: true,
          timestamp: msg.timestamp || new Date()
        };
      }
      return msg;
    });
  });

  setStreamingStatus({
    status: 'generating_mindmap',
    message: statusUpdate.message
  });
  return;
}

// Mindmap complete
if (statusUpdate.status === "mindmap_complete") {
  console.log("✅ Mindmap completed");

  setChatMessages(prev =>
    prev.map(msg => {
      if (msg.id === streamingMessageId && msg.type === 'mindmap') {
        return {
          ...msg,
          mindmapData: statusUpdate.mindmap_data,
          isStreaming: false,
          content: 'Mindmap ready'
        };
      }
      return msg;
    })
  );

  // Save to Firebase
  handleMindmapComplete(statusUpdate.mindmap_data, streamingMessageId, updatedChatId);
  setStreamingStatus(null);
  return;
}
```

#### 3.2 Add handleMindmapComplete Function

```javascript
const handleMindmapComplete = async (mindmapData, messageId, chatId) => {
  try {
    const mindmapMessage = {
      id: messageId,
      role: 'assistant',
      type: 'mindmap',
      mindmapData: mindmapData,
      content: 'Mindmap generated',
      timestamp: new Date()
    };

    await AppendToChat(chatId || currentChatID, mindmapMessage);
  } catch (error) {
    console.error("Error saving mindmap:", error);
  }
};
```

#### 3.3 Update Message Rendering

In the JSX where messages are rendered, add mindmap case:

```javascript
{msg.type === 'mindmap' && (
  <ChatMindmap
    mindmapData={msg.mindmapData}
    isLoading={msg.isStreaming}
    topic={msg.content}
  />
)}
```

---

### Phase 4: Install Dependencies

```bash
npm install reactflow
# or for v12+
npm install @xyflow/react
```

---

## Data Structure

### Mindmap Data from Backend

```json
{
  "central_topic": "Cardiovascular System",
  "nodes": [
    {
      "id": "root",
      "label": "Cardiovascular System",
      "type": "central",
      "children": ["node_1", "node_2"],
      "parent": null,
      "summary": "Study of the heart and blood vessels"
    },
    {
      "id": "node_1",
      "label": "Heart Anatomy",
      "type": "main",
      "children": ["node_1a"],
      "parent": "root",
      "summary": "Structure and chambers of the heart"
    },
    {
      "id": "node_1a",
      "label": "Four Chambers",
      "type": "sub",
      "children": [],
      "parent": "node_1",
      "summary": "Left/right atria and ventricles"
    }
  ],
  "edges": [
    { "source": "root", "target": "node_1" },
    { "source": "node_1", "target": "node_1a" }
  ]
}
```

### React Flow Transformation

The MindmapViewer will transform this data into React Flow format:

```javascript
// Transform nodes
const flowNodes = mindmapData.nodes.map((node, index) => ({
  id: node.id,
  data: {
    label: node.label,
    summary: node.summary,
    type: node.type
  },
  position: calculatePosition(node, index), // Layout algorithm
  type: 'mindmapNode' // Custom node type
}));

// Transform edges
const flowEdges = mindmapData.edges.map(edge => ({
  id: `${edge.source}-${edge.target}`,
  source: edge.source,
  target: edge.target,
  type: 'smoothstep',
  animated: true
}));
```

---

## File Structure (New Files)

```
src/
├── Components/
│   ├── Mindmap/
│   │   ├── MindmapViewer.js      # Main visualization component
│   │   ├── MindmapViewer.css     # Styles
│   │   └── MindmapNode.js        # Custom node component
│   └── ChatInerface/
│       └── ChatMindmap.js        # Chat wrapper component
└── Services/
    └── (modifications only)
```

---

## Modified Files Summary

| File | Changes |
|------|---------|
| `WebSocketManager.js` | Add `mindmap_generating` and `mindmap_complete` handlers |
| `ChatInterface.js` | Add mindmap state handling, render ChatMindmap |
| `package.json` | Add reactflow dependency |

---

## Chat Trigger Examples

Users can trigger mindmap generation by typing:

### English
- "Create a mindmap from my document"
- "Show me a concept map"
- "Visualize the key concepts"
- "Mind map this material"
- "Map out the main topics"

### French
- "Créer une carte mentale"
- "Carte mentale de mes notes"
- "Visualiser les concepts"
- "Schéma conceptuel"

---

## Backend Files (Separate Repo)

Backend implementation is documented in:
`c:\Users\Billion\Desktop\NQBackEnd\NQBackEnd2\BACKEND_REQUIREMENTS_MINDMAP.md`

Files to create/modify:
1. `services/mindmap_generator.py` - NEW: Streaming mindmap generation
2. `tools/quiztools.py` - ADD: `generate_mindmap_stream` tool
3. `services/orchestrator.py` - ADD: Handle mindmap tool calls

---

## UI/UX Considerations

### Visual Design
| Node Type | Size | Color | Description |
|-----------|------|-------|-------------|
| central | Largest | Primary blue | Root node (document title) |
| main | Large | Teal | Primary branches |
| sub | Medium | Light blue | Secondary branches |
| detail | Small | Gray | Tertiary details |

### Interactions
- **Click node**: Show summary tooltip
- **Drag**: Pan the canvas
- **Scroll**: Zoom in/out
- **Hover**: Highlight node

### Loading State
- Show pulsing animation
- Display "Analyzing document structure..." message

---

## Testing Checklist

### Frontend
- [ ] Mindmap triggers from chat message
- [ ] Loading state displays properly
- [ ] Mindmap renders with correct layout
- [ ] Pan and zoom work smoothly
- [ ] Nodes show summaries on click
- [ ] Dark mode styling correct
- [ ] Mindmap saved to Firebase correctly
- [ ] Mindmap loads when reopening chat

### Backend
- [ ] LLM detects mindmap intent
- [ ] Tool returns correct status
- [ ] Streaming sends proper messages
- [ ] Error handling works
- [ ] French language support works

---

## Next Steps

1. **Frontend**: Install React Flow, create components
2. **Backend**: Create mindmap tool and generator
3. **Integration**: Test end-to-end flow
4. **Polish**: Styling, animations, edge cases

---

*Created: 2025-12-16*
*Status: Ready for Implementation*
