/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useRef, useState, useEffect } from 'react';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { useLogStore, useUI } from '@/lib/state';

export default function ChatInput() {
    const { client, connected } = useLiveAPIContext();
    const [text, setText] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [text]);

    const handleSend = async () => {
        if (!text.trim() && files.length === 0) return;

        // 1. Send Text + Notifications for files
        const parts: any[] = [];
        if (text.trim()) {
            parts.push({ text: text.trim() });
            useLogStore.getState().addTurn({
                role: 'user',
                text: text.trim(),
                isFinal: true,
            });
        }

        if (files.length > 0) {
            for (const file of files) {
                const base64 = await fileToBase64(file);
                const mimeType = file.type;

                // Save to global shared state
                useUI.getState().addSharedFile({
                    name: file.name,
                    type: mimeType,
                    data: base64
                });

                // Notify AI about the file
                const notification = `[SYSTEM • UPLOAD]: Milord has pointed you to a new file: "${file.name}" (${mimeType}). It is now in your local workspace. [sighs] You can use 'bring_to_vps' to move it to the server if required.`;
                parts.push({ text: notification });

                useLogStore.getState().addTurn({
                    role: 'user',
                    text: `[Sent File]: ${file.name} (${mimeType})`,
                    isFinal: true,
                });
            }
        }

        if (parts.length > 0) {
            client.send(parts);
        }

        setText('');
        setFiles([]);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
        // content reset
        e.target.value = '';
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64String = (reader.result as string).split(',')[1];
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const isChatInputOpen = useUI(state => state.isChatInputOpen);

    if (!connected || !isChatInputOpen) return null;

    return (
        <div className="chat-input-container">
            {/* File Previews */}
            {files.length > 0 && (
                <div className="file-preview-list">
                    {files.map((file, i) => (
                        <div key={i} className="file-preview-item">
                            <span className="material-symbols-outlined file-preview-icon">description</span>
                            <span className="file-name">{file.name}</span>
                            <button
                                onClick={() => removeFile(i)}
                                className="remove-file-btn"
                                aria-label="Remove file"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <div className="chat-input-row">
                <button
                    className="tray-action-btn attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach file"
                    aria-label="Attach file"
                >
                    <span className="material-symbols-outlined">add_circle</span>
                </button>
                <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                    title="File upload"
                />

                <div className="textarea-wrapper">
                    <textarea
                        ref={textareaRef}
                        className="chat-textarea"
                        rows={1}
                        placeholder="Milord, type a message or upload files..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        title="Message input"
                    />
                </div>

                <button
                    className="tray-action-btn send-btn"
                    onClick={handleSend}
                    disabled={!text.trim() && files.length === 0}
                    title="Send"
                    aria-label="Send message"
                >
                    <span className="material-symbols-outlined">send</span>
                </button>
            </div>
        </div>
    );
}
