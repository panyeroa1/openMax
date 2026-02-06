import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Conversation,
  Message as ApiMessage,
  SearchResult,
  useConversationMemory,
} from './hooks/useConversationMemory';

type AttachmentType = 'image' | 'file';
type SidebarTab = 'skills' | 'execution' | 'settings' | 'customization' | 'profile';

type Attachment = {
  id: number;
  type: AttachmentType;
  name: string;
  src?: string;
};

type UiMessage = {
  id: number | string;
  role: 'user' | 'ai' | 'system';
  text?: string;
  attachments?: Attachment[];
  timestamp?: string;
};

type InstantSkill = {
  id: string;
  icon: string;
  title: string;
  prompt: string;
};

type SkillExecutionResponse = {
  success: boolean;
  skillId: string;
  title: string;
  host: string;
  user: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  summary?: string | null;
  error?: string | null;
  executedAt: string;
};

type BrainAgentResponse =
  | {
      action: 'respond';
      assistant: string;
      raw?: string;
    }
  | {
      action: 'run_skill';
      skillId: string;
      title: string;
      assistant: string;
      tool: {
        success: boolean;
        host: string;
        user: string;
        exitCode: number;
        stdout: string;
        stderr: string;
        error?: string | null;
        executedAt: string;
      };
      raw?: string;
    };

const USER_ID_STORAGE_KEY = 'openmax_user_id';
const DEFAULT_TRANSCRIPTION = 'This is a simulated transcription of what I just said.';

