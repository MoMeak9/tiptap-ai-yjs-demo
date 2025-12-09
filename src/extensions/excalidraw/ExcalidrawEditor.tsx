/**
 * ExcalidrawEditor - Full-featured Excalidraw editor component
 *
 * Used in the modal for editing diagrams with real-time collaboration support.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Excalidraw, MainMenu, WelcomeScreen } from '@excalidraw/excalidraw';
import type { ExcalidrawManager } from './excalidrawManager';
import type {
  ExcalidrawElement,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  Collaborator,
} from './types';

export interface ExcalidrawEditorProps {
  nodeId: string;
  initialElements: ExcalidrawElement[];
  initialFiles: BinaryFiles;
  manager: ExcalidrawManager | null;
  onSave: (elements: ExcalidrawElement[], files: BinaryFiles) => void;
  onCancel: () => void;
  isCollaborating?: boolean;
}

export function ExcalidrawEditor({
  nodeId,
  initialElements,
  initialFiles,
  manager,
  onSave,
  onCancel,
  isCollaborating = false,
}: ExcalidrawEditorProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [collaborators, setCollaborators] = useState<Map<string, Collaborator>>(new Map());
  const isRemoteUpdateRef = useRef(false);
  const lastLocalElementsRef = useRef<string>('');

  // Initialize manager connection when API is ready
  useEffect(() => {
    if (!excalidrawAPI || !manager) return;

    // Register this editor with the manager
    manager.registerEditor(nodeId, excalidrawAPI, isRemoteUpdateRef);

    // Cleanup on unmount
    return () => {
      manager.unregisterEditor(nodeId);
    };
  }, [excalidrawAPI, manager, nodeId]);

  // Subscribe to collaborator updates
  useEffect(() => {
    if (!manager || !isCollaborating) return;

    const unsubscribe = manager.onCollaboratorsChange(nodeId, (newCollaborators) => {
      setCollaborators(newCollaborators);
    });

    return unsubscribe;
  }, [manager, nodeId, isCollaborating]);

  // Handle local changes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], _appState: any, files: BinaryFiles) => {
      // Skip if this change was triggered by a remote update
      if (isRemoteUpdateRef.current) {
        return;
      }

      // Dedupe: only sync if elements actually changed
      const elementsJson = JSON.stringify(elements);
      if (elementsJson === lastLocalElementsRef.current) {
        return;
      }
      lastLocalElementsRef.current = elementsJson;

      // Sync to Yjs if manager is available
      if (manager && isCollaborating) {
        manager.handleLocalChange(nodeId, elements as ExcalidrawElement[], files);
      }
    },
    [manager, nodeId, isCollaborating]
  );

  // Handle pointer updates for cursor sync
  const handlePointerUpdate = useCallback(
    (payload: { pointer: { x: number; y: number }; button: string }) => {
      if (manager && isCollaborating) {
        manager.updatePointer(nodeId, payload.pointer);
      }
    },
    [manager, nodeId, isCollaborating]
  );

  // Handle save
  const handleSave = useCallback(() => {
    if (!excalidrawAPI) return;

    const elements = excalidrawAPI.getSceneElements();
    const files = excalidrawAPI.getFiles();

    onSave([...elements], { ...files });
  }, [excalidrawAPI, onSave]);

  return (
    <div className="excalidraw-editor-container">
      <div className="excalidraw-editor-toolbar">
        <button className="excalidraw-btn excalidraw-btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="excalidraw-btn excalidraw-btn-primary" onClick={handleSave}>
          Save
        </button>
        {isCollaborating && (
          <span className="excalidraw-collab-indicator">
            🟢 Collaborating ({collaborators.size + 1} users)
          </span>
        )}
      </div>
      <div className="excalidraw-editor-canvas">
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          initialData={{
            elements: initialElements,
            appState: {
              viewBackgroundColor: '#ffffff',
            },
            files: initialFiles,
          }}
          onChange={handleChange}
          onPointerUpdate={handlePointerUpdate}
          isCollaborating={isCollaborating}
          UIOptions={{
            canvasActions: {
              saveAsImage: true,
              loadScene: false,
              export: { saveFileToDisk: true },
            },
          }}
        >
          <MainMenu>
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.DefaultItems.Export />
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.DefaultItems.ToggleTheme />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
          </MainMenu>
          <WelcomeScreen>
            <WelcomeScreen.Hints.ToolbarHint />
            <WelcomeScreen.Hints.MenuHint />
            <WelcomeScreen.Hints.HelpHint />
          </WelcomeScreen>
        </Excalidraw>
      </div>
    </div>
  );
}

export default ExcalidrawEditor;
