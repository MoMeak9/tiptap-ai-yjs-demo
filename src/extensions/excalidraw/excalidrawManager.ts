/**
 * ExcalidrawManager - Yjs Sync Manager for Excalidraw
 *
 * Manages real-time collaboration for Excalidraw diagrams using Yjs.
 * Handles element synchronization, cursor presence, and conflict resolution.
 */
import * as Y from 'yjs';
import type { WebsocketProvider } from 'y-websocket';
import type {
  ExcalidrawElement,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  Collaborator,
  ExcalidrawManagerOptions,
  ExcalidrawCollaborator,
} from './types';

// Throttle helper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): T {
  let lastCall = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    const now = Date.now();
    const remaining = limit - (now - lastCall);

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      lastCall = now;
      func(...args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        lastCall = Date.now();
        timeout = null;
        func(...args);
      }, remaining);
    }
  }) as T;
}

interface EditorRegistration {
  api: ExcalidrawImperativeAPI;
  isRemoteUpdateRef: React.MutableRefObject<boolean>;
}

export class ExcalidrawManager {
  private ydoc: Y.Doc;
  private provider: WebsocketProvider;
  private options: Required<ExcalidrawManagerOptions>;

  // Map of nodeId -> Y.Array for elements
  private elementsArrays: Map<string, Y.Array<unknown>> = new Map();

  // Map of nodeId -> Y.Map for files
  private filesMaps: Map<string, Y.Map<unknown>> = new Map();

  // Registered editors
  private editors: Map<string, EditorRegistration> = new Map();

  // Collaborator change listeners
  private collaboratorListeners: Map<string, Set<(collaborators: Map<string, Collaborator>) => void>> = new Map();

  // Throttled sync function
  private throttledSync: (nodeId: string, elements: ExcalidrawElement[], files: BinaryFiles) => void;

  // Current user info
  private currentUser: { name: string; color: string } | null = null;

  constructor(
    ydoc: Y.Doc,
    provider: WebsocketProvider,
    options: ExcalidrawManagerOptions = {}
  ) {
    this.ydoc = ydoc;
    this.provider = provider;
    this.options = {
      syncDebounceMs: options.syncDebounceMs ?? 100,
      enableCursorSync: options.enableCursorSync ?? true,
    };

    // Create throttled sync function
    this.throttledSync = throttle(
      this.syncToYjs.bind(this),
      this.options.syncDebounceMs
    );

    // Listen for awareness changes
    if (this.options.enableCursorSync) {
      this.provider.awareness.on('change', this.handleAwarenessChange);
    }
  }

  /**
   * Set current user info for presence
   */
  setCurrentUser(user: { name: string; color: string }) {
    this.currentUser = user;
  }

  /**
   * Get or create Y.Array for a node's elements
   */
  private getElementsArray(nodeId: string): Y.Array<unknown> {
    let arr = this.elementsArrays.get(nodeId);
    if (!arr) {
      arr = this.ydoc.getArray(`excalidraw-elements-${nodeId}`);
      this.elementsArrays.set(nodeId, arr);
    }
    return arr;
  }

  /**
   * Get or create Y.Map for a node's files
   */
  private getFilesMap(nodeId: string): Y.Map<unknown> {
    let map = this.filesMaps.get(nodeId);
    if (!map) {
      map = this.ydoc.getMap(`excalidraw-files-${nodeId}`);
      this.filesMaps.set(nodeId, map);
    }
    return map;
  }

  /**
   * Register an Excalidraw editor instance
   */
  registerEditor(
    nodeId: string,
    api: ExcalidrawImperativeAPI,
    isRemoteUpdateRef: React.MutableRefObject<boolean>
  ) {
    this.editors.set(nodeId, { api, isRemoteUpdateRef });

    // Set up observer for this node
    const elementsArray = this.getElementsArray(nodeId);
    const filesMap = this.getFilesMap(nodeId);

    // Observe element changes
    const elementsObserver = () => {
      this.handleRemoteElementsChange(nodeId);
    };
    elementsArray.observe(elementsObserver);

    // Observe file changes
    const filesObserver = () => {
      this.handleRemoteFilesChange(nodeId);
    };
    filesMap.observe(filesObserver);

    // Load initial data if exists
    if (elementsArray.length > 0) {
      this.handleRemoteElementsChange(nodeId);
    }

    console.log(`[ExcalidrawManager] Registered editor for node: ${nodeId}`);
  }

