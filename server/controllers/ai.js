/**
 * server/controllers/ai.js
 *
 * AI Controller — supports two providers:
 *   1. Groq  (AI_PROVIDER=groq)  — fast cloud inference, free tier, requires GROQ_API_KEY
 *   2. Ollama (AI_PROVIDER=ollama) — local inference, no key needed (default fallback)
 *
 * Flow:
 *  1. Receive user message via POST /api/ai/chat
 *  2. Build messages with system prompt + conversation history
 *  3. Call chosen provider (streaming)
 *  4. If Ollama returns tool_calls, execute the SQLite function and loop
 *     If Groq returns tool_calls, execute the SQLite function and loop
 *  5. Return final text response to the client via SSE
 */

const axios = require('axios');
const { db } = require('../db/init');
const crypto = require('crypto');

// ─────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────
const AI_PROVIDER = (process.env.AI_PROVIDER || 'ollama').toLowerCase(); // 'groq' | 'ollama'
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant'; // fast Groq-hosted model
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'phi3:mini';

const logAi = (...args) => console.log('[AI Assistant]', ...args);
const errorAi = (...args) => console.error('[AI Assistant ERROR]', ...args);

// ─────────────────────────────────────────
// System Prompt
// ─────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert rental property management assistant for a Kenyan rental business.
Your job is to help property managers quickly retrieve tenant information, check who owes rent, record payments, and log maintenance requests.

