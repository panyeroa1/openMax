/**
 * OpenMax Conversation Memory API Server
 * Express.js REST API for conversation persistence
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { execFile } = require('child_process');
const { promisify } = require('util');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const execFileAsync = promisify(execFile);

const OPENMAX_OLLAMA_URL = (process.env.OPENMAX_OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const OPENMAX_OLLAMA_MODEL = process.env.OPENMAX_OLLAMA_MODEL || 'gemma3:4b';
const OPENMAX_OLLAMA_TIMEOUT_MS = Number.parseInt(process.env.OPENMAX_OLLAMA_TIMEOUT_MS || '120000', 10);
const OPENMAX_OPENCLAW_EXECUTION = (process.env.OPENMAX_OPENCLAW_EXECUTION || 'auto').toLowerCase(); // auto|local|ssh
const OPENMAX_ALLOW_CLIENT_SSH_CONFIG = (process.env.OPENMAX_ALLOW_CLIENT_SSH_CONFIG || 'false').toLowerCase() === 'true';

const fetchWithTimeout = async (url, options = {}, timeoutMs = 30000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
};

const ollamaChat = async ({ model, messages, options }) => {
  const response = await fetchWithTimeout(
    `${OPENMAX_OLLAMA_URL}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || OPENMAX_OLLAMA_MODEL,
        messages,
        stream: false,
        options: options || undefined,
      }),
    },
    OPENMAX_OLLAMA_TIMEOUT_MS
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Ollama error (${response.status}): ${text || response.statusText}`);
  }

  const data = await response.json();
  const content = data && data.message && typeof data.message.content === 'string' ? data.message.content : '';
  return content;
};

const safeJsonParse = (text) => {
  try {
    return JSON.parse(text);
  } catch (_) {
    // Attempt to extract a JSON object if the model wrapped it in text or markdown.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (_) {
        return null;
      }
    }
    return null;
  }
};

const OPENCLAW_SKILLS = {
  'health-check': {
    title: 'System Health Check',
    command: `
set +e
echo "=== Orbit Doctor ==="
if command -v orbit >/dev/null 2>&1; then
  orbit doctor 2>&1
else
  echo "orbit command not found"
fi

echo
echo "=== Gateway Port (18789) ==="
if command -v ss >/dev/null 2>&1; then
  ss -lntp | grep 18789 || echo "port 18789 not currently listening"
else
  netstat -lntp 2>/dev/null | grep 18789 || true
fi

echo
echo "=== OpenVPN Status ==="
if command -v systemctl >/dev/null 2>&1; then
  systemctl is-active openvpn 2>/dev/null || systemctl is-active openvpn-client@client 2>/dev/null || echo "openvpn service not active"
else
  echo "systemctl not found"
fi

echo
echo "=== Repository Status ==="
REPO=""
for p in /root/openclaw /opt/openclaw /home/openclaw/openclaw; do
  if [ -d "$p/.git" ]; then
    REPO="$p"
    break
  fi
done
if [ -n "$REPO" ]; then
  cd "$REPO" && git status -sb
else
  echo "OpenClaw repository not found in expected paths"
fi
`,
  },
  'quick-fix': {
    title: 'Auto Fix Orbit',
    command: `
set +e
echo "=== Orbit Auto Fix ==="
if command -v orbit >/dev/null 2>&1; then
  orbit doctor --fix 2>&1 || orbit doctor --fix --yes 2>&1 || true
  orbit config set gateway.mode local 2>&1 || true
  echo
  orbit doctor 2>&1 || true
else
  echo "orbit command not found"
fi
`,
  },
  'vpn-status': {
    title: 'VPN Status',
    command: `
set +e
echo "=== VPN Service ==="
if command -v systemctl >/dev/null 2>&1; then
  systemctl status openvpn --no-pager -l 2>&1 || systemctl status openvpn-client@client --no-pager -l 2>&1 || true
else
  echo "systemctl not found"
fi

echo
echo "=== Routes ==="
ip route 2>&1 || true

echo
echo "=== DNS (/etc/resolv.conf) ==="
cat /etc/resolv.conf 2>&1 || true
`,
  },
  'repo-sync': {
    title: 'Sync GitHub Repo',
    command: `
set +e
echo "=== Repository Sync ==="
REPO=""
for p in /root/openclaw /opt/openclaw /home/openclaw/openclaw; do
  if [ -d "$p/.git" ]; then
    REPO="$p"
    break
  fi
done
if [ -z "$REPO" ]; then
  echo "OpenClaw repository not found in expected paths"
  exit 1
fi

cd "$REPO"
git fetch --all --prune 2>&1
git pull --ff-only 2>&1 || git pull 2>&1
echo
git log --oneline -n 3 2>&1 || true
`,
  },
  'service-restart': {
    title: 'Restart Services',
    command: `
set +e
echo "=== Restarting Orbit/OpenClaw Services ==="
if command -v orbit >/dev/null 2>&1; then
  orbit restart 2>&1 || true
fi

for svc in openclaw-gateway.service openclaw.service openclaw-gateway openclaw orbit-gateway; do
  systemctl restart "$svc" 2>/dev/null && echo "restarted: $svc"
done

echo
echo "=== Service Health ==="
for svc in openclaw-gateway.service openclaw.service openclaw-gateway openclaw orbit-gateway; do
  systemctl is-active "$svc" 2>/dev/null && echo "$svc: active"
done
`,
  },
};

const quoteForShell = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

const resolveSshConfig = (body = {}) => {
  // Default: server-controlled SSH config only (don't accept secrets from client requests).
  const host =
    (OPENMAX_ALLOW_CLIENT_SSH_CONFIG && body.host) || process.env.OPENMAX_VPS_HOST || '168.231.78.113';
  const user =
    (OPENMAX_ALLOW_CLIENT_SSH_CONFIG && body.user) || process.env.OPENMAX_VPS_USER || 'root';
  const password =
    (OPENMAX_ALLOW_CLIENT_SSH_CONFIG && body.password) || process.env.OPENMAX_VPS_PASSWORD || '';

  return { host, user, password };
};

const buildSshArgs = ({ host, user, remoteCommand }) => [
  '-o',
  'StrictHostKeyChecking=no',
  '-o',
  'UserKnownHostsFile=/dev/null',
  '-o',
  'ConnectTimeout=15',
  `${user}@${host}`,
  remoteCommand,
];

const runLocally = async ({ command }) => {
  const timeout = Number.parseInt(process.env.OPENMAX_LOCAL_TIMEOUT_MS || process.env.OPENMAX_SSH_TIMEOUT_MS || '180000', 10);
  const maxBuffer = 4 * 1024 * 1024;

  try {
    const { stdout, stderr } = await execFileAsync('bash', ['-lc', command], {
      timeout,
      maxBuffer,
    });
    return {
      success: true,
      stdout: stdout || '',
      stderr: stderr || '',
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || 'Unknown local execution error',
      exitCode: Number.isInteger(error.code) ? error.code : 1,
      error: error.message,
    };
  }
};

const runOverSsh = async ({ host, user, password, command }) => {
  const timeout = Number.parseInt(process.env.OPENMAX_SSH_TIMEOUT_MS || '180000', 10);
  const maxBuffer = 4 * 1024 * 1024;
  const remoteCommand = `bash -lc ${quoteForShell(command)}`;

  const baseSshArgs = buildSshArgs({ host, user, remoteCommand });
  const execCommand = password ? 'sshpass' : 'ssh';
  const execArgs = password ? ['-p', password, 'ssh', ...baseSshArgs] : baseSshArgs;

  try {
    const { stdout, stderr } = await execFileAsync(execCommand, execArgs, {
      timeout,
      maxBuffer,
    });
    return {
      success: true,
      stdout: stdout || '',
      stderr: stderr || '',
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || 'Unknown SSH error',
      exitCode: Number.isInteger(error.code) ? error.code : 1,
      error: error.message,
    };
  }
};

const shouldRunOpenClawLocally = (host) => {
  if (OPENMAX_OPENCLAW_EXECUTION === 'local') {
    return true;
  }
  if (OPENMAX_OPENCLAW_EXECUTION === 'ssh') {
    return false;
  }
  // auto
  return host === '127.0.0.1' || host === 'localhost';
};

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Ollama status (for troubleshooting)
app.get('/api/brain/status', async (req, res) => {
  try {
    const response = await fetchWithTimeout(`${OPENMAX_OLLAMA_URL}/api/tags`, {}, 5000);
    if (!response.ok) {
      return res.json({
        ok: false,
        ollamaUrl: OPENMAX_OLLAMA_URL,
        model: OPENMAX_OLLAMA_MODEL,
        status: response.status,
      });
    }

    const data = await response.json();
    return res.json({
      ok: true,
      ollamaUrl: OPENMAX_OLLAMA_URL,
      model: OPENMAX_OLLAMA_MODEL,
      models: Array.isArray(data.models) ? data.models.map(m => m.name).slice(0, 30) : [],
    });
  } catch (error) {
    return res.json({
      ok: false,
      ollamaUrl: OPENMAX_OLLAMA_URL,
      model: OPENMAX_OLLAMA_MODEL,
      error: error.message || String(error),
    });
  }
});

// OpenClaw brain/agent: choose whether to answer or run an instant skill, then respond.
app.post('/api/brain/agent', async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const conversation = await db.getConversation(sessionId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const history = await db.getConversationMessages(conversation.id, 30);
    const toolList = Object.entries(OPENCLAW_SKILLS)
      .map(([id, skill]) => `- ${id}: ${skill.title}`)
      .join('\n');

    const system = `You are OpenClaw Brain inside OpenMax.\n\nYour goal: help non-developers get results instantly.\n\nYou may either:\n1) Respond normally.\n2) Run ONE skill from the list to gather facts or apply a safe fix.\n\nReturn ONLY valid JSON (no markdown). Choose one:\n{\"action\":\"respond\",\"text\":\"...\"}\n{\"action\":\"run_skill\",\"skillId\":\"<id>\",\"reason\":\"...\"}\n\nAvailable skills:\n${toolList}\n\nRules:\n- If the user asks for system status/health, use health-check.\n- If they ask to fix Orbit, use quick-fix.\n- If they ask about VPN, use vpn-status.\n- If they ask to update/sync repo, use repo-sync.\n- If they ask to restart services, use service-restart.\n- Otherwise respond.\n`;

    const ollamaMessages = [
      { role: 'system', content: system },
      ...history.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : m.role === 'user' ? 'user' : 'assistant',
        content:
          m.role === 'system'
            ? `[SYSTEM NOTE]\n${m.content}`
            : m.content,
      })),
    ];

    const decisionRaw = await ollamaChat({
      messages: ollamaMessages,
      model: req.body.model || OPENMAX_OLLAMA_MODEL,
      options: req.body.options || { temperature: 0.2 },
    });

    const decision = typeof decisionRaw === 'string' ? safeJsonParse(decisionRaw) : null;
    if (!decision || !decision.action) {
      return res.json({
        action: 'respond',
        assistant: decisionRaw || 'I could not decide an action, but I am ready.',
        raw: decisionRaw,
      });
    }

    if (decision.action === 'respond') {
      return res.json({
        action: 'respond',
        assistant: decision.text || 'OK.',
        raw: decisionRaw,
      });
    }

    if (decision.action !== 'run_skill') {
      return res.json({
        action: 'respond',
        assistant: decisionRaw || 'OK.',
        raw: decisionRaw,
      });
    }

    const skillId = decision.skillId;
    const skill = OPENCLAW_SKILLS[skillId];
    if (!skill) {
      return res.status(400).json({ error: `Unknown skillId: ${skillId}`, raw: decisionRaw });
    }

    const sshConfig = resolveSshConfig(req.body);
    const runOpenClawLocally = shouldRunOpenClawLocally(sshConfig.host);
    if (!runOpenClawLocally && !sshConfig.password && !process.env.OPENMAX_ALLOW_KEY_AUTH) {
      return res.status(400).json({
        error:
          'Missing VPS password. Set OPENMAX_VPS_PASSWORD on the server (recommended), or configure key auth.',
      });
    }

    const execution = runOpenClawLocally
      ? await runLocally({ command: skill.command })
      : await runOverSsh({
          host: sshConfig.host,
          user: sshConfig.user,
          password: sshConfig.password,
          command: skill.command,
        });

    const summarizeSystem = `You are OpenMax. Summarize the following tool output for a non-developer.\n\nRules:\n- Do not invent.\n- Keep it short.\n- Mention any problems.\n- Give next steps.\n`;

    const summarizeUser = `User request:\n${history.filter(m => m.role === 'user').slice(-1)[0]?.content || ''}\n\nTool: ${skill.title}\nHost: ${sshConfig.host}\nExit code: ${execution.exitCode}\n\nSTDOUT:\n${execution.stdout || ''}\n\nSTDERR:\n${execution.stderr || ''}`;

    let summary = '';
    try {
      summary = await ollamaChat({
        messages: [
          { role: 'system', content: summarizeSystem },
          { role: 'user', content: summarizeUser },
        ],
        model: req.body.model || OPENMAX_OLLAMA_MODEL,
        options: { temperature: 0.2 },
      });
    } catch (err) {
      summary = `Executed ${skill.title} on ${sshConfig.host}. (Summary unavailable: ${err.message || String(err)})`;
    }

    return res.json({
      action: 'run_skill',
      skillId,
      title: skill.title,
      assistant: summary,
      tool: {
        success: execution.success,
        host: sshConfig.host,
        user: sshConfig.user,
        exitCode: execution.exitCode,
        stdout: execution.stdout,
        stderr: execution.stderr,
        error: execution.error || null,
        executedAt: new Date().toISOString(),
      },
      raw: decisionRaw,
    });
  } catch (error) {
    console.error('Error in /api/brain/agent:', error);
    return res.status(500).json({ error: 'Failed to process agent request', detail: error.message || String(error) });
  }
});

// List available instant skills
app.get('/api/openclaw/skills', (req, res) => {
  const skills = Object.entries(OPENCLAW_SKILLS).map(([id, skill]) => ({
    id,
    title: skill.title,
  }));
  res.json({ skills });
});

// Execute an instant skill directly on OpenClaw VPS
app.post('/api/openclaw/skills/:skillId', async (req, res) => {
  try {
    const { skillId } = req.params;
    const skill = OPENCLAW_SKILLS[skillId];

    if (!skill) {
      return res.status(404).json({ error: `Unknown skill: ${skillId}` });
    }

    const sshConfig = resolveSshConfig(req.body);
    const runOpenClawLocally = shouldRunOpenClawLocally(sshConfig.host);
    if (!runOpenClawLocally && !sshConfig.password && !process.env.OPENMAX_ALLOW_KEY_AUTH) {
      return res.status(400).json({
        error:
          'Missing VPS password. Set OPENMAX_VPS_PASSWORD on the server (recommended), or configure key auth.',
      });
    }

    const execution = runOpenClawLocally
      ? await runLocally({ command: skill.command })
      : await runOverSsh({
          host: sshConfig.host,
          user: sshConfig.user,
          password: sshConfig.password,
          command: skill.command,
        });

    let summary = null;
    try {
      summary = await ollamaChat({
        messages: [
          {
            role: 'system',
            content:
              'Summarize this output for a non-developer. Keep it short and actionable. Do not invent.',
          },
          {
            role: 'user',
            content: `Skill: ${skill.title}\nHost: ${sshConfig.host}\nExit code: ${execution.exitCode}\n\nSTDOUT:\n${execution.stdout || ''}\n\nSTDERR:\n${execution.stderr || ''}`,
          },
        ],
        model: req.body.model || OPENMAX_OLLAMA_MODEL,
        options: { temperature: 0.2 },
      });
    } catch (_) {
      summary = null;
    }

    return res.json({
      success: execution.success,
      skillId,
      title: skill.title,
      host: sshConfig.host,
      user: sshConfig.user,
      exitCode: execution.exitCode,
      stdout: execution.stdout,
      stderr: execution.stderr,
      summary,
      error: execution.error || null,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error executing OpenClaw skill:', error);
    return res.status(500).json({
      error: 'Failed to execute OpenClaw skill',
      detail: error.message || String(error),
    });
  }
});

// Create new conversation
app.post('/api/conversations', async (req, res) => {
  try {
    const { userId, title } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const sessionId = uuidv4();
    const conversation = await db.createConversation(userId, sessionId, title);
    
    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get user's conversations
app.get('/api/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const conversations = await db.getUserConversations(userId, limit);
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get specific conversation
app.get('/api/conversation/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const conversation = await db.getConversation(sessionId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Update conversation title
app.patch('/api/conversation/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;
    
    const conversation = await db.updateConversationTitle(sessionId, title);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json(conversation);
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// Save message
app.post('/api/messages', async (req, res) => {
  try {
    const { sessionId, role, content, metadata } = req.body;
    
    if (!sessionId || !role || !content) {
      return res.status(400).json({ error: 'sessionId, role, and content are required' });
    }

    // Get conversation
    const conversation = await db.getConversation(sessionId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const message = await db.addMessage(conversation.id, role, content, metadata);
    res.status(201).json(message);
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// Get conversation messages
app.get('/api/messages/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    
    // Get conversation
    const conversation = await db.getConversation(sessionId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await db.getConversationMessages(conversation.id, limit);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Search messages
app.get('/api/search', async (req, res) => {
  try {
    const { userId, query, limit } = req.query;
    
    if (!userId || !query) {
      return res.status(400).json({ error: 'userId and query are required' });
    }

    const results = await db.searchMessages(userId, query, parseInt(limit) || 50);
    res.json(results);
  } catch (error) {
    console.error('Error searching messages:', error);
    res.status(500).json({ error: 'Failed to search messages' });
  }
});

// Start server if run directly (local development)
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ OpenMax API server running on port ${PORT}`);
    console.log(`  Local: http://localhost:${PORT}`);
    console.log(`  VPS: http://168.231.78.113:${PORT}`);
  });
}

module.exports = app;
