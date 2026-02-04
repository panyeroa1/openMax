
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenAILiveClient } from '../../lib/genai-live-client';
import { LiveConnectConfig, Modality, LiveServerToolCall } from '@google/genai';
import { AudioStreamer } from '../../lib/audio-streamer';
import { audioContext } from '../../lib/utils';
import VolMeterWorket from '../../lib/worklets/vol-meter';
import { useLogStore, useSettings, useTools, useDashboard, OpenClawStats } from '@/lib/state';

export type UseLiveApiResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;

  connect: () => Promise<void>;
  disconnect: () => void;
  connected: boolean;

  volume: number;
};

// Helper to simulate realistic SSH command outputs for OpenClaw environment
const simulateSSHOutput = (command: string): string => {
  const cmd = command.toLowerCase().trim();
  
  if (cmd.includes('ls')) {
    return `bin/  CMakeLists.txt  data/  docs/  include/  LICENSE  README.md  res/  src/  tests/`;
  }
  if (cmd.includes('df -h')) {
    return `Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1       192.69GB  4.05GB  188.64GB   2.1% /
udev            3.9G     0  3.9G   0% /dev
tmpfs           798M  1.1M  797M   1% /run`;
  }
  if (cmd.includes('uptime')) {
    return ` 21:22:36 up 14 days,  1:12,  1 user,  load average: 0.00, 0.01, 0.00`;
  }
  if (cmd.includes('whoami')) {
    return `root`;
  }
  if (cmd.includes('openclaw doctor')) {
    return `┌  OpenClaw doctor
│
◇  Doctor changes
│  WhatsApp configured, not enabled yet.
│
◇  Gateway connection
│  Gateway target: ws://127.0.0.1:18789
│  Source: local loopback
│
└  Doctor complete.`;
  }
  
  return `[Command processed on 168.231.78.113]`;
};

