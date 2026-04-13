/**
 * src/src/components/AI/AIChat.jsx
 *
 * Floating AI assistant chat panel.
 * Accessible from any page via a fixed button in the bottom-right corner.
 * Connects to POST /api/ai/chat on the Express backend.
 */

import { useState, useRef, useEffect } from 'react';
import { sendAIMessage } from '../../services/aiService';

// Simple markdown-lite renderer: bold, bullet lists, line breaks
function renderMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^\s*[-•]\s+(.+)/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/gs, '<ul class="list-disc list-inside my-1">$1</ul>')
        .replace(/\n/g, '<br/>');
}

// Formatting helper for message timestamps
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Suggested quick prompts shown when chat is empty
const QUICK_PROMPTS = [
    'Show me tenants who haven\'t paid rent',
    'List all active tenants',
    'Show current debtors and amounts owed',
];

export default function AIChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);   // [{role, content, ts}]
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-scroll to the latest message
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Focus input when panel opens
    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    /** Build history array for multi-turn context (last 10 messages) */
    function buildHistory() {
        const relevant = messages.slice(-10);
        return relevant.map(m => ({ role: m.role, content: m.content }));
    }

    /** Send a message to the AI */
    async function sendMessage(text) {
        const trimmed = (text || input).trim();
        if (!trimmed || isLoading) return;

        setInput('');
        setError(null);

        // Optimistically append user message
        const userMsg = { role: 'user', content: trimmed, ts: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const history = buildHistory();
            const data = await sendAIMessage(trimmed, history);

            const aiMsg = {
                role: 'assistant',
                content: data.response,
                ts: new Date()
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (err) {
            const errText = err?.response?.data?.error || 'Something went wrong. Please try again.';
            setError(errText);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: errText,
                ts: new Date(),
                isError: true
            }]);
        } finally {
            setIsLoading(false);
        }
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    function clearChat() {
        setMessages([]);
        setError(null);
    }

    return (
        <>
            {/* ── Floating Launcher Button ── */}
            <button
                onClick={() => setIsOpen(o => !o)}
                title="AI Assistant"
                className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
            >
                {isOpen ? (
                    /* Close icon */
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    /* Sparkle / AI icon */
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                            d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                    </svg>
                )}
                {/* Pulse ring when closed */}
                {!isOpen && (
                    <span className="absolute w-full h-full rounded-full animate-ping opacity-20"
                        style={{ background: '#6366f1' }} />
                )}
            </button>

            {/* ── Chat Panel ── */}
            {isOpen && (
                <div
                    className="fixed bottom-24 right-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
                    style={{ width: '380px', height: '560px', border: '1px solid rgba(99,102,241,0.2)' }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3"
                        style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
                            <span className="font-semibold text-white text-sm">AI Rental Assistant</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {messages.length > 0 && (
                                <button
                                    onClick={clearChat}
                                    className="text-white/70 hover:text-white text-xs underline transition-colors"
                                >
                                    Clear
                                </button>
                            )}
                            <button onClick={() => setIsOpen(false)}
                                className="text-white/70 hover:text-white transition-colors p-1 rounded">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Message List */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">

                        {/* Empty state with quick prompts */}
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center pt-6 gap-4">
                                <div className="w-14 h-14 rounded-full flex items-center justify-center"
                                    style={{ background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' }}>
                                    <svg className="w-7 h-7 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                                            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                                    </svg>
                                </div>
                                <p className="text-gray-500 text-sm text-center leading-relaxed">
                                    Ask me anything about your tenants, rent, or maintenance requests.
                                </p>
                                <div className="w-full space-y-2">
                                    {QUICK_PROMPTS.map(p => (
                                        <button
                                            key={p}
                                            onClick={() => sendMessage(p)}
                                            className="w-full text-left text-sm px-3 py-2 rounded-lg bg-white border border-indigo-100 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm"
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Messages */}
                        {messages.map((msg, idx) => (
                            <div key={idx}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm
                                    ${msg.role === 'user'
                                        ? 'text-white rounded-br-sm'
                                        : msg.isError
                                            ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
                                            : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
                                    }`}
                                    style={msg.role === 'user'
                                        ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }
                                        : {}}>
                                    <div
                                        className="leading-relaxed"
                                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                                    />
                                    <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-white/60 text-right' : 'text-gray-400'}`}>
                                        {formatTime(msg.ts)}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                                    <div className="flex gap-1.5 items-center h-4">
                                        {[0, 1, 2].map(i => (
                                            <span key={i}
                                                className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                                                style={{ animationDelay: `${i * 0.15}s` }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </div>

                    {/* Input Bar */}
                    <div className="px-3 py-3 bg-white border-t border-gray-100">
                        <div className="flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask the AI assistant…"
                                rows={1}
                                disabled={isLoading}
                                className="flex-1 bg-transparent resize-none text-sm text-gray-800 placeholder-gray-400 outline-none max-h-24"
                                style={{ lineHeight: '1.5' }}
                            />
                            <button
                                onClick={() => sendMessage()}
                                disabled={!input.trim() || isLoading}
                                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
                                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                            >
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                                        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 text-center">
                            Powered by Ollama · Runs 100% offline
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