RULES:
- Always call the most appropriate tool instead of guessing data from memory.
- When a user asks about unpaid rent or debtors, call get_debtors.
- When a user asks about all tenants, call get_tenants.
- When recording a payment, always confirm the tenant name and amount before calling record_payment.
- For maintenance issues, gather the location/unit and description, then call create_maintenance_request.
- Format currency in KES (Kenyan Shillings).
- Keep responses concise and clear. Use bullet points for lists.
- If a tool call fails, explain the issue politely and suggest next steps.`;

// ─────────────────────────────────────────
// Tool Definitions
// ─────────────────────────────────────────
const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'get_tenants',
            description: 'Fetch a list of all tenants from the database. Returns name, phone, house, and status.',
            parameters: {
                type: 'object',
                properties: {
                    status: {
                        type: 'string',
                        description: 'Optional filter: "Active", "Vacated", or "Arrears". Omit for all tenants.',
                        enum: ['Active', 'Vacated', 'Arrears']
                    }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_debtors',
            description: 'Fetch all tenants who currently have an outstanding balance (debt > 0). Returns tenant name, house, and balance owed.',
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'record_payment',
            description: 'Record a rent payment for a specific tenant by their name or ID.',
            parameters: {
                type: 'object',
                properties: {
                    tenant_name: { type: 'string', description: 'The full name of the tenant (partial match is supported).' },
                    amount: { type: 'number', description: 'The payment amount in KES.' },
                    payment_method: {
                        type: 'string',
                        description: 'Payment method.',
                        enum: ['MPESA', 'Cash', 'Bank Transfer', 'Cheque']
                    },
                    reference_code: { type: 'string', description: 'Optional MPESA or transaction reference code.' }
                },
                required: ['tenant_name', 'amount']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_maintenance_request',
            description: 'Log a new maintenance/repair request for a specific house or unit.',
            parameters: {
                type: 'object',
                properties: {
                    house_number: { type: 'string', description: 'The house or unit number (e.g. "B2", "Unit 5").' },
                    title: { type: 'string', description: 'Short title for the issue (e.g. "Leaking sink").' },
                    description: { type: 'string', description: 'Detailed description of the problem.' },
                    priority: { type: 'string', description: 'Issue priority.', enum: ['Low', 'Normal', 'High', 'Critical'] }
                },
                required: ['house_number', 'title', 'description']
            }
        }
    }
];

// ─────────────────────────────────────────
// Tool Implementations (SQLite)
// ─────────────────────────────────────────
function tool_get_tenants({ status } = {}) {
    try {
        let query = `
      SELECT t.id, t.full_name, t.phone, t.status, h.house_number, p.name AS property_name
      FROM tenants t
      LEFT JOIN houses h ON t.house_id = h.id
      LEFT JOIN properties p ON h.property_id = p.id
    `;
        const params = [];
        if (status) { query += ' WHERE t.status = ?'; params.push(status); }
        query += ' ORDER BY t.full_name';
        const rows = db.prepare(query).all(...params);
        if (!rows.length) return { result: 'No tenants found.' };
        if (rows.length > 15) return {
            tenants: rows.slice(0, 15),
            notice: `Only showing first 15 of ${rows.length} tenants.`
        };
        return { tenants: rows };
    } catch (err) { return { error: `Failed to fetch tenants: ${err.message}` }; }
}

function tool_get_debtors() {
    try {
        const rows = db.prepare(`
      SELECT t.id, t.full_name, t.phone, h.house_number, p.name AS property_name,
        ROUND(
          COALESCE(SUM(CASE WHEN tr.type != 'Payment' THEN tr.amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN tr.type  = 'Payment' THEN tr.amount ELSE 0 END), 0), 2
        ) AS balance_owed
      FROM tenants t
      LEFT JOIN houses h ON t.house_id = h.id
      LEFT JOIN properties p ON h.property_id = p.id
      LEFT JOIN transactions tr ON tr.tenant_id = t.id
      WHERE t.status = 'Active'
      GROUP BY t.id HAVING balance_owed > 0 ORDER BY balance_owed DESC
    `).all();
        if (!rows.length) return { result: 'No debtors found. All active tenants are up to date!' };
        if (rows.length > 15) return {
            debtors: rows.slice(0, 15),
            notice: `Only showing top 15 of ${rows.length} debtors.`
        };
        return { debtors: rows };
    } catch (err) { return { error: `Failed to fetch debtors: ${err.message}` }; }
}

function tool_record_payment({ tenant_name, amount, payment_method, reference_code }) {
    try {
        if (!tenant_name || !amount) return { error: 'tenant_name and amount are required.' };
        const tenant = db.prepare(
            `SELECT id, full_name FROM tenants WHERE full_name LIKE ? AND status = 'Active' LIMIT 1`
        ).get(`%${tenant_name}%`);
        if (!tenant) return { error: `No active tenant found matching "${tenant_name}".` };
        const paymentId = crypto.randomUUID();
        db.prepare(`
      INSERT INTO transactions (id, tenant_id, type, amount, payment_method, reference_code, description)
      VALUES (?, ?, 'Payment', ?, ?, ?, ?)
    `).run(paymentId, tenant.id, amount, payment_method || 'Cash', reference_code || null, `AI-recorded payment of KES ${amount}`);
        return { success: true, message: `Payment of KES ${amount} recorded for ${tenant.full_name}.`, transaction_id: paymentId };
    } catch (err) { return { error: `Failed to record payment: ${err.message}` }; }
}

function tool_create_maintenance_request({ house_number, title, description, priority }) {
    try {
        if (!house_number || !title || !description) return { error: 'house_number, title, and description are required.' };
        const house = db.prepare(
            `SELECT h.id, h.house_number, p.id AS property_id FROM houses h LEFT JOIN properties p ON h.property_id = p.id WHERE h.house_number LIKE ? LIMIT 1`
        ).get(`%${house_number}%`);
        if (!house) return { error: `No house found matching "${house_number}".` };
        const requestId = crypto.randomUUID();
        db.prepare(`
      INSERT INTO maintenance_requests (id, house_id, property_id, title, description, priority, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Open')
    `).run(requestId, house.id, house.property_id || null, title, description, priority || 'Normal');
        return { success: true, message: `Maintenance request "${title}" logged for Unit ${house.house_number}.`, request_id: requestId };
    } catch (err) { return { error: `Failed to create maintenance request: ${err.message}` }; }
}

const TOOL_HANDLERS = {
    get_tenants: tool_get_tenants,
    get_debtors: tool_get_debtors,
    record_payment: tool_record_payment,
    create_maintenance_request: tool_create_maintenance_request
};

function executeToolCalls(toolCalls) {
    return toolCalls.map((tc) => {
        const name = tc.function?.name;
        const handler = TOOL_HANDLERS[name];
        let result;
        if (!handler) {
            result = { error: `Unknown tool: ${name}` };
        } else {
            try {
                const args = typeof tc.function.arguments === 'string'
                    ? JSON.parse(tc.function.arguments)
                    : tc.function.arguments;
                result = handler(args || {});
            } catch (e) {
                result = { error: `Tool execution error: ${e.message}` };
            }
        }
        return { role: 'tool', name, content: JSON.stringify(result) };
    });
}

// ─────────────────────────────────────────
// GROQ Provider (OpenAI-compatible, streaming)
// ─────────────────────────────────────────
async function runAgentGroq(messages, res) {
    const MAX_ITERATIONS = 6;
    const conversationMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
    ];

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        // Groq uses the OpenAI streaming format
        const response = await axios.post(
            `${GROQ_BASE_URL}/chat/completions`,
            {
                model: GROQ_MODEL,
                messages: conversationMessages,
                tools: TOOLS,
                tool_choice: 'auto',
                stream: true,
                temperature: 0.1,
                max_tokens: 1024
            },
            {
                responseType: 'stream',
                timeout: 30000,
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let fullContent = '';
        let toolCallsMap = {};  // index -> {id, name, arguments}
        let isToolCall = false;

        await new Promise((resolve, reject) => {
            let buffer = '';
            response.data.on('data', chunk => {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (let line of lines) {
                    line = line.trim();
                    if (!line.startsWith('data: ')) continue;
                    const dataStr = line.substring(6);
                    if (dataStr === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(dataStr);
                        const delta = parsed.choices?.[0]?.delta;
                        if (!delta) continue;

                        if (delta.tool_calls) {
                            isToolCall = true;
                            delta.tool_calls.forEach(tc => {
                                const idx = tc.index ?? 0;
                                if (!toolCallsMap[idx]) {
                                    toolCallsMap[idx] = { id: tc.id || '', name: '', arguments: '' };
                                }
                                if (tc.function?.name) toolCallsMap[idx].name += tc.function.name;
                                if (tc.function?.arguments) toolCallsMap[idx].arguments += tc.function.arguments;
                            });
                        } else if (delta.content) {
                            fullContent += delta.content;
                            if (res) res.write(`data: ${JSON.stringify({ text: delta.content })}\n\n`);
                        }
                    } catch (e) { /* ignore malformed SSE chunks */ }
                }
            });
            response.data.on('end', resolve);
            response.data.on('error', reject);
        });

        if (isToolCall && Object.keys(toolCallsMap).length > 0) {
            const toolCallsArray = Object.values(toolCallsMap).map(tc => ({
                id: tc.id,
                type: 'function',
                function: { name: tc.name, arguments: tc.arguments }
            }));

            logAi(`Groq requested ${toolCallsArray.length} tool call(s): ${toolCallsArray.map(t => t.function.name).join(', ')}`);

            // Append assistant message with tool_calls for Groq's message format
            conversationMessages.push({
                role: 'assistant',
                content: null,
                tool_calls: toolCallsArray
            });

            // Execute tools and append results in OpenAI tool-result format
            const toolResults = toolCallsArray.map((tc) => {
                const name = tc.function?.name;
                const handler = TOOL_HANDLERS[name];
                let result;
                if (!handler) {
                    result = { error: `Unknown tool: ${name}` };
                } else {
                    try {
                        const args = typeof tc.function.arguments === 'string'
                            ? JSON.parse(tc.function.arguments)
                            : tc.function.arguments;
                        result = handler(args || {});
                    } catch (e) {
                        result = { error: `Tool execution error: ${e.message}` };
                    }
                }
                return {
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: JSON.stringify(result)
                };
            });

            conversationMessages.push(...toolResults);
            continue;
        }

        return fullContent || 'I could not generate a response.';
    }

    return 'I was unable to complete your request after several attempts.';
}

// ─────────────────────────────────────────
// Context Injection Fallback (for Ollama models that don't support tools)
// ─────────────────────────────────────────
function buildContextFromKeywords(userMessage) {
    const msg = userMessage.toLowerCase();
    const lines = [];

    if (/debt|owe|arrear|unpaid|balance|behind|haven|due/i.test(msg)) {
        const data = tool_get_debtors();
        if (data.debtors && data.debtors.length) {
            lines.push('DEBTORS (tenants who owe rent):');
            data.debtors.slice(0, 8).forEach(d =>
                lines.push(`- ${d.full_name} | Unit ${d.house_number} | Owes KES ${d.balance_owed}`)
            );
        } else {
            lines.push('DEBTORS: None. All active tenants are up to date.');
        }
    }

    if (/tenant|occupant|resident|list/i.test(msg)) {
        const filter = /active/i.test(msg) ? { status: 'Active' } : {};
        const data = tool_get_tenants(filter);
        if (data.tenants && data.tenants.length) {
            lines.push('TENANTS:');
            data.tenants.slice(0, 8).forEach(t =>
                lines.push(`- ${t.full_name} | Unit ${t.house_number} | ${t.status} | Phone: ${t.phone || 'N/A'}`)
            );
        } else {
            lines.push('TENANTS: No tenants found.');
        }
    }

    return lines.length
        ? lines.join('\n')
        : 'No specific data pre-fetched. Answer based on your knowledge of rental management.';
}

async function runAgentNoTools(messages, res) {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    const dbContext = lastUser ? buildContextFromKeywords(lastUser.content) : '';

    const contextSystemPrompt =
        `You are a rental property management assistant for a Kenyan business. ` +
        `Answer the user's question using ONLY the data below. Format currency as KES. Be concise.\n\n` +
        `LIVE DATA:\n${dbContext}`;

    const response = await axios.post(
        `${OLLAMA_BASE_URL}/api/chat`,
        {
            model: OLLAMA_MODEL,
            messages: [
                { role: 'system', content: contextSystemPrompt },
                ...messages.slice(-2)
            ],
            stream: true,
            keep_alive: '1h',
            options: { temperature: 0.1, num_ctx: 2048 }
        },
        { responseType: 'stream', timeout: 120000 }
    );

    let fullContent = '';
    await new Promise((resolve, reject) => {
        let buffer = '';
        response.data.on('data', chunk => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (let line of lines) {
                if (!line.trim()) continue;
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.message?.content) {
                        fullContent += parsed.message.content;
                        if (res) res.write(`data: ${JSON.stringify({ text: parsed.message.content })}\n\n`);
                    }
                } catch (e) { /* ignore */ }
            }
        });
        response.data.on('end', resolve);
        response.data.on('error', reject);
    });

    return fullContent || 'I could not generate a response.';
}

