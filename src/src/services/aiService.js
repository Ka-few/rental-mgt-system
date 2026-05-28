/**
 * src/src/services/aiService.js
 * HTTP client for the backend AI chat endpoint.
 */

import api from './api';

/**
 * Send a message to the AI agent and stream back the response.
 * @param {string} userInput - The current user message
 * @param {Array}  history   - Previous messages [{role, content}] for multi-turn context
 * @param {Function} onChunk - Callback fired when a new chunk of text stream arrives
 * @returns {Promise<void>}
 */
export const streamAIMessage = async (userInput, history = [], onChunk) => {
    // We cannot use axios easily for SSE, so we use native fetch
    // Replace /api with the base URL configured in axios
    const baseURL = api.defaults.baseURL || '/api';

    const token = localStorage.getItem('token');

    const response = await fetch(`${baseURL}/ai/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ userInput, messages: history })
    });

    if (!response.ok) {
        let errorMsg = 'Failed to connect to AI service';
        try {
            const data = await response.json();
            if (data.error) errorMsg = data.error;
        } catch (e) { }
        throw new Error(errorMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let lines = buffer.split('\n');
        buffer = lines.pop(); // save remainder

        for (let line of lines) {
            line = line.trim();
            if (!line.startsWith('data: ')) continue;

            const dataStr = line.substring(6);
            if (dataStr === '[DONE]') {
                return; // Stream finished
            }

            try {
                const parsed = JSON.parse(dataStr);
                if (parsed.error) {
                    throw new Error(parsed.error);
                }
                if (parsed.text) {
                    onChunk(parsed.text);
                }
            } catch (err) {
                // Only swallow SyntaxErrors from incomplete/malformed chunks;
                // re-throw real errors (e.g. server-sent error messages)
                if (!(err instanceof SyntaxError)) {
                    throw err;
                }
            }
        }
    }
};
