
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect } from 'react';
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
        style={{ width: `${value}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
      />
    </div>
  </div>
);

const ServiceStatus = ({ label, status, pid }: { label: string; status: boolean | 'running' | 'stopped'; pid?: number | null }) => (
  <div className="service-status-pill">
    <span className={`status-indicator ${status === 'running' || status === true ? 'active' : 'inactive'}`}></span>
    <div className="service-details">
      <span className="service-label">{label}</span>
      {pid && <span className="service-pid">PID: {pid}</span>}
    </div>
  </div>
);

export default function OpenClawDashboard() {
  const { stats } = useDashboard();
  const { template } = useTools();
  const { connected, client } = useLiveAPIContext();

  useEffect(() => {
    if (!connected || template !== 'open-claw') return;

    // Trigger initial stats update via LLM
    client.send([{ text: "Request system stats for dashboard" }], false);

    const interval = setInterval(() => {
      // Silently poll for updates through the model's tool use
      client.send([{ text: "Silent background update of get_system_stats" }], false);
    }, 15000);

    return () => clearInterval(interval);
  }, [connected, template, client]);

  if (template !== 'open-claw' || !stats) return null;

  const oc = stats.openClaw;

  return (
    <div className="openclaw-dashboard">
      <div className="dashboard-header">
        <div className="header-main">
          <span className="brand">OPENMAX</span>
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
            <ServiceStatus label="OC GATEWAY" status={oc?.gatewayStatus || 'stopped'} pid={oc?.gatewayPid} />
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

      <div className="dashboard-footer">
        <div className="pulse-coral"></div>
        <span>TUNNEL CONNECTED VIA SSH LOOPBACK</span>
      </div>
    </div>
  );
}
