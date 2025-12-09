/**
 * Excalidraw Preview - Read-only preview renderer
 *
 * Renders a static preview of Excalidraw elements using React.
 * Used for inline display in the editor.
 */
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { exportToSvg } from '@excalidraw/excalidraw';
import type { ExcalidrawElement, AppState, BinaryFiles } from './types';

// Store roots for cleanup
const roots = new Map<HTMLElement, Root>();

interface ExcalidrawPreviewProps {
  elements: ExcalidrawElement[];
  nodeId: string;
}

/**
 * Preview component that renders Excalidraw in view mode
 */
function ExcalidrawPreviewComponent({ elements, nodeId }: ExcalidrawPreviewProps) {
  const [svgContent, setSvgContent] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (elements.length === 0) {
      setSvgContent(null);
      return;
    }

    // Export to SVG for lightweight preview
    const generateSvg = async () => {
      try {
        const svg = await exportToSvg({
          elements: elements as readonly ExcalidrawElement[],
          appState: {
            exportWithDarkMode: false,
            exportBackground: true,
            viewBackgroundColor: '#ffffff',
          } as Partial<AppState>,
          files: {} as BinaryFiles,
        });

        // Convert SVG element to string
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svg);
        setSvgContent(svgString);
        setError(null);
      } catch (err) {
        console.error('[ExcalidrawPreview] Failed to generate SVG:', err);
        setError('Failed to render preview');
      }
    };

    generateSvg();
  }, [elements, nodeId]);

  if (error) {
    return (
      <div className="excalidraw-preview-error">
        <span>⚠️ {error}</span>
      </div>
    );
  }

  if (!svgContent) {
    return (
      <div className="excalidraw-preview-empty">
        <span>Empty diagram</span>
      </div>
    );
  }

  return (
    <div
      className="excalidraw-svg-preview"
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}

/**
 * Render Excalidraw preview into a container element
 */
export function renderExcalidrawPreview(
  container: HTMLElement,
  elements: unknown[],
  nodeId: string
): void {
  // Cleanup existing root if any
  const existingRoot = roots.get(container);
  if (existingRoot) {
    existingRoot.unmount();
    roots.delete(container);
  }

  // Create new root and render
  const root = createRoot(container);
  roots.set(container, root);

  root.render(
    <ExcalidrawPreviewComponent
      elements={elements as ExcalidrawElement[]}
      nodeId={nodeId}
    />
  );
}

/**
 * Unmount Excalidraw preview from a container
 */
export function unmountExcalidrawPreview(container: HTMLElement): void {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
}
