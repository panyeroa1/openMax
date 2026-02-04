
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

export default function VpsDashboard() {
  const { stats } = useDashboard();
  const { template } = useTools();
  const { connected, client } = useLiveAPIContext();

  useEffect(() => {
    if (!connected || template !== 'open-claw') return;

    // Initial fetch
    client.send([{ text: "Update system stats" }], false);

    const interval = setInterval(() => {
      // Silently request stats updates
      // Using a hidden instruction to the model
      client.send([{ text: "Please use get_system_stats to update the dashboard stats." }], false);
    }, 10000);

    return () => clearInterval(interval);
  }, [connected, template, client]);

  if (template !== 'open-claw' || !stats) return null;

  return (
    <div className="vps-dashboard-widget">
      <div className="dashboard-header">
        <span className="dashboard-title">SYSTEM MONITOR</span>
        <span className="dashboard-host">168.231.78.113</span>
      </div>
      
      <div className="dashboard-body">
        <ResourceBar label="CPU" value={stats.cpu} color="var(--Green-500)" />
        <ResourceBar label="MEM" value={stats.memory} color="var(--Blue-500)" />
        
        <div className="stats-grid">
          <div className="stat-box">
            <span className="stat-label">DISK USE</span>
            <span className="stat-value">{stats.disk}%</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">UPTIME</span>
            <span className="stat-value">{stats.uptime}</span>
          </div>
        </div>
      </div>
      
      <div className="dashboard-footer">
        <div className="pulse-indicator"></div>
        <span>LIVE UPDATES ENABLED</span>
        <span className="timestamp">{stats.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      </div>
    </div>
  );
}
