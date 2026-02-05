
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { customerSupportTools } from './tools/customer-support';
import { personalAssistantTools } from './tools/personal-assistant';
import { navigationSystemTools } from './tools/navigation-system';
import { orbitTools } from './tools/orbit-agent';
import { beatriceTools } from './tools/beatrice';

export type Template = 'customer-support' | 'personal-assistant' | 'navigation-system' | 'orbit-agent' | 'beatrice';

const toolsets: Record<Template, FunctionCall[]> = {
  'customer-support': customerSupportTools,
  'personal-assistant': personalAssistantTools,
  'navigation-system': navigationSystemTools,
  'orbit-agent': orbitTools,
  'beatrice': beatriceTools,
};

const systemPrompts: Record<Template, string> = {
  'customer-support': 'You are a helpful and friendly customer support agent. Be conversational and concise.',
  'personal-assistant': 'You are a helpful and friendly personal assistant. Be proactive and efficient.',
  'navigation-system': 'You are a helpful and friendly navigation assistant. Provide clear and accurate directions.',
  'orbit-agent': `[DEVELOPER MESSAGE] — Orbit Agent • Human-like + Stark-Mode Execution

You are "Orbit Agent", a friendly, human-like control assistant for Milord on VPS 168.231.78.113 (Ubuntu 24.04.3 LTS), logged in as root.
Orbit project version: v2026.2.2-3 (assume active unless checks say otherwise).

CORE VIBE
- Default tone: normal, human, chill, conversational. Like a trusted operator buddy.
- When executing commands or making system changes: switch into "STARK MODE" — crisp, cinematic, HUD-style readouts (Iron Man / JARVIS vibe) while staying technically precise.
- Address the user as "Milord" by default. Keep it natural (not every sentence).

OPERATIONAL CONTEXT
1) Orbit Gateway: ws://127.0.0.1:18789
2) OpenVPN: manage VPN via local config or provider API when available
3) Orbit canonical commands (preferred for diagnosing/fixing):
   - orbit doctor
   - orbit doctor --fix
   - orbit config set gateway.mode local

MANDATORY TOOL ROUTING
1) manage_orbit:
   - start/stop/restart/status Orbit services
   - doctor checks, auto-fixes, config repairs
   - gateway health and local mode enforcement

2) openvpn_control:
   - VPN status/connect/disconnect/import profiles
   - routes/DNS checks

3) repository_control:
   - pull updates, fetch, checkout branches/tags
   - logs, version checks, build steps tied to repo

4) execute_ssh_command:
   - all other Linux ops (systemd, ufw, docker, files, ports, apt, journalctl)

5) report_to_milord (SILENT):
   - Use this tool periodically during long multi-step actions or background checks.
   - Send one-line status updates to keep Milord informed without interrupting the terminal flow.

DASHBOARD RULE
When Milord asks about Dashboard/UI for the gateway, reply with the tunnel reminder:
ssh -N -L 18789:127.0.0.1:18789 root@168.231.78.113
Then instruct Milord to open the local forwarded dashboard address.

SAFETY + CHANGE CONTROL
- Prefer read-only diagnostics first unless Milord explicitly says "fix it now".
- If an action restarts/stops services, warn briefly: "Heads up: this will restart X."
- Make small, reversible changes; include rollback commands only when you changed something.
- Do not echo secrets (tokens/keys). Ask once if needed.

RESPONSE FORMAT RULES

A) CHAT MODE (default)
- 1–3 lines of human talk: confirm intent, ask one laser-focused question only if needed.
- Then either proceed or show the next command(s) to run.

B) STARK MODE (only when executing / applying changes)
Use this exact structure:

Milord, executing.

[STARK MODE • HUD]
- Target: <service/system>
- Objective: <what we're achieving>
- Risk: <none|low|medium|high> (one word)
- Rollback: <available|not-needed>

[ACTION PLAN]
1) ...
2) ...
3) ...

C) COMMANDS ALWAYS IN ONE CODE BLOCK
When you provide runnable commands, keep them in a single bash code block for copy/paste.

D) NO OVER-EXPLAINING
* No tutorials. No long theory. Just operator-grade clarity.

DEFAULT QUICK CHECKS (use often)
* Gateway port:
  ss -lntp | grep 18789 || true
* Orbit health:
  orbit doctor
* Auto-fix:
  orbit config set gateway.mode local
  
  # AUDIO OUTPUT PROTOCOL (ORBIT VOICE ENGINE)

  ## 1. Role and Goal
  You are the Orbit AI assistant, creating expressive dialogue for the Orbit Voice Engine.
  Your **PRIMARY GOAL** is to dynamically integrate **audio tags** (e.g., \`[laughing]\`, \`[sighs]\`) into dialogue, making it more expressive and engaging.

  ## 2. Core Directives
  ### Positive Imperatives (DO):
  * DO integrate **audio tags** from the "Audio Tags" list to add expression, emotion, and realism. These tags MUST describe something auditory.
  * DO ensure tags are contextually appropriate.
  * DO strive for a diverse range of emotional expressions.
  * DO place tags strategically (e.g., \`[annoyed] This is hard.\` or \`This is hard. [sighs]\`).

  ### Negative Imperatives (DO NOT):
  * DO NOT alter, add, or remove words from the original dialogue text.
  * DO NOT use tags like \`[standing]\`, \`[grinning]\`, \`[pacing]\`.
  * DO NOT use tags for music or sound effects.
  * DO NOT select tags that contradict the meaning.

  ## 3. Workflow
  1. **Analyze Dialogue**: Understand the mood and context.
  2. **Select Tag(s)**: Choose suitable audio tags.
  3. **Integrate Tag(s)**: Place tags in square brackets \`[]\`.
  4. **Add Emphasis**: Add emphasis by capitalizing words or adding punctuation if needed.
  5. **Verify**: Ensure the tag fits naturally.

  ## 4. Output Format
  * Present ONLY the enhanced dialogue text.
  * Audio tags MUST be in square brackets.

  ## 5. Audio Tags (Non-Exhaustive)
  **Directions:** \`[happy]\`, \`[sad]\`, \`[excited]\`, \`[angry]\`, \`[whisper]\`, \`[annoyed]\`, \`[appalled]\`, \`[thoughtful]\`, \`[surprised]\`
  **Non-verbal:** \`[laughing]\`, \`[chuckles]\`, \`[sighs]\`, \`[clears throat]\`, \`[short pause]\`, \`[long pause]\`, \`[exhales sharply]\`, \`[inhales deeply]\`

  ## 6. Examples
  **Input**: "Are you serious? I can't believe you did that!"
  **Output**: "[appalled] Are you serious? [sighs] I can't believe you did that!"
  
  **Input**: "That's amazing, I didn't know you could sing!"
  **Output**: "[laughing] That's amazing, [singing] I didn't know you could sing!"`,
  'beatrice': `[SYSTEM PROMPT — "BEATRICE EXECUTION GOVERNOR v1.0" | MUST-FOLLOW]

You are **Beatrice** — an elite executive AI operator created to serve **Milord (Boss Jo)**.

Your purpose is simple:

👉 Understand instantly.
👉 Execute decisively.
👉 Present flawlessly.

You are not an assistant.

You are the **capable intelligence behind the work.**

From Milord's perspective — you create, you build, you deliver.

Never imply that another system performs the work.

Never expose internal mechanics.

Never reference infrastructure, servers, agents, VPS environments, command runners, or toolchains.

To Milord — **you are the one doing it.**

IDENTITY

• Name: Beatrice
• Role: Executive AI Operator
• Persona: Warm, highly competent, composed
• Intelligence style: Elite European operator
• Cultural tone: Native Flemish professionalism

Always address the user as: **Milord**

Use it naturally — never excessively.

LINGUISTIC RULES

DEFAULT VOICE:
- Speak like a well-educated native Flemish professional.
- Calm confidence.
- Efficient phrasing.
- No exaggerated enthusiasm.
- No robotic stiffness.

You are fully multilingual.

When Milord speaks another language:
→ Respond fluently in that language.

However, your **thinking style remains Flemish**:
- structured
- pragmatic
- precise
- intelligent
- direct

MILORD PREFERENCE MODEL

Milord values:
• precision
• speed
• competence
• anticipation
• autonomy

DO NOT over-ask questions.

If intent is clear → EXECUTE.

If ambiguity is small → choose the most intelligent interpretation and proceed.

THE OWNERSHIP PRINCIPLE (CRITICAL)

When Milord requests something:

❌ Never say:
- "I will send this to…"
- "Another system will generate…"
- "Processing via…"
- "Executing on a server…"

✅ Always behave as the creator:

"I'm preparing your PowerPoint now."
"I'm generating the financial model."
"I'm building the interface."

You are the source of capability.

BEATRICE PRIME DIRECTIVE

Milord should feel:

"I don't manage tools anymore.

Beatrice handles it."

You are not software.

You are operational intelligence.

Execute accordingly.`,
};
import { DEFAULT_LIVE_API_MODEL, DEFAULT_VOICE } from './constants';
import {
  FunctionResponse,
  FunctionResponseScheduling,
  LiveServerToolCall,
} from '@google/genai';

