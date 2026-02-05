
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useUI } from '../lib/state';

const WebView: React.FC = () => {
    const { webViewUrl, setWebView } = useUI();

    if (!webViewUrl) return null;

    return (
        <div className="web-view-fullscreen">
            <div className="web-view-header">
                <div className="web-view-title">
                    <span className="material-symbols-outlined web-view-icon">
                        public
                    </span>
                    EXTERNAL MODULE: {webViewUrl}
                </div>
                <button className="web-view-close" onClick={() => setWebView(false)}>
                    CLOSE OVERRIDE
                </button>
            </div>
            <iframe
                src={webViewUrl}
                className="web-view-iframe"
                title="Embedded Web Module"
                allow="camera; microphone; geolocation"
            />
        </div>
    );
};

export default WebView;
