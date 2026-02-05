/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { FunctionCall, useSettings, useUI, useTools } from '@/lib/state';
import c from 'classnames';
import { DEFAULT_LIVE_API_MODEL, AVAILABLE_VOICES, ENGINE_DISPLAY_NAME } from '@/lib/constants';
import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { useState } from 'react';
import ToolEditorModal from './ToolEditorModal';

const AVAILABLE_MODELS = [
  DEFAULT_LIVE_API_MODEL
];

export default function Sidebar() {
  const { isSidebarOpen, toggleSidebar } = useUI();
  const { systemPrompt, model, voice, setSystemPrompt, setModel, setVoice } =
    useSettings();
  const { tools, toggleTool, addTool, removeTool, updateTool } = useTools();
  const { connected } = useLiveAPIContext();

  const [editingTool, setEditingTool] = useState<FunctionCall | null>(null);

  const handleSaveTool = (updatedTool: FunctionCall) => {
    if (editingTool) {
      updateTool(editingTool.name, updatedTool);
    }
    setEditingTool(null);
  };

  return (
    <>
      <aside className={c('sidebar', { open: isSidebarOpen })}>
        <div className="sidebar-header">
          <div className="sidebar-title-group">
            <span className="material-symbols-outlined header-icon">settings</span>
            <h3>Settings</h3>
          </div>
          <button onClick={toggleSidebar} className="close-button" aria-label="Close settings">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="sidebar-content">
          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Configuration</h4>
            <fieldset disabled={connected} className="settings-fieldset">
              <div className="setting-groups">
                <div className="setting-item">
                  <label htmlFor="system-mode" className="setting-label">
                    System Mode
                  </label>
                  <select
                    id="system-mode"
                    value={useTools.getState().template}
                    onChange={e => useTools.getState().setTemplate(e.target.value as any)}
                    className="modern-select"
                  >
                    <option value="orbit-agent">Orbit Agent</option>
                    <option value="beatrice">Beatrice</option>
                    <option value="customer-support">Customer Support</option>
                    <option value="personal-assistant">Personal Assistant</option>
                    <option value="navigation-system">Navigation System</option>
                  </select>
                  <p className="setting-description">Select the operative mode and toolset.</p>
                </div>

                <div className="setting-item">
                  <label htmlFor="system-prompt" className="setting-label">
                    System Prompt
                  </label>
                  <textarea
                    id="system-prompt"
                    value={systemPrompt}
                    onChange={e => setSystemPrompt(e.target.value)}
                    rows={6}
                    className="modern-textarea"
                    placeholder="Describe the role and personality of the AI..."
                  />
                  <p className="setting-description">Defines the AI's persona and instructions.</p>
                </div>

                <div className="setting-row">
                  <div className="setting-item">
                    <label htmlFor="model-select" className="setting-label">
                      Model
                    </label>
                    <select
                      id="model-select"
                      value={model}
                      onChange={e => setModel(e.target.value)}
                      className="modern-select"
                    >
                      {AVAILABLE_MODELS.map(m => (
                        <option key={m} value={m}>
                          {m === DEFAULT_LIVE_API_MODEL ? ENGINE_DISPLAY_NAME : m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="setting-item">
                    <label htmlFor="voice-select" className="setting-label">
                      Voice
                    </label>
                    <select
                      id="voice-select"
                      value={voice}
                      onChange={e => setVoice(e.target.value)}
                      className="modern-select"
                    >
                      {AVAILABLE_VOICES.map(v => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </fieldset>
          </div>

          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Active Tools</h4>
            <div className="tools-list">
              {tools.length === 0 && (
                <div className="no-tools-info">No tools configured</div>
              )}
              {tools.map(tool => (
                <div key={tool.name} className="tool-card">
                  <div className="tool-info">
                    <label className="tool-checkbox-wrapper">
                      <input
                        type="checkbox"
                        id={`tool-checkbox-${tool.name}`}
                        checked={tool.isEnabled}
                        onChange={() => toggleTool(tool.name)}
                        disabled={connected}
                      />
                      <span className="checkbox-visual"></span>
                    </label>
                    <div className="tool-meta">
                      <label
                        htmlFor={`tool-checkbox-${tool.name}`}
                        className="tool-name-text"
                      >
                        {tool.name}
                      </label>
                      <span className="tool-type">Function Call</span>
                    </div>
                  </div>
                  <div className="tool-actions">
                    <button
                      className="tool-action-btn edit"
                      onClick={() => setEditingTool(tool)}
                      disabled={connected}
                      aria-label={`Edit ${tool.name}`}
                    >
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                    <button
                      className="tool-action-btn delete"
                      onClick={() => removeTool(tool.name)}
                      disabled={connected}
                      aria-label={`Delete ${tool.name}`}
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={addTool}
              className="add-tool-button"
              disabled={connected}
            >
              <span className="material-symbols-outlined">add</span>
              <span>Add Function</span>
            </button>
          </div>

          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Web Utility</h4>
            <div className="web-utility-item">
              <input
                type="text"
                placeholder="https://example.com"
                className="web-url-input"
                id="web-view-url-input"
              />
              <button
                className="web-init-button"
                onClick={() => {
                  const input = document.getElementById('web-view-url-input') as HTMLInputElement;
                  if (input && input.value) {
                    useUI.getState().setWebView(true, input.value);
                  }
                }}
              >
                <span className="material-symbols-outlined">launch</span>
                INITIALIZE OVERRIDE
              </button>
            </div>
            <p className="setting-description web-utility-desc">
              Embed external intelligence modules directly into the console.
            </p>
          </div>
        </div>
      </aside>
      {editingTool && (
        <ToolEditorModal
          tool={editingTool}
          onClose={() => setEditingTool(null)}
          onSave={handleSaveTool}
        />
      )}
    </>
  );
}
