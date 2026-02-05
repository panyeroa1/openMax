/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../lib/state';

const API_BASE_URL = '/api';

export interface Message {
    id: number;
    conversation_id: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    metadata?: any;
}

export interface Conversation {
    id: number;
    user_id: string;
    session_id: string;
    title?: string;
    created_at: string;
    updated_at: string;
}

export const useConversationMemory = () => {
    const { currentUser } = useAuth();
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Start new conversation
    const startConversation = useCallback(async (title?: string) => {
        if (!currentUser) return null;

        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch(`${API_BASE_URL}/api/conversations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser, title }),
            });

            if (!response.ok) throw new Error('Failed to create conversation');

            const conversation: Conversation = await response.json();
            setCurrentSessionId(conversation.session_id);
            setConversationHistory([]);

            return conversation.session_id;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            setError(errorMsg);
            console.error('Error starting conversation:', err);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    // Save message to database
    const saveMessage = useCallback(async (
        role: 'user' | 'assistant' | 'system',
        content: string,
        metadata?: any
    ) => {
        if (!currentSessionId) {
            console.warn('No active session. Creating new conversation...');
            const sessionId = await startConversation();
            if (!sessionId) return null;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: currentSessionId,
                    role,
                    content,
                    metadata,
                }),
            });

            if (!response.ok) throw new Error('Failed to save message');

            const message: Message = await response.json();
            setConversationHistory(prev => [...prev, message]);

            return message;
        } catch (err) {
            console.error('Error saving message:', err);
            return null;
        }
    }, [currentSessionId, startConversation]);

    // Load conversation history
    const loadConversation = useCallback(async (sessionId: string) => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch(`${API_BASE_URL}/api/messages/${sessionId}`);

            if (!response.ok) throw new Error('Failed to load conversation');

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

    // Load user's conversations list
    const loadConversations = useCallback(async (limit = 50) => {
        if (!currentUser) return;

        try {
            setIsLoading(true);
            const response = await fetch(
                `${API_BASE_URL}/api/conversations/${currentUser}?limit=${limit}`
            );

            if (!response.ok) throw new Error('Failed to load conversations');

            const data: Conversation[] = await response.json();
            setConversations(data);

            return data;
        } catch (err) {
            console.error('Error loading conversations:', err);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    // Search across all messages
    const searchMessages = useCallback(async (query: string, limit = 50) => {
        if (!currentUser || !query) return [];

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/search?userId=${currentUser}&query=${encodeURIComponent(query)}&limit=${limit}`
            );

            if (!response.ok) throw new Error('Failed to search messages');

            return await response.json();
        } catch (err) {
            console.error('Error searching messages:', err);
            return [];
        }
    }, [currentUser]);

    // Update conversation title
    const updateTitle = useCallback(async (sessionId: string, title: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/conversation/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title }),
            });

            if (!response.ok) throw new Error('Failed to update title');

            // Refresh conversations list
            await loadConversations();
        } catch (err) {
            console.error('Error updating title:', err);
        }
    }, [loadConversations]);

    // Load user's conversations on mount
    useEffect(() => {
        if (currentUser) {
            loadConversations();
        }
    }, [currentUser, loadConversations]);

    return {
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