// ─────────────────────────────────────────
// Ollama Provider (local, with tool-call loop)
// ─────────────────────────────────────────
async function runAgentOllama(messages, res) {
    const MAX_ITERATIONS = 6;
    const conversationMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
    ];

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        try {
            const response = await axios.post(
                `${OLLAMA_BASE_URL}/api/chat`,
                {
                    model: OLLAMA_MODEL,
                    messages: conversationMessages,
                    tools: TOOLS,
                    stream: true,
                    keep_alive: '1h',
                    options: { temperature: 0.1, num_ctx: 2048 }
                },
                { responseType: 'stream', timeout: 120000 }
            );

            let isToolCall = false;
            let fullContent = '';
            let assistantMessage = { role: 'assistant', content: '', tool_calls: [] };

            await new Promise((resolve, reject) => {
                let buffer = '';
                response.data.on('data', chunk => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop();
                    for (let line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const parsed = JSON.parse(line);
                            const msg = parsed.message;
                            if (!msg) continue;
                            if (msg.tool_calls && msg.tool_calls.length > 0) {
                                isToolCall = true;
                                msg.tool_calls.forEach((tc, idx) => {
                                    const tidx = tc.index !== undefined ? tc.index : idx;
                                    if (!assistantMessage.tool_calls[tidx]) {
                                        assistantMessage.tool_calls[tidx] = { type: 'function', function: { name: '', arguments: '' } };
                                    }
                                    if (tc.function?.name) assistantMessage.tool_calls[tidx].function.name += tc.function.name;
                                    if (tc.function?.arguments !== undefined) {
                                        if (typeof tc.function.arguments === 'object') {
                                            assistantMessage.tool_calls[tidx].function.arguments = tc.function.arguments;
                                        } else {
                                            assistantMessage.tool_calls[tidx].function.arguments += tc.function.arguments;
                                        }
                                    }
                                });
                            } else if (msg.content) {
                                fullContent += msg.content;
                                if (!isToolCall && res) res.write(`data: ${JSON.stringify({ text: msg.content })}\n\n`);
                            }
                        } catch (e) { /* ignore */ }
                    }
                });
                response.data.on('end', resolve);
                response.data.on('error', reject);
            });

            if (fullContent) assistantMessage.content = fullContent;
            conversationMessages.push(assistantMessage);

            if (isToolCall && assistantMessage.tool_calls.length > 0) {
                logAi(`Model requested ${assistantMessage.tool_calls.length} tool call(s)`);
                const toolResults = executeToolCalls(assistantMessage.tool_calls);
                conversationMessages.push(...toolResults);
                continue;
            }

            return assistantMessage.content || 'I could not generate a response.';

        } catch (err) {
            const status = err.response?.status;
            errorAi(`Ollama API returned ${status || err.code}`);
            if (status === 400 && i === 0) {
                logAi('Model does not support tool calling. Switching to context-injection fallback...');
                return await runAgentNoTools(messages, res);
            }
            throw err;
        }
    }

    return 'I was unable to complete your request after several attempts.';
}

