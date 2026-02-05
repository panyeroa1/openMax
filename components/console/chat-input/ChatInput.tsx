/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useRef, useState, useEffect } from 'react';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { useLogStore } from '@/lib/state';

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

        // 1. Send Text
        if (text.trim()) {
            client.send([{ text: text.trim() }]);
            useLogStore.getState().addTurn({
                role: 'user',
                text: text.trim(),
                isFinal: true,
            });
        }

        // 2. Send Files
        if (files.length > 0) {
            for (const file of files) {
                const base64 = await fileToBase64(file);
                const mimeType = file.type;

                // Log the file upload for visibility
                useLogStore.getState().addTurn({
                    role: 'user',
                    text: `[Sent File]: ${file.name} (${mimeType})`,
                    isFinal: true,
                });

                // Send as RealtimeInput (media) if supported, or inline data part
                // Using sendRealtimeInput for media chunks is typical for this client
                client.sendRealtimeInput([{
                    mimeType: mimeType,
                    data: base64
                }]);
            }
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

    if (!connected) return null;

    return (
        <div className="chat-input-container">
            {/* File Previews */}
            {files.length > 0 && (
                <div className="file-preview-list">
                    {files.map((file, i) => (
                        <div key={i} className="file-preview-item">
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
                    className="icon-button attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach file"
                    aria-label="Attach file"
                >
                    <span className="material-symbols-outlined">attach_file</span>
                </button>
                <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                    title="File upload"
                />

                <textarea
                    ref={textareaRef}
                    className="chat-textarea"
                    rows={1}
                    placeholder="Type a message to Orbit..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    title="Message input"
                />

                <button
                    className="icon-button send-btn"
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
