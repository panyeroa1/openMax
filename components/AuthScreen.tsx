
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../lib/state';
import './AuthScreen.css';

const AuthScreen: React.FC = () => {
    const { login } = useAuth();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [welcomeUser, setWelcomeUser] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const success = login(password);

        if (success) {
            const user = password === 'KIER120221' ? 'Master' : 'Milord';
            setWelcomeUser(user);
            setIsSuccess(true);

            // Play voice greeting using Web Speech API
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(`Welcome, ${user}`);
                utterance.rate = 0.9;
                utterance.pitch = 1.0;
                window.speechSynthesis.speak(utterance);
            }
        } else {
            setError('ACCESS DENIED');
            setPassword('');
            inputRef.current?.focus();
        }
    };

    if (isSuccess) {
        return (
            <div className="auth-screen success">
                <div className="glass-shatter-container">
                    {[...Array(20)].map((_, i) => (
                        <div key={i} className={`glass-shard shard-${i}`}></div>
                    ))}
                </div>
                <div className="success-content">
                    <div className="access-granted-text glitch" data-text="ACCESS GRANTED">
                        ACCESS GRANTED
                    </div>
                    <div className="welcome-text">Welcome, {welcomeUser}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-screen">
            <div className="auth-container">
                <div className="auth-logo">
                    <span className="material-symbols-outlined logo-icon">terminal</span>
                    <div className="logo-text">
                        <h1>OPENMAX <span>EBURON AI</span></h1>
                    </div>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="input-group">
                        <span className="material-symbols-outlined input-icon">lock</span>
                        <input
                            ref={inputRef}
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter Access Code"
                            className="auth-input"
                            autoComplete="off"
                        />
                    </div>

                    {error && <div className="auth-error">{error}</div>}

                    <button type="submit" className="auth-button">
                        <span className="material-symbols-outlined">login</span>
                        <span>AUTHENTICATE</span>
                    </button>
                </form>

                <div className="auth-footer">
                    <span className="security-badge">
                        <span className="material-symbols-outlined">shield</span>
                        SECURE TERMINAL v2026.2.2
                    </span>
                </div>
            </div>
        </div>
    );
};

export default AuthScreen;
