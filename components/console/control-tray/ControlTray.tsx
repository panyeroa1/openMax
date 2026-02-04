
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import cn from 'classnames';
import { memo, ReactNode, useEffect, useRef, useState } from 'react';
import { AudioRecorder } from '../../../lib/audio-recorder';
import { useSettings, useTools, useLogStore, useUI } from '@/lib/state';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';

export type ControlTrayProps = {
  children?: ReactNode;
};

function ControlTray({ children }: ControlTrayProps) {
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [muted, setMuted] = useState(false);
  const connectButtonRef = useRef<HTMLButtonElement>(null);

  const { client, connected, connect, disconnect } = useLiveAPIContext();
  const { toggleSidebar } = useUI();

  useEffect(() => {
    if (!connected && connectButtonRef.current) {
      connectButtonRef.current.focus();
    }
  }, [connected]);

  useEffect(() => {
    if (!connected) {
      setMuted(false);
    }
  }, [connected]);

  useEffect(() => {
    const onData = (base64: string) => {
      client.sendRealtimeInput([
        {
          mimeType: 'audio/pcm;rate=16000',
          data: base64,
        },
      ]);
    };
    if (connected && !muted && audioRecorder) {
      audioRecorder.on('data', onData);
      audioRecorder.start();
    } else {
      audioRecorder.stop();
    }
    return () => {
      audioRecorder.off('data', onData);
    };
  }, [connected, client, muted, audioRecorder]);

  const handleMicClick = () => {
    if (connected) {
      setMuted(!muted);
    } else {
      connect();
    }
  };

  const handleExportLogs = () => {
    const { systemPrompt, model } = useSettings.getState();
    const { tools } = useTools.getState();
    const { turns } = useLogStore.getState();

    const logData = {
      configuration: {
        model,
        systemPrompt,
      },
      tools,
      conversation: turns.map(turn => ({
        ...turn,
        timestamp: turn.timestamp.toISOString(),
      })),
    };

    const jsonString = JSON.stringify(logData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `openclaw-session-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const micButtonTitle = connected
    ? muted
      ? 'Unmute microphone'
      : 'Mute microphone'
    : 'Connect and start microphone';

  const connectButtonTitle = connected ? 'Stop session' : 'Start session';

  return (
    <section className="control-tray">
      <div className="tray-inner">
        <div className="tray-left">
          <button
            className={cn('action-button mic-button', { muted, connected })}
            onClick={handleMicClick}
            title={micButtonTitle}
          >
            {!muted ? (
              <span className="material-symbols-outlined filled">mic</span>
            ) : (
              <span className="material-symbols-outlined filled">mic_off</span>
            )}
          </button>
          
          <div className="divider"></div>

          <button
            className="action-button"
            onClick={toggleSidebar}
            title="Open Settings"
          >
            <span className="material-symbols-outlined">settings</span>
          </button>

          <button
            className="action-button"
            onClick={handleExportLogs}
            title="Export session logs"
          >
            <span className="material-symbols-outlined">download</span>
          </button>

          <button
            className="action-button"
            onClick={useLogStore.getState().clearTurns}
            title="Reset Terminal"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>

        <div className="tray-center">
           {connected && <div className="live-status-indicator">
              <span className="pulse-dot"></span>
              <span className="status-text">UPLINK ACTIVE</span>
           </div>}
        </div>

        <div className="tray-right">
          <div className={cn('connection-container', { connected })}>
            <button
              ref={connectButtonRef}
              className={cn('connect-toggle', { connected })}
              onClick={connected ? disconnect : connect}
              title={connectButtonTitle}
            >
              <span className="material-symbols-outlined filled">
                {connected ? 'stop_circle' : 'bolt'}
              </span>
              <span className="toggle-label">{connected ? 'DISCONNECT' : 'INITIALIZE'}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(ControlTray);