const OPENCLAW_INSTANT_SKILLS: InstantSkill[] = [
  {
    id: 'health-check',
    icon: 'fa-heart-pulse',
    title: 'System Health Check',
    prompt:
      'Run a full OpenClaw health check for Orbit, VPN, and repository state, then explain the result in simple non-technical language.',
  },
  {
    id: 'quick-fix',
    icon: 'fa-screwdriver-wrench',
    title: 'Auto Fix Orbit',
    prompt:
      'Run Orbit doctor with safe auto-fixes and report what changed in plain language for a non-developer.',
  },
  {
    id: 'vpn-status',
    icon: 'fa-shield-halved',
    title: 'VPN Status',
    prompt:
      'Check OpenVPN status, current route, and DNS health, then summarize if everything is protected.',
  },
  {
    id: 'repo-sync',
    icon: 'fa-code-branch',
    title: 'Sync GitHub Repo',
    prompt:
      'Check repository status and pull latest stable updates from GitHub, then show a short change summary.',
  },
  {
    id: 'service-restart',
    icon: 'fa-rotate-right',
    title: 'Restart Services',
    prompt:
      'Restart Orbit services safely, verify all services are running again, and confirm in simple terms.',
  },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const mapMetadataAttachments = (metadata?: Record<string, unknown>): Attachment[] => {
  if (!metadata || !Array.isArray(metadata.attachments)) {
    return [];
  }

  const attachments: Attachment[] = [];
  metadata.attachments.forEach((item, index) => {
    if (!isRecord(item)) {
      return;
    }

    const name = typeof item.name === 'string' ? item.name : '';
    const typeValue = item.type;
    const src = typeof item.src === 'string' ? item.src : undefined;

    if (!name) {
      return;
    }

    const type: AttachmentType = typeValue === 'image' ? 'image' : 'file';
    attachments.push({
      id: index + 1,
      type,
      name,
      src,
    });
  });

  return attachments;
};

const mapApiMessageToUi = (message: ApiMessage): UiMessage => {
  const role: UiMessage['role'] =
    message.role === 'assistant' ? 'ai' : message.role === 'system' ? 'system' : 'user';

  const attachments = mapMetadataAttachments(message.metadata);

  return {
    id: message.id,
    role,
    text: message.content,
    attachments: attachments.length > 0 ? attachments : undefined,
    timestamp: message.timestamp,
  };
};

const formatConversationTitle = (conversation: Conversation) => {
  const cleanTitle = conversation.title?.trim();
  if (cleanTitle) {
    return cleanTitle;
  }

  const date = new Date(conversation.updated_at);
  return `Conversation ${date.toLocaleDateString()}`;
};

const formatTime = (value: string) => {
  const date = new Date(value);
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function App() {
  const {
    currentUser,
    currentSessionId,
    conversations,
    isLoading,
    error,
    startConversation,
    saveMessage,
    loadConversation,
    loadConversations,
    searchMessages,
    updateTitle,
  } = useConversationMemory();

  const [isLightMode, setIsLightMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isVoiceOverlayOpen, setIsVoiceOverlayOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('skills');
  const [inputValue, setInputValue] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<Attachment[]>([]);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusLevel, setStatusLevel] = useState<'neutral' | 'error'>('neutral');
  const [runningSkillId, setRunningSkillId] = useState<string | null>(null);
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const idRef = useRef(1);
  const chatFeedRef = useRef<HTMLDivElement | null>(null);
  const textFieldRef = useRef<HTMLTextAreaElement | null>(null);
  const plusBtnRef = useRef<HTMLButtonElement | null>(null);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const hasText = inputValue.trim().length > 0;
  const hasFiles = attachedFiles.length > 0;
  const showSendButton = hasText || hasFiles;

  const currentConversation = useMemo(
    () => conversations.find(item => item.session_id === currentSessionId) ?? null,
    [conversations, currentSessionId]
  );

  const nextId = () => {
    const current = idRef.current;
    idRef.current += 1;
    return current;
  };

  useEffect(() => {
    document.body.classList.toggle('light-mode', isLightMode);
    document.body.classList.toggle('sidebar-open', isSidebarOpen);

    return () => {
      document.body.classList.remove('light-mode');
      document.body.classList.remove('sidebar-open');
    };
  }, [isLightMode, isSidebarOpen]);

  useEffect(() => {
    if (!textFieldRef.current) {
      return;
    }
    textFieldRef.current.style.height = 'auto';
    textFieldRef.current.style.height = `${textFieldRef.current.scrollHeight}px`;
  }, [inputValue]);

  useEffect(() => {
    if (showSendButton && isRecording) {
      setIsRecording(false);
    }
  }, [showSendButton, isRecording]);

  useEffect(() => {
    if (!error) {
      return;
    }
    setStatusMessage(error);
    setStatusLevel('error');
  }, [error]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!isAttachMenuOpen) {
        return;
      }

      const target = event.target as Node;
      if (attachMenuRef.current?.contains(target) || plusBtnRef.current?.contains(target)) {
        return;
      }

      setIsAttachMenuOpen(false);
    };

    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [isAttachMenuOpen]);

  useEffect(() => {
    if (!chatFeedRef.current) {
      return;
    }
    chatFeedRef.current.scrollTo({
      top: chatFeedRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  const triggerUpload = (type: AttachmentType) => {
    setIsAttachMenuOpen(false);
    if (type === 'image') {
      imageInputRef.current?.click();
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>, type: AttachmentType) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent: ProgressEvent<FileReader>) => {
      const src = typeof loadEvent.target?.result === 'string' ? loadEvent.target.result : '';
      if (!src) {
        return;
      }

      setAttachedFiles(prev => [
        ...prev,
        {
          id: nextId(),
          type,
          name: file.name,
          src,
        },
      ]);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const removeAttachment = (attachmentId: number) => {
    setAttachedFiles(prev => prev.filter(file => file.id !== attachmentId));
  };

  const persistConversationTurn = async (
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata: Record<string, unknown>,
    sessionId: string
  ) => {
    const savedMessage = await saveMessage(role, content, metadata, sessionId);
    if (!savedMessage) {
      setStatusMessage('Unable to sync with API. Local view is still updated.');
      setStatusLevel('error');
    }
  };

  const sendMessage = async (overrideText?: string, source: string = 'manual') => {
    if (isSending) {
      return;
    }

    const text = (overrideText ?? inputValue).trim();
    const files = overrideText ? [] : attachedFiles;
    if (!text && files.length === 0) {
      return;
    }

    setIsSending(true);
    setStatusMessage('');
    setStatusLevel('neutral');

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await startConversation(text ? text.slice(0, 60) : 'New Conversation');
      if (!sessionId) {
        setStatusMessage('Could not create conversation.');
        setStatusLevel('error');
        setIsSending(false);
        return;
      }
    }

    const userMessage: UiMessage = {
      id: nextId(),
      role: 'user',
      text: text || undefined,
      attachments: files.length > 0 ? files : undefined,
    };
    setMessages(prev => [...prev, userMessage]);

    setInputValue('');
    setAttachedFiles([]);
    setIsRecording(false);
    setIsAttachMenuOpen(false);

    const attachmentsMetadata = files.map(file => ({
      type: file.type,
      name: file.name,
    }));
    const fallbackContent = attachmentsMetadata.length > 0 ? `[${attachmentsMetadata.length} attachment(s)]` : '';

    await persistConversationTurn(
      'user',
      text || fallbackContent,
      { attachments: attachmentsMetadata, source },
      sessionId
    );

    setStatusMessage('Thinking...');
    setStatusLevel('neutral');

    let agent: BrainAgentResponse | null = null;
    try {
      const response = await fetch('/api/brain/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Agent request failed');
      }
      agent = payload as BrainAgentResponse;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown agent error';
      agent = { action: 'respond', assistant: `I had trouble reaching the brain service.\n\n${msg}` };
      setStatusLevel('error');
    }

    const assistantText =
      (agent && typeof agent.assistant === 'string' && agent.assistant.trim()) ||
      'OK.';

    setMessages(prev => [
      ...prev,
      {
        id: nextId(),
        role: 'ai',
        text: assistantText,
      },
    ]);

    await persistConversationTurn(
      'assistant',
      assistantText,
      {
        source: 'ollama-brain',
        action: agent?.action || 'respond',
        ...(agent && agent.action === 'run_skill'
          ? {
              skillId: agent.skillId,
              tool: {
                success: agent.tool?.success,
                host: agent.tool?.host,
                exitCode: agent.tool?.exitCode,
              },
            }
          : null),
      },
      sessionId
    );

    setStatusMessage('');
    setStatusLevel('neutral');

    await loadConversations();
    setIsSending(false);
  };

  const handleActionButton = () => {
    if (showSendButton) {
      void sendMessage();
      return;
    }

    if (!isRecording) {
      setIsRecording(true);
      return;
    }

    setIsRecording(false);
    setInputValue(DEFAULT_TRANSCRIPTION);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (showSendButton || inputValue.trim()) {
        void sendMessage();
      }
    }
  };

  const handleOpenConversation = async (sessionId: string) => {
    const loadedMessages = await loadConversation(sessionId);
    const uiMessages = loadedMessages.map(mapApiMessageToUi);
    setMessages(uiMessages);
    setStatusMessage('');
    setStatusLevel('neutral');
    closeSidebar();
  };

  const handleStartNewConversation = async () => {
    const sessionId = await startConversation('New Conversation');
    if (!sessionId) {
      setStatusMessage('Could not start a new conversation.');
      setStatusLevel('error');
      return;
    }
    setMessages([]);
    setSearchResults([]);
    setSearchQuery('');
    setRenameSessionId(null);
    setRenameValue('');
    setStatusMessage('New conversation ready.');
    setStatusLevel('neutral');
    closeSidebar();
    await loadConversations();
  };

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const results = await searchMessages(query, 25);
    setSearchResults(results);
    setIsSearching(false);
  };

  const beginRenameConversation = (conversation: Conversation) => {
    setRenameSessionId(conversation.session_id);
    setRenameValue(conversation.title ?? '');
  };

  const saveRenameConversation = async (sessionId: string) => {
    const cleanTitle = renameValue.trim();
    if (!cleanTitle) {
      setStatusMessage('Conversation title cannot be empty.');
      setStatusLevel('error');
      return;
    }

    await updateTitle(sessionId, cleanTitle);
    setRenameSessionId(null);
    setRenameValue('');
    setStatusMessage('Conversation title updated.');
    setStatusLevel('neutral');
    await loadConversations();
  };

  const runInstantSkill = async (skill: InstantSkill) => {
    if (isSending) {
      return;
    }

    closeSidebar();
    setIsSending(true);
    setRunningSkillId(skill.id);
    setStatusMessage(`Running ${skill.title}...`);
    setStatusLevel('neutral');

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await startConversation(skill.title);
      if (!sessionId) {
        setStatusMessage(`Could not start a conversation for ${skill.title}.`);
        setStatusLevel('error');
        setRunningSkillId(null);
        setIsSending(false);
        return;
      }
    }

    const userInstruction = `Run skill: ${skill.title}`;
    setMessages(prev => [
      ...prev,
      {
        id: nextId(),
        role: 'user',
        text: userInstruction,
      },
    ]);
    await persistConversationTurn(
      'user',
      userInstruction,
      { source: 'openclaw-skill', skillId: skill.id },
      sessionId
    );

    let skillResult: SkillExecutionResponse | null = null;

    try {
      const response = await fetch(`/api/openclaw/skills/${skill.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Skill execution failed');
      }

      skillResult = payload as SkillExecutionResponse;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown execution error';
      skillResult = {
        success: false,
        skillId: skill.id,
        title: skill.title,
        host: 'unavailable',
        user: 'unavailable',
        exitCode: 1,
        stdout: '',
        stderr: '',
        error: errorMessage,
        executedAt: new Date().toISOString(),
      };
    }

    const outputParts = [];
    if (skillResult.summary && skillResult.summary.trim()) {
      outputParts.push(skillResult.summary.trim());
    } else {
      if (skillResult.success) {
        outputParts.push(`${skillResult.title} completed on ${skillResult.host}.`);
      } else {
        outputParts.push(`${skillResult.title} finished with issues.`);
      }
      if (skillResult.error) {
        outputParts.push(`Error: ${skillResult.error}`);
      }
      if (skillResult.stdout?.trim()) {
        outputParts.push(skillResult.stdout.trim());
      }
      if (skillResult.stderr?.trim()) {
        outputParts.push(`STDERR:\n${skillResult.stderr.trim()}`);
      }
    }

    const assistantText = outputParts.join('\n\n').slice(0, 8000);

    setMessages(prev => [
      ...prev,
      {
        id: nextId(),
        role: 'ai',
        text: assistantText || `${skill.title} completed.`,
      },
    ]);

    await persistConversationTurn(
      'assistant',
      assistantText || `${skill.title} completed.`,
      {
        source: 'openclaw-skill-result',
        skillId: skill.id,
        success: skillResult.success,
        host: skillResult.host,
        exitCode: skillResult.exitCode,
      },
      sessionId
    );

    setStatusMessage(
      skillResult.success
        ? `${skill.title} completed on ${skillResult.host}.`
        : `${skill.title} completed with warnings.`
    );
    setStatusLevel(skillResult.success ? 'neutral' : 'error');

    await loadConversations();
    setRunningSkillId(null);
    setIsSending(false);
  };

  const handleLogout = () => {
    window.localStorage.removeItem(USER_ID_STORAGE_KEY);
    window.location.reload();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        id="file-upload"
        style={{ display: 'none' }}
        onChange={event => handleFileSelect(event, 'file')}
      />
      <input
        ref={imageInputRef}
        type="file"
        id="image-upload"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={event => handleFileSelect(event, 'image')}
      />

      <div className="sidebar-overlay" onClick={closeSidebar} />
      <aside className="sidebar" id="sidebar">
        <div className="sidebar-header">
          <i className="fas fa-cube" style={{ color: 'var(--accent)' }} />
          OpenMax
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${sidebarTab === 'skills' ? 'active' : ''}`}
            type="button"
            onClick={() => setSidebarTab('skills')}
          >
            <span>
              <i className="fas fa-layer-group" />
              Skills
            </span>
          </button>
          <button
            className={`nav-item ${sidebarTab === 'execution' ? 'active' : ''}`}
            type="button"
            onClick={() => setSidebarTab('execution')}
          >
            <span>
              <i className="fas fa-list-check" />
              Execution List
            </span>
            <span className="todo-tag">TODO</span>
          </button>
          <button
            className={`nav-item ${sidebarTab === 'settings' ? 'active' : ''}`}
            type="button"
            onClick={() => setSidebarTab('settings')}
          >
            <span>
              <i className="fas fa-gear" />
              Settings
            </span>
          </button>
          <button
            className={`nav-item ${sidebarTab === 'customization' ? 'active' : ''}`}
            type="button"
            onClick={() => setSidebarTab('customization')}
          >
            <span>
              <i className="fas fa-sliders" />
              Costumization
            </span>
          </button>
          <button
            className={`nav-item ${sidebarTab === 'profile' ? 'active' : ''}`}
            type="button"
            onClick={() => setSidebarTab('profile')}
          >
            <span>
              <i className="fas fa-user" />
              Profile
            </span>
          </button>
        </nav>

        <div className="sidebar-panel">
          {sidebarTab === 'skills' && (
            <div className="panel-content">
              <div className="panel-title">OpenClaw Instant Skills</div>
              <p className="panel-subtitle">Tap once and OpenMax builds the request for you.</p>
              <div className="skills-list">
                {OPENCLAW_INSTANT_SKILLS.map(skill => (
                  <button
                    key={skill.id}
                    type="button"
                    className="skill-action"
                    onClick={() => void runInstantSkill(skill)}
                    disabled={isSending}
                  >
                    <span>
                      <i className={`fas ${skill.icon}`} />
                      {skill.title}
                    </span>
                    <i
                      className={`fas ${
                        runningSkillId === skill.id ? 'fa-spinner fa-spin' : 'fa-chevron-right'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {sidebarTab === 'execution' && (
            <div className="panel-content">
              <div className="panel-title-row">
                <span className="panel-title">Execution List</span>
                <button type="button" className="panel-action" onClick={handleStartNewConversation}>
                  New
                </button>
              </div>
              <p className="panel-subtitle">Saved conversations are loaded from the API memory store.</p>

              <form className="search-form" onSubmit={handleSearchSubmit}>
                <input
                  type="text"
                  className="sidebar-input"
                  placeholder="Search all chat memory"
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                />
                <button type="submit" className="panel-action">
                  Search
                </button>
              </form>

              {isSearching && <div className="panel-note">Searching…</div>}

              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map(result => (
                    <button
                      type="button"
                      key={`${result.id}-${result.session_id}`}
                      className="search-result-item"
                      onClick={() => void handleOpenConversation(result.session_id)}
                    >
                      <strong>{result.title?.trim() || 'Conversation'}</strong>
                      <span>{result.content}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="conversation-list">
                {conversations.length === 0 && <div className="panel-note">No conversations yet.</div>}
                {conversations.map(conversation => (
                  <div
                    className={`conversation-item ${
                      currentSessionId === conversation.session_id ? 'active' : ''
                    }`}
                    key={conversation.session_id}
                  >
                    {renameSessionId === conversation.session_id ? (
                      <div className="rename-wrap">
                        <input
                          type="text"
                          className="sidebar-input"
                          value={renameValue}
                          onChange={event => setRenameValue(event.target.value)}
                        />
                        <div className="inline-actions">
                          <button
                            type="button"
                            className="panel-action"
                            onClick={() => void saveRenameConversation(conversation.session_id)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="panel-action secondary"
                            onClick={() => {
                              setRenameSessionId(null);
                              setRenameValue('');
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="conversation-main"
                          onClick={() => void handleOpenConversation(conversation.session_id)}
                        >
                          <span className="conversation-title">{formatConversationTitle(conversation)}</span>
                          <span className="conversation-meta">{formatTime(conversation.updated_at)}</span>
                        </button>
                        <button
                          type="button"
                          className="conversation-edit-btn"
                          onClick={() => beginRenameConversation(conversation)}
                        >
                          <i className="fas fa-pen" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sidebarTab === 'settings' && (
            <div className="panel-content">
              <div className="panel-title">Settings</div>
              <p className="panel-subtitle">Conversation controls for everyday use.</p>
              <button type="button" className="skill-action single" onClick={handleStartNewConversation}>
                <span>
                  <i className="fas fa-plus" />
                  Start New Conversation
                </span>
              </button>
              {currentConversation && (
                <button
                  type="button"
                  className="skill-action single"
                  onClick={() => beginRenameConversation(currentConversation)}
                >
                  <span>
                    <i className="fas fa-pen" />
                    Rename Current Conversation
                  </span>
                </button>
              )}
            </div>
          )}

          {sidebarTab === 'customization' && (
            <div className="panel-content">
              <div className="panel-title">Costumization</div>
              <p className="panel-subtitle">One-tap personalization for non-developers.</p>
              <button
                type="button"
                className="skill-action single"
                onClick={() => setIsLightMode(prev => !prev)}
              >
                <span>
                  <i className={`fas ${isLightMode ? 'fa-moon' : 'fa-sun'}`} />
                  Switch to {isLightMode ? 'Dark' : 'Light'} Mode
                </span>
              </button>
            </div>
          )}

          {sidebarTab === 'profile' && (
            <div className="panel-content">
              <div className="panel-title">Profile</div>
              <p className="panel-subtitle">Your OpenMax profile is created automatically.</p>
              <div className="profile-card">
                <span>User ID</span>
                <strong>{currentUser}</strong>
                <span>Session</span>
                <strong>{currentSessionId ?? 'No active conversation'}</strong>
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <button className="logout-btn" id="logout-btn" type="button" onClick={handleLogout}>
            <i className="fas fa-right-from-bracket" />
            Logout
          </button>
        </div>
      </aside>

      <header>
        <div className="header-left">
          <button
            type="button"
            className="icon-btn"
            id="menu-trigger"
            onClick={event => {
              event.stopPropagation();
              setIsSidebarOpen(prev => !prev);
            }}
          >
            <i className="fas fa-bars" />
          </button>
          <div className="brand">OpenMax</div>
        </div>

        <div className="header-right">
          <button
            type="button"
            className="icon-btn"
            id="theme-btn"
            onClick={() => setIsLightMode(prev => !prev)}
          >
            <i className={`fas ${isLightMode ? 'fa-moon' : 'fa-sun'}`} />
          </button>
          <button
            type="button"
            className="icon-btn"
            id="voice-mode-trigger"
            onClick={() => setIsVoiceOverlayOpen(true)}
          >
            <i className="fas fa-headphones" />
          </button>
        </div>
      </header>

      <div className="content-area" id="chat-feed" ref={chatFeedRef}>
        {(statusMessage || isLoading) && (
          <div className={`status-banner ${statusLevel === 'error' ? 'error' : ''}`}>
            {statusMessage || 'Syncing with API...'}
          </div>
        )}

        <div className={`hero ${messages.length > 0 ? 'hidden' : ''}`} id="hero">
          <div className="logo-orb" />
          <h3>How can I help?</h3>
        </div>

        {messages.map(message => (
          <div key={message.id} className={`message ${message.role === 'ai' ? 'ai' : 'user'}`}>
            {message.role !== 'ai' && message.attachments?.length ? (
              <>
                {message.attachments.map(file =>
                  file.type === 'image' && file.src ? (
                    <img src={file.src} alt={file.name} key={`${message.id}-${file.id}`} />
                  ) : (
                    <div className="file-attachment" key={`${message.id}-${file.id}`}>
                      <i className={`fas ${file.type === 'image' ? 'fa-image' : 'fa-file'}`} />
                      {file.name}
                    </div>
                  )
                )}
              </>
            ) : null}

            {message.role === 'ai' ? (
              <>
                <i className="fas fa-cube" style={{ marginRight: '5px', color: 'var(--accent)' }} />
                {message.text}
              </>
            ) : (
              <>{message.text && <div>{message.text}</div>}</>
            )}

            {message.timestamp && <div className="message-time">{formatTime(message.timestamp)}</div>}
          </div>
        ))}
      </div>

      <div className={`attach-menu ${isAttachMenuOpen ? 'open' : ''}`} ref={attachMenuRef}>
        <button type="button" className="menu-item" onClick={() => triggerUpload('image')}>
          <i className="fas fa-image" style={{ color: '#4ade80' }} /> Photos
        </button>
        <button type="button" className="menu-item" onClick={() => triggerUpload('file')}>
          <i className="fas fa-paperclip" style={{ color: '#f472b6' }} /> Document
        </button>
      </div>

      <div className="input-wrapper">
        <div className={`preview-area ${attachedFiles.length > 0 ? 'active' : ''}`} id="preview-area">
          {attachedFiles.map(file => (
            <div className="preview-item" key={file.id}>
              {file.type === 'image' ? (
                <>
                  <img src={file.src} alt={file.name} />
                  <span>Image</span>
                </>
              ) : (
                <>
                  <i className="fas fa-file-alt" style={{ color: 'var(--text-sub)' }} />
                  <span>{file.name.length > 10 ? `${file.name.substring(0, 10)}...` : file.name}</span>
                </>
              )}

              <button
                type="button"
                className="remove-preview"
                onClick={() => removeAttachment(file.id)}
                aria-label={`Remove ${file.name}`}
              >
                <i className="fas fa-times" />
              </button>
            </div>
          ))}
        </div>

        <div className="input-bar">
          <button
            type="button"
            className="btn-circle"
            id="plus-btn"
            ref={plusBtnRef}
            onClick={event => {
              event.stopPropagation();
              setIsAttachMenuOpen(prev => !prev);
            }}
          >
            <i className={`fas ${isAttachMenuOpen ? 'fa-times' : 'fa-plus'}`} />
          </button>

          <textarea
            ref={textFieldRef}
            className="text-field"
            id="user-input"
            rows={1}
            placeholder={isRecording ? 'Listening...' : 'Message...'}
            value={inputValue}
            onChange={event => setInputValue(event.target.value)}
            onKeyDown={handleInputKeyDown}
          />

          <button
            type="button"
            className={`btn-circle action-btn ${isRecording && !showSendButton ? 'recording' : ''}`}
            id="action-btn"
            onClick={handleActionButton}
            disabled={isSending}
          >
            <i className={`fas ${showSendButton ? 'fa-arrow-up' : 'fa-microphone'}`} />
          </button>
        </div>
      </div>

      <div
        className={`voice-overlay ${isVoiceOverlayOpen ? 'active' : ''}`}
        id="voice-overlay"
        onClick={() => setIsVoiceOverlayOpen(false)}
      >
        <div className="voice-visualizer">
          <i className="fas fa-microphone" style={{ color: 'white', fontSize: '30px' }} />
        </div>
        <div style={{ marginTop: '30px', color: 'var(--text-sub)' }}>Listening... Tap to close</div>
      </div>
    </>
  );
}

export default App;