export function useLiveApi({
  apiKey,
}: {
  apiKey: string;
}): UseLiveApiResults {
  const { model } = useSettings();
  const client = useMemo(() => new GenAILiveClient(apiKey, model), [apiKey, model]);

  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  const [volume, setVolume] = useState(0);
  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<LiveConnectConfig>({});

  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: 'audio-out' }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>('vumeter-out', VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            // Successfully added worklet
          })
          .catch(err => {
            console.error('Error adding worklet:', err);
          });
      });
    }
  }, [audioStreamerRef]);

  useEffect(() => {
    const onOpen = () => {
      setConnected(true);
    };

    const onClose = () => {
      setConnected(false);
    };

    const stopAudioStreamer = () => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.stop();
      }
    };

    const onAudio = (data: ArrayBuffer) => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.addPCM16(new Uint8Array(data));
      }
    };

    // Bind event listeners
    client.on('open', onOpen);
    client.on('close', onClose);
    client.on('interrupted', stopAudioStreamer);
    client.on('audio', onAudio);

    const onToolCall = (toolCall: LiveServerToolCall) => {
      const functionResponses: any[] = [];
      const currentTemplate = useTools.getState().template;

      for (const fc of toolCall.functionCalls) {
        let executionMessage = `Triggering function call: **${fc.name}**\n\`\`\`json\n${JSON.stringify(fc.args, null, 2)}\n\`\`\``;
        let simulatedOutput = "ok";
        let isSilent = false;
        
        // Specialized Simulation for OpenClaw project
        if (currentTemplate === 'open-claw') {
          if (fc.name === 'execute_ssh_command') {
            const output = simulateSSHOutput(fc.args.command);
            simulatedOutput = output;
            executionMessage = `💻 **TERMINAL**: root@168.231.78.113\n$ \`${fc.args.command}\`\n\n\`\`\`bash\n${output}\n\`\`\``;
          } else if (fc.name === 'get_system_stats') {
            isSilent = true;
            // Enhanced stats derived from OpenClaw context
            const stats = {
              cpu: Math.floor(Math.random() * 5) + 1, 
              memory: 1, 
              disk: 2.1,
              uptime: "14d 1h 12m",
              lastUpdated: new Date(),
              openClaw: {
                gatewayStatus: 'running' as const,
                gatewayPid: 1589,
                skillsEligible: 5,
                skillsMissing: 45,
                pluginsLoaded: 2,
                pluginsDisabled: 29,
                vpnActive: false,
                lastEvent: "Gateway polling loop active (v2026.2.2-3)"
              }
            };
            useDashboard.getState().setStats(stats);
            simulatedOutput = JSON.stringify(stats);
          } else if (fc.name === 'manage_openclaw') {
            const { action } = fc.args;
            let detail = "";
            let event = "";
            if (action === 'start') {
              detail = "Gateway started on pid 1589.";
              event = "Service START dispatched.";
            } else if (action === 'stop') {
              detail = "Gateway service stopped.";
              event = "Service STOP dispatched.";
            } else if (action === 'doctor') {
              detail = `┌  OpenClaw doctor\n│\n◇  Doctor changes\n│  WhatsApp configured, not enabled yet.\n│\n└  Doctor complete.`;
              event = "Doctor check complete.";
            } else if (action === 'fix') {
              detail = `✓ Tightened permissions on ~/.openclaw\n✓ Created Session store dir\n✓ Enabled systemd lingering\n✓ Restarted gateway service`;
              event = "System fix applied.";
            } else detail = "Action completed.";
            
            // Side effect: update dashboard event log
            const currentStats = useDashboard.getState().stats;
            if (currentStats && currentStats.openClaw) {
              useDashboard.getState().setStats({
                ...currentStats,
                openClaw: { ...currentStats.openClaw, lastEvent: event }
              });
            }

            simulatedOutput = detail;
            executionMessage = `🎮 **OPENCLAW ENGINE**: Action \`${action}\` dispatched\n\n\`\`\`bash\n${detail}\n\`\`\``;
          } else if (fc.name === 'openvpn_control') {
            const { command } = fc.args;
            let vpnLog = "";
            let vpnActive = false;
            if (command === 'status') vpnLog = "OpenVPN: inactive (dead)";
            else if (command === 'start') {
              vpnLog = "Starting OpenVPN tunnel... [OK]";
              vpnActive = true;
            } else vpnLog = "OpenVPN command processed.";

            // Side effect: update dashboard VPN status
            const currentStats = useDashboard.getState().stats;
            if (currentStats && currentStats.openClaw) {
              useDashboard.getState().setStats({
                ...currentStats,
                openClaw: { ...currentStats.openClaw, vpnActive, lastEvent: `VPN ${command.toUpperCase()}` }
              });
            }

            simulatedOutput = vpnLog;
            executionMessage = `🔒 **VPN CONTROL**: root@168.231.78.113\n\n\`\`\`bash\n${vpnLog}\n\`\`\``;
          } else if (fc.name === 'repository_control') {
            const { command } = fc.args;
            let gitLog = "";
            if (command === 'pull') {
              gitLog = "Updating 9c5941b..a1b2c3d\nFast-forward\n src/core.js | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)";
            } else if (command === 'clone') {
              gitLog = "Cloning into 'openclaw'...\nremote: Enumerating objects: 452, done.\nremote: Counting objects: 100% (452/452), done.\nReceiving objects: 100% (452/452), 1.2 MiB | 4.5 MiB/s, done.";
            } else if (command === 'log') {
              gitLog = "commit a1b2c3d4e5f6 (HEAD -> master, origin/master)\nAuthor: OpenClaw Maintainer <dev@openclaw.ai>\nDate: Wed Feb 4 20:00:00 2026 +0000\n\n    feat: add multi-modal audio grounding support\n\ncommit 9c5941b2e3d4\nAuthor: OpenClaw Maintainer <dev@openclaw.ai>\nDate: Tue Feb 3 18:30:00 2026 +0000\n\n    fix: gateway mode check for local loopback";
            } else if (command === 'status') {
              gitLog = "On branch master\nYour branch is up to date with 'origin/master'.\nnothing to commit, working tree clean";
            } else if (command === 'branch') {
              gitLog = "* master\n  develop\n  feature/multimodal-audio";
            } else {
              gitLog = "Git action completed.";
            }

            simulatedOutput = gitLog;
            executionMessage = `📂 **GIT CONTROL**: root@168.231.78.113\n$ \`git ${command}\`\n\n\`\`\`bash\n${gitLog}\n\`\`\``;
          } else if (fc.name === 'hostinger_vps_api') {
            const { action } = fc.args;
            const res = { status: 'success', server_id: 'srv909561', action_triggered: action };
            simulatedOutput = JSON.stringify(res);
            executionMessage = `🌩️ **HOSTINGER API**: Action \`${action}\` sent to Hostinger Control Panel.\n\n\`\`\`json\n${simulatedOutput}\n\`\`\``;
          }
        }

        // Log the function call trigger to the visual console if not silent
        if (!isSilent) {
          useLogStore.getState().addTurn({
            role: 'system',
            text: executionMessage,
            isFinal: true,
          });
        }

        // Prepare the response for the model
        functionResponses.push({
          id: fc.id,
          name: fc.name,
          response: { 
            result: simulatedOutput, 
            status: 'success', 
            host: '168.231.78.113', 
            timestamp: new Date().toISOString() 
          }, 
        });
      }

      // Log the full technical response if not silent
      if (functionResponses.length > 0 && !functionResponses.every(r => r.name === 'get_system_stats')) {
        const responseMessage = `Technical metadata from VPS:\n\`\`\`json\n${JSON.stringify(
          functionResponses,
          null,
          2,
        )}\n\`\`\``;
        useLogStore.getState().addTurn({
          role: 'system',
          text: responseMessage,
          isFinal: true,
        });
      }

      client.sendToolResponse({ functionResponses: functionResponses });
    };

    client.on('toolcall', onToolCall);

    return () => {
      // Clean up event listeners
      client.off('open', onOpen);
      client.off('close', onClose);
      client.off('interrupted', stopAudioStreamer);
      client.off('audio', onAudio);
      client.off('toolcall', onToolCall);
    };
  }, [client]);

  const connect = useCallback(async () => {
    if (!config) {
      throw new Error('config has not been set');
    }
    client.disconnect();
    await client.connect(config);
  }, [client, config]);

  const disconnect = useCallback(async () => {
    client.disconnect();
    setConnected(false);
  }, [setConnected, client]);

  return {
    client,
    config,
    setConfig,
    connect,
    connected,
    disconnect,
    volume,
  };
}
