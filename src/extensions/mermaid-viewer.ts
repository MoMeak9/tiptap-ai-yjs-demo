/**
 * Mermaid Viewer - Lit Web Component
 *
 * A framework-agnostic Web Component for rendering Mermaid diagrams.
 * Uses Light DOM for SVG marker compatibility.
 *
 * @example
 * <mermaid-viewer code="graph TD; A-->B"></mermaid-viewer>
 */
import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { Task } from '@lit/task';
import DOMPurify from 'dompurify';
import mermaid from 'mermaid';

@customElement('mermaid-viewer')
export class MermaidViewer extends LitElement {
  /**
   * Mermaid diagram source code
   */
  @property({ type: String })
  code: string = '';

  /**
   * Whether the component is selected in the editor
   */
  @property({ type: Boolean, reflect: true })
  selected: boolean = false;

  /**
   * Internal render counter for unique IDs
   */
  @state()
  private _renderId: number = 0;

  /**
   * Use Light DOM to avoid SVG marker reference issues
   * See: https://github.com/mermaid-js/mermaid/issues/1766
   */
  protected createRenderRoot() {
    return this;
  }

  /**
   * Async rendering task with automatic race condition handling
   */
  private _renderTask = new Task(this, {
    task: async ([code]) => {
      // Skip empty code
      if (!code || !code.trim()) {
        return '';
      }

      // Generate unique ID for this render
      const id = `mermaid-${Date.now()}-${++this._renderId}`;

      try {
        // Mermaid v10+ async render API
        const { svg } = await mermaid.render(id, code);

        // Sanitize SVG to prevent XSS attacks
        const cleanSvg = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true, svgFilters: true },
          ADD_TAGS: ['foreignObject'],
          ADD_ATTR: ['target', 'class', 'id', 'marker-end', 'marker-start'],
        });

        return cleanSvg;
      } catch (error: any) {
        // Extract meaningful error message
        const message = error?.message || error?.str || 'Unknown Mermaid syntax error';
        throw new Error(message);
      }
    },
    args: () => [this.code] as const,
  });

  render() {
    return this._renderTask.render({
      // Initial/empty state
      initial: () => html`
        <div class="mermaid-placeholder">
          <span class="mermaid-placeholder-icon">📊</span>
          <span class="mermaid-placeholder-text">Double-click to add diagram</span>
        </div>
      `,

      // Loading state
      pending: () => html`
        <div class="mermaid-loading">
          <span class="mermaid-spinner"></span>
          <span>Rendering diagram...</span>
        </div>
      `,

      // Success state - inject sanitized SVG
      complete: (svgContent) => {
        if (!svgContent) {
          return html`
            <div class="mermaid-placeholder">
              <span class="mermaid-placeholder-icon">📊</span>
              <span class="mermaid-placeholder-text">Double-click to add diagram</span>
            </div>
          `;
        }
        return html`
          <div class="mermaid-container">
            ${unsafeSVG(svgContent)}
          </div>
        `;
      },

      // Error state - show friendly error message
      error: (e: any) => html`
        <div class="mermaid-error">
          <div class="mermaid-error-header">
            <span class="mermaid-error-icon">⚠️</span>
            <span>Diagram Syntax Error</span>
          </div>
          <pre class="mermaid-error-message">${e.message}</pre>
          <div class="mermaid-error-hint">Double-click to edit the diagram code</div>
        </div>
      `,
    });
  }
}

// Type declaration for custom element
declare global {
  interface HTMLElementTagNameMap {
    'mermaid-viewer': MermaidViewer;
  }
}

export default MermaidViewer;
