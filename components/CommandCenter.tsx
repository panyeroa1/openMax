
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useUI, useTools } from '../lib/state';

const CommandCenter: React.FC = () => {
    const { setCommandCenter, setWebView } = useUI();
    const { template } = useTools();

    const handleInitializeTerminal = () => {
        setCommandCenter(false);
    };

    const handleLaunchIntelligence = () => {
        setWebView(true, 'https://codexxx-pocket-tts-web.static.hf.space');
    };

    return (
        <div className="command-center">
            {/* Animated Orbit Background */}
            <div className="orbit-container">
                <div className="orbit-ring ring-1"></div>
                <div className="orbit-ring ring-2"></div>
                <div className="orbit-ring ring-3"></div>
            </div>

            <div className="stark-hud-menu">
                <div className="orbit-logo-large">
                    OPENMAX
                    <span>EBURON AI • COMMAND CENTER</span>
                </div>

                <button className="stark-button" onClick={handleInitializeTerminal}>
                    <span className="material-symbols-outlined">terminal</span>
                    INITIALIZE TERMINAL
                </button>

                <button className="stark-button" onClick={handleLaunchIntelligence}>
                    <span className="material-symbols-outlined">psychology</span>
                    LAUNCH OVERRIDE
                </button>

                <div className="command-center-status">
                    <span className="pulse-dot"></span>
                    <span className="status-text">SYSTEM READY • {template.toUpperCase()} ACTIVE</span>
                </div>
            </div>
        </div>
    );
};

export default CommandCenter;