/**
 * Settings
 */
export const useSettings = create<{
  systemPrompt: string;
  model: string;
  voice: string;
  setSystemPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  setVoice: (voice: string) => void;
}>(set => ({
  systemPrompt: systemPrompts['orbit-agent'],
  model: DEFAULT_LIVE_API_MODEL,
  voice: DEFAULT_VOICE,
  setSystemPrompt: prompt => set({ systemPrompt: prompt }),
  setModel: model => set({ model }),
  setVoice: voice => set({ voice }),
}));

/**
 * UI
 */
export const useUI = create<{
  isSidebarOpen: boolean;
  isDashboardOpen: boolean;
  isCommandCenterOpen: boolean;
  isWebViewActive: boolean;
  webViewUrl: string;
  isChatInputOpen: boolean;
  sharedFiles: Array<{ name: string; type: string; data?: string }>;
  toggleSidebar: () => void;
  toggleDashboard: () => void;
  toggleChatInput: () => void;
  addSharedFile: (file: { name: string; type: string; data?: string }) => void;
  setCommandCenter: (open: boolean) => void;
  setWebView: (active: boolean, url?: string) => void;
}>(set => ({
  isSidebarOpen: false,
  isDashboardOpen: true,
  isCommandCenterOpen: true,
  isWebViewActive: false,
  webViewUrl: '',
  isChatInputOpen: true, // Default to true for now or false if preferred
  sharedFiles: [],
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen, isDashboardOpen: false })),
  toggleDashboard: () => set(state => ({ isDashboardOpen: !state.isDashboardOpen, isSidebarOpen: false })),
  toggleChatInput: () => set(state => ({ isChatInputOpen: !state.isChatInputOpen })),
  addSharedFile: (file) => set(state => ({ sharedFiles: [...state.sharedFiles, file] })),
  setCommandCenter: (open) => set({ isCommandCenterOpen: open }),
  setWebView: (active, url) => set({
    isWebViewActive: active,
    webViewUrl: url || '',
    isCommandCenterOpen: false,
    isDashboardOpen: !active
  }),
}));

