/**
 * ExcalidrawModal - Modal container for Excalidraw editor
 *
 * Provides a full-screen modal experience for editing Excalidraw diagrams.
 * Integrates with ExcalidrawManager for real-time collaboration.
 */
import { useState, useEffect, useCallback } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ExcalidrawEditor } from './ExcalidrawEditor';
import type { ExcalidrawManager } from './excalidrawManager';
import type { ExcalidrawElement, BinaryFiles, OpenExcalidrawEditorDetail } from './types';

interface ModalState {
  isOpen: boolean;
  nodeId: string;
  elements: ExcalidrawElement[];
  files: BinaryFiles;
  onSave: ((elements: ExcalidrawElement[], files: BinaryFiles) => void) | null;
  onCancel: (() => void) | null;
}

interface ExcalidrawModalProps {
  manager: ExcalidrawManager | null;
  isCollaborating: boolean;
}

function ExcalidrawModalComponent({ manager, isCollaborating }: ExcalidrawModalProps) {
  const [state, setState] = useState<ModalState>({
    isOpen: false,
    nodeId: '',
    elements: [],
    files: {},
    onSave: null,
    onCancel: null,
  });

  // Listen for open-excalidraw-editor events
  useEffect(() => {
    const handleOpenEditor = (event: Event) => {
      const customEvent = event as CustomEvent<OpenExcalidrawEditorDetail>;
      const { nodeId, elements, files, onSave, onCancel } = customEvent.detail;

      setState({
        isOpen: true,
        nodeId,
        elements,
        files,
        onSave,
        onCancel,
      });
    };

    document.addEventListener('open-excalidraw-editor', handleOpenEditor);

    return () => {
      document.removeEventListener('open-excalidraw-editor', handleOpenEditor);
    };
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state.isOpen) return;

      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }

      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Save is handled by the editor component
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.isOpen]);

  const handleSave = useCallback(
    (elements: ExcalidrawElement[], files: BinaryFiles) => {
      if (state.onSave) {
        state.onSave(elements, files);
      }
      setState((prev) => ({ ...prev, isOpen: false }));
    },
    [state.onSave]
  );

  const handleCancel = useCallback(() => {
    if (state.onCancel) {
      state.onCancel();
    }
    setState((prev) => ({ ...prev, isOpen: false }));
  }, [state.onCancel]);

  if (!state.isOpen) {
    return null;
  }

  return (
    <div className="excalidraw-modal-overlay" onClick={handleCancel}>
      <div className="excalidraw-modal" onClick={(e) => e.stopPropagation()}>
        <ExcalidrawEditor
          nodeId={state.nodeId}
          initialElements={state.elements}
          initialFiles={state.files}
          manager={manager}
          onSave={handleSave}
          onCancel={handleCancel}
          isCollaborating={isCollaborating}
        />
      </div>
    </div>
  );
}

// Modal management
let modalRoot: Root | null = null;
let modalContainer: HTMLElement | null = null;

export interface ExcalidrawModalInstance {
  updateProps: (props: Partial<ExcalidrawModalProps>) => void;
  destroy: () => void;
}

/**
 * Initialize the Excalidraw modal
 */
export function initExcalidrawModal(
  manager: ExcalidrawManager | null = null,
  isCollaborating = false
): ExcalidrawModalInstance {
  // Create container if not exists
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'excalidraw-modal-root';
    document.body.appendChild(modalContainer);
  }

  // Create root if not exists
  if (!modalRoot) {
    modalRoot = createRoot(modalContainer);
  }

  // Current props
  let currentProps: ExcalidrawModalProps = { manager, isCollaborating };

  // Render
  const render = () => {
    modalRoot?.render(<ExcalidrawModalComponent {...currentProps} />);
  };

  render();

  return {
    updateProps: (props: Partial<ExcalidrawModalProps>) => {
      currentProps = { ...currentProps, ...props };
      render();
    },
    destroy: () => {
      if (modalRoot) {
        modalRoot.unmount();
        modalRoot = null;
      }
      if (modalContainer) {
        modalContainer.remove();
        modalContainer = null;
      }
    },
  };
}

/**
 * Get the modal instance (for updating props)
 */
export function getExcalidrawModal(): ExcalidrawModalInstance | null {
  if (!modalRoot) return null;

  return {
    updateProps: () => {
      console.warn('Use the instance returned from initExcalidrawModal to update props');
    },
    destroy: () => {
      if (modalRoot) {
        modalRoot.unmount();
        modalRoot = null;
      }
      if (modalContainer) {
        modalContainer.remove();
        modalContainer = null;
      }
    },
  };
}
