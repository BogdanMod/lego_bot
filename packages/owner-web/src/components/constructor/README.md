# Bot Constructor Components

## Architecture

The constructor is built with a modular architecture following Linear/Raycast design principles:

- **Minimalism**: Clean, focused UI with minimal visual noise
- **Clarity**: Clear hierarchy and one focus at a time
- **Speed**: Instant feedback and auto-save

## Components

### `ConstructorLayout.tsx`
Main layout component that orchestrates the three-panel layout:
- Left: States panel
- Center: State editor
- Right: Preview/Graph toggle

### `StatesPanel.tsx`
Compact sidebar showing all bot states with:
- Initial state indicator (🚀)
- Button count per state
- Hover actions (delete)
- Empty state guidance

### `StateEditor.tsx`
Main editing interface with:
- Message textarea
- Drag & drop button reordering
- Button text and target state editing
- Set as initial state action

### `LivePreview.tsx`
Telegram-like preview with:
- Real-time message updates
- Interactive button navigation
- State transition animations
- Auto-reset to initial state

### `GraphView.tsx`
Visual graph visualization using ReactFlow:
- Auto-layout with dagre
- Click nodes to focus states
- Zoom and pan controls
- Mini-map for navigation

## Hooks

### `useAutoSave.ts`
Debounced auto-save (1.5s delay) that saves schema changes automatically.

### `useKeyboardShortcuts.ts`
Keyboard shortcuts:
- `Cmd/Ctrl + S`: Manual save
- `Cmd/Ctrl + K`: Search states (TODO)
- `Escape`: Cancel/close (TODO)

## Features

- ✅ Drag & drop button reordering
- ✅ Auto-save with debounce
- ✅ Live preview with animations
- ✅ Interactive graph visualization
- ✅ Keyboard shortcuts
- ✅ Dark mode support
- ✅ Empty states with guidance
- ✅ Save status indicators

## Styling

Uses Linear-inspired design:
- Thin borders (`border-slate-200`)
- Neutral typography
- Generous spacing
- Focus on actions
- Minimal shadows

