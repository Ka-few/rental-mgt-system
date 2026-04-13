/**
 * src/src/services/aiService.js
 * HTTP client for the backend AI chat endpoint.
 */

import api from './api';

/**
 * Send a message to the AI agent.
 * @param {string} userInput - The current user message
 * @param {Array}  history   - Previous messages [{role, content}] for multi-turn context
 * @returns {Promise<{response: string, userMessage: string}>}
 */
export const sendAIMessage = async (userInput, history = []) => {
    const response = await api.post('/ai/chat', {
        userInput,
        messages: history
    });
    return response.data;
};
