/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const USER_ID_STORAGE_KEY = 'openmax_user_id';

const buildApiUrl = (path: string) => `${API_BASE_URL}${path}`;

const getOrCreateUserId = () => {
  if (typeof window === 'undefined') {
    return `openmax-${uuidv4()}`;
  }

  const existing = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = `openmax-${uuidv4()}`;
  window.localStorage.setItem(USER_ID_STORAGE_KEY, created);
  return created;
};

export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: number;
  user_id: string;
  session_id: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

export interface SearchResult extends Message {
  session_id: string;
  title?: string;
}

export const useConversationMemory = () => {
  const [currentUser] = useState(getOrCreateUserId);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startConversation = useCallback(
    async (title?: string) => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(buildApiUrl('/api/conversations'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser, title }),
        });

        if (!response.ok) {
          throw new Error('Failed to create conversation');
        }

        const conversation: Conversation = await response.json();
        setCurrentSessionId(conversation.session_id);
        setConversationHistory([]);

        setConversations(prev => {
          const filtered = prev.filter(item => item.session_id !== conversation.session_id);
          return [conversation, ...filtered];
        });

        return conversation.session_id;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        console.error('Error starting conversation:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [currentUser]
  );

  const saveMessage = useCallback(
    async (
      role: 'user' | 'assistant' | 'system',
      content: string,
      metadata?: Record<string, unknown>,
      sessionIdOverride?: string
    ) => {
      let targetSessionId = sessionIdOverride ?? currentSessionId;

      if (!targetSessionId) {
        targetSessionId = await startConversation();
      }

      if (!targetSessionId) {
        console.error('Unable to save message because conversation session was not created.');
        return null;
      }

      try {
        const response = await fetch(buildApiUrl('/api/messages'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: targetSessionId,
            role,
            content,
            metadata,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save message');
        }

        const message: Message = await response.json();

        setCurrentSessionId(targetSessionId);
        setConversationHistory(prev => [...prev, message]);

        return message;
      } catch (err) {
        console.error('Error saving message:', err);
        return null;
      }
    },
    [currentSessionId, startConversation]
  );

  const loadConversation = useCallback(async (sessionId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(buildApiUrl(`/api/messages/${sessionId}`));

      if (!response.ok) {
        throw new Error('Failed to load conversation');
      }

      const messages: Message[] = await response.json();
      setCurrentSessionId(sessionId);
      setConversationHistory(messages);

      return messages;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Error loading conversation:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadConversations = useCallback(
    async (limit = 50) => {
      try {
        setIsLoading(true);

        const response = await fetch(
          buildApiUrl(`/api/conversations/${currentUser}?limit=${limit}`)
        );

        if (!response.ok) {
          throw new Error('Failed to load conversations');
        }

        const data: Conversation[] = await response.json();
        setConversations(data);

        return data;
      } catch (err) {
        console.error('Error loading conversations:', err);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [currentUser]
  );

  const searchMessages = useCallback(
    async (query: string, limit = 50) => {
      if (!query.trim()) {
        return [] as SearchResult[];
      }

      try {
        const response = await fetch(
          buildApiUrl(
            `/api/search?userId=${encodeURIComponent(currentUser)}&query=${encodeURIComponent(query)}&limit=${limit}`
          )
        );

        if (!response.ok) {
          throw new Error('Failed to search messages');
        }

        return (await response.json()) as SearchResult[];
      } catch (err) {
        console.error('Error searching messages:', err);
        return [] as SearchResult[];
      }
    },
    [currentUser]
  );

  const updateTitle = useCallback(
    async (sessionId: string, title: string) => {
      try {
        const response = await fetch(buildApiUrl(`/api/conversation/${sessionId}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        });

        if (!response.ok) {
          throw new Error('Failed to update title');
        }

        const updated: Conversation = await response.json();
        setConversations(prev =>
          prev.map(item => (item.session_id === updated.session_id ? updated : item))
        );
      } catch (err) {
        console.error('Error updating title:', err);
      }
    },
    []
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return {
    currentUser,
    currentSessionId,
    conversationHistory,
    conversations,
    isLoading,
    error,
    startConversation,
    saveMessage,
    loadConversation,
    loadConversations,
    searchMessages,
    updateTitle,
  };
};