  /**
   * Unregister an Excalidraw editor instance
   */
  unregisterEditor(nodeId: string) {
    this.editors.delete(nodeId);
    this.collaboratorListeners.delete(nodeId);

    // Clear awareness state for this node
    const currentState = this.provider.awareness.getLocalState();
    if (currentState?.excalidraw?.nodeId === nodeId) {
      this.provider.awareness.setLocalStateField('excalidraw', null);
    }

    console.log(`[ExcalidrawManager] Unregistered editor for node: ${nodeId}`);
  }

  /**
   * Handle local element changes from Excalidraw
   */
  handleLocalChange(nodeId: string, elements: ExcalidrawElement[], files: BinaryFiles) {
    // Use throttled sync
    this.throttledSync(nodeId, elements, files);
  }

  /**
   * Sync local changes to Yjs
   */
  private syncToYjs(nodeId: string, elements: ExcalidrawElement[], files: BinaryFiles) {
    const elementsArray = this.getElementsArray(nodeId);
    const filesMap = this.getFilesMap(nodeId);

    this.ydoc.transact(() => {
      // Clear and replace elements (simple strategy)
      // For production, implement diff-based updates
      elementsArray.delete(0, elementsArray.length);
      elements.forEach((el) => {
        elementsArray.push([{ ...el }]);
      });

      // Update files
      Object.entries(files).forEach(([id, file]) => {
        filesMap.set(id, file);
      });
    }, this);

    console.log(`[ExcalidrawManager] Synced ${elements.length} elements to Yjs for node: ${nodeId}`);
  }

  /**
   * Handle remote element changes from Yjs
   */
  private handleRemoteElementsChange(nodeId: string) {
    const editor = this.editors.get(nodeId);
    if (!editor) return;

    const elementsArray = this.getElementsArray(nodeId);
    const elements = elementsArray.toArray() as ExcalidrawElement[];

    // Set flag to prevent loop
    editor.isRemoteUpdateRef.current = true;

    try {
      editor.api.updateScene({
        elements,
      });
    } finally {
      // Reset flag after React has processed the update
      requestAnimationFrame(() => {
        editor.isRemoteUpdateRef.current = false;
      });
    }

    console.log(`[ExcalidrawManager] Applied ${elements.length} remote elements for node: ${nodeId}`);
  }

  /**
   * Handle remote file changes from Yjs
   */
  private handleRemoteFilesChange(nodeId: string) {
    const editor = this.editors.get(nodeId);
    if (!editor) return;

    const filesMap = this.getFilesMap(nodeId);
    const files: BinaryFiles = {};

    filesMap.forEach((value, key) => {
      files[key] = value as BinaryFiles[string];
    });

    // Note: Excalidraw API doesn't have a direct way to update files
    // Files are typically included in updateScene or managed separately
    console.log(`[ExcalidrawManager] Received ${Object.keys(files).length} remote files for node: ${nodeId}`);
  }

  /**
   * Update pointer position for cursor sync
   */
  updatePointer(nodeId: string, pointer: { x: number; y: number }) {
    if (!this.options.enableCursorSync || !this.currentUser) return;

    this.provider.awareness.setLocalStateField('excalidraw', {
      nodeId,
      pointer,
      selectedElementIds: [],
      user: this.currentUser,
    } as ExcalidrawCollaborator);
  }