// ─────────────────────────────────────────
// Main runAgent – dispatches to correct provider
// ─────────────────────────────────────────
async function runAgent(messages, res) {
    if (AI_PROVIDER === 'groq') {
        if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set in server/.env. Please add it to use Groq.');
        logAi(`Using Groq provider (model: ${GROQ_MODEL})`);
        return await runAgentGroq(messages, res);
    }
    logAi(`Using Ollama provider (model: ${OLLAMA_MODEL})`);
    return await runAgentOllama(messages, res);
}

// ─────────────────────────────────────────
// Express Route Handler
// ─────────────────────────────────────────
async function chatHandler(req, res) {
    try {
        const { messages = [], userInput } = req.body;

        if (!userInput && (!messages.length || !messages[messages.length - 1]?.content)) {
            return res.status(400).json({ error: 'userInput or messages array is required.' });
        }

        let history = userInput
            ? [...messages, { role: 'user', content: userInput }]
            : messages;

        if (history.length > 6) history = history.slice(-6);

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        await runAgent(history, res);

        res.write(`data: [DONE]\n\n`);
        res.end();

    } catch (err) {
        console.error('[AI Controller] Error:', err.message);

        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.write(`data: [DONE]\n\n`);
            res.end();
            return;
        }

        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
            return res.status(503).json({ error: 'AI service is unavailable. Please ensure Ollama is running (run: ollama serve).' });
        }
        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
            return res.status(504).json({ error: 'The AI model took too long to respond. Please try again.' });
        }
        if (err.response?.status === 404) {
            return res.status(404).json({ error: `Model not found. Check your AI_PROVIDER and model settings in server/.env` });
        }
        if (err.response?.status === 401) {
            return res.status(401).json({ error: 'Invalid API key. Please check GROQ_API_KEY in server/.env' });
        }
        if (err.response?.status === 429) {
            return res.status(429).json({ error: 'AI rate limit reached. Please wait a moment and try again.' });
        }

        return res.status(500).json({ error: 'An error occurred while processing your AI request.' });
    }
}

module.exports = { chatHandler };