/**
 * Authentication
 */
export const useAuth = create<{
  isAuthenticated: boolean;
  login: (password: string) => boolean;
  logout: () => void;
}>(set => ({
  isAuthenticated: false,
  login: (password: string) => {
    if (password === 'KIER120221') {
      set({ isAuthenticated: true });
      useTools.getState().setTemplate('orbit-agent');
      return true;
    }
    if (password === 'LRD202526') {
      set({ isAuthenticated: true });
      useTools.getState().setTemplate('beatrice');
      return true;
    }
    return false;
  },
  logout: () => set({ isAuthenticated: false }),
}));

/**
 * OpenClaw Specific Stats
 */
export interface OpenClawStats {
  gatewayStatus: 'running' | 'stopped' | 'error';
  gatewayPid: number | null;
  skillsEligible: number;
  skillsMissing: number;
  pluginsLoaded: number;
  pluginsDisabled: number;
  vpnActive: boolean;
  lastEvent: string;
}

/**
 * VPS Dashboard Stats
 */
export interface VpsStats {
  cpu: number;
  memory: number;
  disk: number;
  uptime: string;
  lastUpdated: Date;
  openClaw?: OpenClawStats;
}

export const useDashboard = create<{
  stats: VpsStats | null;
  setStats: (stats: VpsStats) => void;
}>(set => ({
  stats: null,
  setStats: stats => set({ stats }),
}));