  /**
   * Handle awareness changes for collaborator updates
   */
  private handleAwarenessChange = () => {
    // Group collaborators by nodeId
    const collaboratorsByNode = new Map<string, Map<string, Collaborator>>();

    this.provider.awareness.getStates().forEach((state, clientId) => {
      const excalidrawState = state.excalidraw as ExcalidrawCollaborator | undefined;
      if (!excalidrawState?.nodeId) return;

      // Skip self
      if (clientId === this.provider.awareness.clientID) return;

      let nodeCollaborators = collaboratorsByNode.get(excalidrawState.nodeId);
      if (!nodeCollaborators) {
        nodeCollaborators = new Map();
        collaboratorsByNode.set(excalidrawState.nodeId, nodeCollaborators);
      }

      nodeCollaborators.set(String(clientId), {
        pointer: excalidrawState.pointer || undefined,
        username: excalidrawState.user?.name,
        color: { background: excalidrawState.user?.color || '#000', stroke: excalidrawState.user?.color || '#000' },
        selectedElementIds: excalidrawState.selectedElementIds || [],
        isCurrentUser: false,
        avatarUrl: undefined,
        id: String(clientId),
        userState: 'active',
        socket: null,
      } as unknown as Collaborator);
    });

    // Notify listeners
    collaboratorsByNode.forEach((collaborators, nodeId) => {
      const listeners = this.collaboratorListeners.get(nodeId);
      if (listeners) {
        listeners.forEach((listener) => listener(collaborators));
      }
    });
  };

  /**
   * Subscribe to collaborator changes for a node
   */
  onCollaboratorsChange(
    nodeId: string,
    callback: (collaborators: Map<string, Collaborator>) => void
  ): () => void {
    let listeners = this.collaboratorListeners.get(nodeId);
    if (!listeners) {
      listeners = new Set();
      this.collaboratorListeners.set(nodeId, listeners);
    }
    listeners.add(callback);

    // Return unsubscribe function
    return () => {
      listeners?.delete(callback);
    };
  }

  /**
   * Get current collaborators for a node
   */
  getCollaborators(nodeId: string): Map<string, Collaborator> {
    const collaborators = new Map<string, Collaborator>();

    this.provider.awareness.getStates().forEach((state, clientId) => {
      const excalidrawState = state.excalidraw as ExcalidrawCollaborator | undefined;
      if (!excalidrawState?.nodeId || excalidrawState.nodeId !== nodeId) return;
      if (clientId === this.provider.awareness.clientID) return;

      collaborators.set(String(clientId), {
        pointer: excalidrawState.pointer || undefined,
        username: excalidrawState.user?.name,
        color: { background: excalidrawState.user?.color || '#000', stroke: excalidrawState.user?.color || '#000' },
        selectedElementIds: excalidrawState.selectedElementIds || [],
        isCurrentUser: false,
        avatarUrl: undefined,
        id: String(clientId),
        userState: 'active',
        socket: null,
      } as unknown as Collaborator);
    });

    return collaborators;
  }

  /**
   * Initialize elements for a new node (from initial data)
   */
  initializeNode(nodeId: string, elements: ExcalidrawElement[], files: BinaryFiles) {
    const elementsArray = this.getElementsArray(nodeId);
    const filesMap = this.getFilesMap(nodeId);

    // Only initialize if empty
    if (elementsArray.length === 0 && elements.length > 0) {
      this.ydoc.transact(() => {
        elements.forEach((el) => {
          elementsArray.push([{ ...el }]);
        });

        Object.entries(files).forEach(([id, file]) => {
          filesMap.set(id, file);
        });
      });

      console.log(`[ExcalidrawManager] Initialized node ${nodeId} with ${elements.length} elements`);
    }
  }

  /**
   * Get elements from Yjs for a node
   */
  getElements(nodeId: string): ExcalidrawElement[] {
    const elementsArray = this.getElementsArray(nodeId);
    return elementsArray.toArray() as ExcalidrawElement[];
  }

  /**
   * Get files from Yjs for a node
   */
  getFiles(nodeId: string): BinaryFiles {
    const filesMap = this.getFilesMap(nodeId);
    const files: BinaryFiles = {};

    filesMap.forEach((value, key) => {
      files[key] = value as BinaryFiles[string];
    });

    return files;
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.options.enableCursorSync) {
      this.provider.awareness.off('change', this.handleAwarenessChange);
    }

    this.editors.clear();
    this.elementsArrays.clear();
    this.filesMaps.clear();
    this.collaboratorListeners.clear();

    console.log('[ExcalidrawManager] Destroyed');
  }
}

export default ExcalidrawManager;
