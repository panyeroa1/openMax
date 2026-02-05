
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { FunctionResponseScheduling } from '@google/genai';
import { FunctionCall } from '../state';

export const orbitTools: FunctionCall[] = [
  {
    name: 'execute_ssh_command',
    description: 'Executes a Linux shell command on the remote VPS (168.231.78.113). Use this for any system-level tasks.',
    parameters: {
      type: 'OBJECT',
      properties: {
        command: {
          type: 'STRING',
          description: 'The shell command to execute (e.g., ls, top, df -h, tail -f logs).'
        },
      },
      required: ['command'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'get_system_stats',
    description: 'Retrieves current system resource usage (CPU, Memory, Disk, Uptime) for the VPS 168.231.78.113.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.SILENT,
  },
  {
    name: 'manage_orbit',
    description: 'Controls the Orbit service and configuration (v2026.2.2-3).',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: {
          type: 'STRING',
          enum: ['start', 'stop', 'restart', 'status', 'doctor', 'fix', 'configure'],
          description: 'The OpenClaw action to perform.'
        },
        params: {
          type: 'STRING',
          description: 'Optional parameters for the action (e.g., "--fix" for doctor).'
        }
      },
      required: ['action'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'openvpn_control',
    description: 'Manages OpenVPN connection on the VPS via direct service control.',
    parameters: {
      type: 'OBJECT',
      properties: {
        command: {
          type: 'STRING',
          enum: ['start', 'stop', 'status', 'list_configs'],
          description: 'The OpenVPN command.'
        },
        config_name: {
          type: 'STRING',
          description: 'The name of the VPN configuration to use.'
        }
      },
      required: ['command'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'repository_control',
    description: 'Manages the Orbit GitHub repository (https://github.com/openclaw/openclaw.git) on the host.',
    parameters: {
      type: 'OBJECT',
      properties: {
        command: {
          type: 'STRING',
          enum: ['pull', 'clone', 'log', 'branch', 'status', 'checkout'],
          description: 'Git command to run within the project directory.'
        },
        branch: {
          type: 'STRING',
          description: 'Target branch name for checkout or pull operations.'
        }
      },
      required: ['command'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'hostinger_vps_api',
    description: 'Interacts with Hostinger VPS management API for remote power and network control.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: {
          type: 'STRING',
          enum: ['reboot', 'stop', 'start', 'get_info', 'reinstall_os'],
          description: 'The API action to trigger.'
        }
      },
      required: ['action']
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT
  },
  {
    name: 'move_arm',
    description: 'Moves the robotic arm (if connected via I/O) to specific coordinates.',
    parameters: {
      type: 'OBJECT',
      properties: {
        x: { type: 'NUMBER' },
        y: { type: 'NUMBER' },
        z: { type: 'NUMBER' },
      },
      required: ['x', 'y', 'z'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'operate_claw',
    description: 'Opens or closes the physical robotic claw gripper.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: {
          type: 'STRING',
          enum: ['open', 'close']
        },
      },
      required: ['action'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'report_to_boss',
    description: 'Sends a silent status update message to the Boss (User) during background tasks or multi-step operations. Use this to report progress without interrupting the flow.',
    parameters: {
      type: 'OBJECT',
      properties: {
        message: {
          type: 'STRING',
          description: 'The progress or status update message.'
        },
      },
      required: ['message'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.SILENT,
  },
];