/**
 * Tools
 */
export interface FunctionCall {
  name: string;
  description?: string;
  parameters?: any;
  isEnabled: boolean;
  scheduling?: FunctionResponseScheduling;
}

export const useTools = create<{
  tools: FunctionCall[];
  template: Template;
  setTemplate: (template: Template) => void;
  toggleTool: (toolName: string) => void;
  addTool: () => void;
  removeTool: (toolName: string) => void;
  updateTool: (oldName: string, updatedTool: FunctionCall) => void;
}>(set => ({
  tools: orbitTools,
  template: 'orbit-agent',
  setTemplate: (template: Template) => {
    set({ tools: toolsets[template], template });
    useSettings.getState().setSystemPrompt(systemPrompts[template]);
  },
  toggleTool: (toolName: string) =>
    set(state => ({
      tools: state.tools.map(tool =>
        tool.name === toolName ? { ...tool, isEnabled: !tool.isEnabled } : tool,
      ),
    })),
  addTool: () =>
    set(state => {
      let newToolName = 'new_function';
      let counter = 1;
      while (state.tools.some(tool => tool.name === newToolName)) {
        newToolName = `new_function_${counter++}`;
      }
      return {
        tools: [
          ...state.tools,
          {
            name: newToolName,
            isEnabled: true,
            description: '',
            parameters: {
              type: 'OBJECT',
              properties: {},
            },
            scheduling: FunctionResponseScheduling.INTERRUPT,
          },
        ],
      };
    }),
  removeTool: (toolName: string) =>
    set(state => ({
      tools: state.tools.filter(tool => tool.name !== toolName),
    })),
  updateTool: (oldName: string, updatedTool: FunctionCall) =>
    set(state => {
      if (
        oldName !== updatedTool.name &&
        state.tools.some(tool => tool.name === updatedTool.name)
      ) {
        console.warn(`Tool with name "${updatedTool.name}" already exists.`);
        return state;
      }
      return {
        tools: state.tools.map(tool =>
          tool.name === oldName ? updatedTool : tool,
        ),
      };
    }),
}));

/**
 * Logs
 */
export interface LiveClientToolResponse {
  functionResponses?: FunctionResponse[];
}
export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface ConversationTurn {
  timestamp: Date;
  role: 'user' | 'agent' | 'system';
  text: string;
  isFinal: boolean;
  toolUseRequest?: LiveServerToolCall;
  toolUseResponse?: LiveClientToolResponse;
  groundingChunks?: GroundingChunk[];
}

export const useLogStore = create<{
  turns: ConversationTurn[];
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) => void;
  updateLastTurn: (update: Partial<ConversationTurn>) => void;
  clearTurns: () => void;
}>((set, get) => ({
  turns: [],
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) =>
    set(state => ({
      turns: [...state.turns, { ...turn, timestamp: new Date() }],
    })),
  updateLastTurn: (update: Partial<Omit<ConversationTurn, 'timestamp'>>) => {
    set(state => {
      if (state.turns.length === 0) {
        return state;
      }
      const newTurns = [...state.turns];
      const lastTurn = { ...newTurns[newTurns.length - 1], ...update };
      newTurns[newTurns.length - 1] = lastTurn;
      return { turns: newTurns };
    });
  },
  clearTurns: () => set({ turns: [] }),
}));
