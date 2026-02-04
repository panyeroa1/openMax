
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useTools } from '@/lib/state';

export default function Header() {
  const { template } = useTools();

  return (
    <header className="main-header">
      <div className="header-content">
        <div className="header-left">
          <div className="logo-area">
            <span className="material-symbols-outlined logo-icon">terminal</span>
            <div className="logo-text">
              <h1>OPENMAX<span>BY EBURON AI</span></h1>
              <p>Multi-Modal VPS Agent System</p>
            </div>
          </div>
        </div>
        
        <div className="header-center">
          {template === 'open-claw' && (
            <div className="vps-badge">
              <span className="status-dot"></span>
              <span className="vps-label">SSH TUNNEL:</span>
              <span className="vps-address">root@168.231.78.113</span>
            </div>
          )}
        </div>

        <div className="header-right">
          <div className="system-clock">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
      <div className="header-border-glow"></div>
    </header>
  );
}
