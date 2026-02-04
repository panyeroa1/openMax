
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useUI, useTools } from '@/lib/state';

export default function Header() {
  const { toggleSidebar } = useUI();
  const { template } = useTools();

  return (
    <header>
      <div className="header-left">
        <h1>Native Audio Function Call Sandbox</h1>
        <p>Build your own function call experiment.</p>
        {template === 'open-claw' && (
          <div className="vps-badge">
            <span className="status-dot"></span>
            CONNECTED: root@168.231.78.113
          </div>
        )}
      </div>
      <div className="header-right">
        <button
          className="settings-button"
          onClick={toggleSidebar}
          aria-label="Settings"
        >
          <span className="icon">tune</span>
        </button>
      </div>
    </header>
  );
}
