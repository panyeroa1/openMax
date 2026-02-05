
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState, useRef } from 'react';
import { useDashboard, useTools } from '@/lib/state';
import { useLiveAPIContext } from '@/contexts/LiveAPIContext';

const ResourceBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="resource-item">
    <div className="resource-info">
      <span className="resource-label">{label}</span>
      <span className="resource-value">{value}%</span>
    </div>
    <div className="resource-track">
      <div
        className="resource-fill"
        style={{
          width: `${value}%`,
          backgroundColor: color,
          boxShadow: `0 0 8px ${color}`
        } as React.CSSProperties}
      />
    </div>
  </div>
);

const ServiceStatus = ({ label, status, pid }: { label: string; status: boolean | 'running' | 'stopped' | 'error'; pid?: number | null }) => (
  <div className="service-status-pill">
    <span className={`status-indicator ${status === 'running' || status === true ? 'active' : 'inactive'}`}></span>
    <div className="service-details">
      <span className="service-label">{label}</span>
      {pid && <span className="service-pid">PID: {pid}</span>}
    </div>
  </div>
);

export default function OrbitDashboard() {
  const { stats } = useDashboard();
  const { template } = useTools();
  const { connected, client } = useLiveAPIContext();

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!connected || template !== 'orbit-agent') return;

    // Trigger initial stats update via LLM
    client.send([{ text: "Request system stats for dashboard" }], false);

    const interval = setInterval(() => {
      // Silently poll for updates through the model's tool use
      client.send([{ text: "Silent background update of get_system_stats" }], false);
    }, 15000);

    return () => clearInterval(interval);
  }, [connected, template, client]);

  const handleSendMessage = () => {
    if (!inputText.trim() || !connected || isSending) return;

    setIsSending(true);
    client.send([{ text: inputText }], true);
    setInputText('');

    // Reset sending state after a short delay
    setTimeout(() => setIsSending(false), 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !connected) return;

    setIsSending(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      client.send([
        { inlineData: { mimeType: file.type, data: base64 } },
        { text: `Uploaded file: ${file.name}` }
      ], true);
      setIsSending(false);
    };
    reader.onerror = () => {
      setIsSending(false);
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  if (template !== 'orbit-agent' || !stats) return null;

  const oc = stats.orbit;

  return (
    <div className="orbit-dashboard">
      <div className="dashboard-header">
        <div className="header-main">
          <span className="brand">ORBIT AGENT</span>
          <span className="version">v2026.2.2-3</span>
        </div>
        <div className="header-meta">
          <span className="host">root@168.231.78.113</span>
          <span className="uptime">{stats.uptime}</span>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Resource Section */}
        <section className="dashboard-section resources">
          <h4 className="section-title">CORE RESOURCES</h4>
          <ResourceBar label="CPU" value={stats.cpu} color="#FF4600" />
          <ResourceBar label="MEM" value={stats.memory} color="#1F94FF" />
          <ResourceBar label="DSK" value={stats.disk} color="#0D9C53" />
        </section>

        {/* Services Section */}
        <section className="dashboard-section services">
          <h4 className="section-title">GATEWAY TUNNEL (18789)</h4>
          <div className="services-list">
            <ServiceStatus label="ORBIT GATEWAY" status={oc?.gatewayStatus || 'stopped'} pid={oc?.gatewayPid} />
            <ServiceStatus label="OPENVPN" status={oc?.vpnActive || false} />
            <ServiceStatus label="SSH TUNNEL" status={true} />
          </div>
        </section>

        {/* Intelligence Matrix */}
        <section className="dashboard-section intelligence">
          <h4 className="section-title">INTELLIGENCE MATRIX</h4>
          <div className="matrix-stats">
            <div className="matrix-item">
              <span className="matrix-label">ELIGIBLE SKILLS</span>
              <span className="matrix-value eligible">{oc?.skillsEligible || 0}</span>
            </div>
            <div className="matrix-item">
              <span className="matrix-label">MISSING REQS</span>
              <span className="matrix-value missing">{oc?.skillsMissing || 0}</span>
            </div>
            <div className="matrix-item">
              <span className="matrix-label">PLUGINS LOADED</span>
              <span className="matrix-value">{oc?.pluginsLoaded || 0}</span>
            </div>
          </div>
        </section>
      </div>

      {/* Real-time event log */}
      <div className="dashboard-event-log">
        <span className="event-prefix">LAST EVENT:</span>
        <span className="event-text">{oc?.lastEvent || "System Ready."}</span>
        <span className="event-timestamp">{stats.lastUpdated.toLocaleTimeString()}</span>
      </div>

      {/* Chat Input Section */}
      <div className="chat-input-section">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*,.pdf,.txt,.md,.json,.csv"
          className="hidden-file-input"
          aria-label="Upload file"
        />
        <button
          className="upload-btn"
          onClick={triggerFileUpload}
          disabled={!connected || isSending}
          title="Upload file"
        >
          <span className="material-symbols-outlined">attach_file</span>
        </button>
        <input
          type="text"
          className="chat-input"
          placeholder={connected ? "Send a message to Orbit Agent..." : "Connect to start..."}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!connected || isSending}
        />
        <button
          className="send-btn"
          onClick={handleSendMessage}
          disabled={!connected || isSending || !inputText.trim()}
          title="Send message"
        >
          <span className="material-symbols-outlined">{isSending ? 'pending' : 'send'}</span>
        </button>
      </div>

      <div className="dashboard-footer">
        <div className="pulse-coral"></div>
        <span>TUNNEL CONNECTED VIA SSH LOOPBACK</span>
      </div>
    </div>
  );
}
