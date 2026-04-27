/**
 * server/controllers/ai.js
 * 
 * AI Controller – handles the Ollama chat & tool-calling agentic loop.
 * 
 * Flow:
 *  1. Receive user message via POST /api/ai/chat
 *  2. Build a message array with the system prompt + conversation history
 *  3. POST to Ollama at http://localhost:11434/api/chat (streaming off)
 *  4. If Ollama returns tool_calls, execute the matching SQLite function
 *  5. Append tool results and loop back to step 3 until a final text response
 *  6. Return the final text response to the client
 */

const axios = require('axios');
const { db } = require('../db/init');
const crypto = require('crypto');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';

// ─────────────────────────────────────────
// Logger utility for background debugging
// ─────────────────────────────────────────
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
// Tool Definitions (sent to Ollama)
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
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
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
                    tenant_name: {
                        type: 'string',
                        description: 'The full name of the tenant (partial match is supported).'
                    },
                    amount: {
                        type: 'number',
                        description: 'The payment amount in KES.'
                    },
                    payment_method: {
                        type: 'string',
                        description: 'Payment method, e.g. "MPESA", "Cash", "Bank Transfer".',
                        enum: ['MPESA', 'Cash', 'Bank Transfer', 'Cheque']
                    },
                    reference_code: {
                        type: 'string',
                        description: 'Optional MPESA or transaction reference code.'
                    }
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
                    house_number: {
                        type: 'string',
                        description: 'The house or unit number where the issue is (e.g. "B2", "Unit 5").'
                    },
                    title: {
                        type: 'string',
                        description: 'A short title for the maintenance issue (e.g. "Leaking sink").'
                    },
                    description: {
                        type: 'string',
                        description: 'Detailed description of the problem.'
                    },
                    priority: {
                        type: 'string',
                        description: 'Issue priority level.',
                        enum: ['Low', 'Normal', 'High', 'Critical']
                    }
                },
                required: ['house_number', 'title', 'description']
            }
        }
    }
];

// ─────────────────────────────────────────
// Tool Execution – Maps AI calls to SQLite
// ─────────────────────────────────────────

/**
 * Fetch tenants, optionally filtered by status
 */
function tool_get_tenants({ status } = {}) {
    try {
        let query = `
      SELECT t.id, t.full_name, t.phone, t.status, h.house_number, p.name AS property_name
      FROM tenants t
      LEFT JOIN houses h ON t.house_id = h.id
      LEFT JOIN properties p ON h.property_id = p.id
    `;
        const params = [];
        if (status) {
            query += ' WHERE t.status = ?';
            params.push(status);
        }
        query += ' ORDER BY t.full_name';

        const rows = db.prepare(query).all(...params);
        if (!rows.length) return { result: 'No tenants found.' };

        // Limit results to avoid massive token usage context timeouts
        if (rows.length > 15) {
            return {
                tenants: rows.slice(0, 15),
                notice: `Only showing the first 15 tenants out of ${rows.length}. Please ask the user to provide a specific name or query if their tenant is not here.`
            };
        }
        return { tenants: rows };
    } catch (err) {
        return { error: `Failed to fetch tenants: ${err.message}` };
    }
}

/**
 * Fetch all tenants with a positive outstanding balance (charges > payments)
 */
function tool_get_debtors() {
    try {
        const rows = db.prepare(`
      SELECT
        t.id,
        t.full_name,
        t.phone,
        h.house_number,
        p.name AS property_name,
        ROUND(
          COALESCE(SUM(CASE WHEN tr.type != 'Payment' THEN tr.amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN tr.type  = 'Payment' THEN tr.amount ELSE 0 END), 0),
          2
        ) AS balance_owed
      FROM tenants t
      LEFT JOIN houses h ON t.house_id = h.id
      LEFT JOIN properties p ON h.property_id = p.id
      LEFT JOIN transactions tr ON tr.tenant_id = t.id
      WHERE t.status = 'Active'
      GROUP BY t.id
      HAVING balance_owed > 0
      ORDER BY balance_owed DESC
    `).all();

        if (!rows.length) return { result: 'No debtors found. All active tenants are up to date!' };

        // Limit results to avoid massive token usage context timeouts
        if (rows.length > 15) {
            return {
                debtors: rows.slice(0, 15),
                notice: `Only showing the top 15 debtors out of ${rows.length}. Tell the user there are too many to list completely.`
            };
        }
        return { debtors: rows };
    } catch (err) {
        return { error: `Failed to fetch debtors: ${err.message}` };
    }
}

/**
 * Record a payment transaction for a tenant matched by name (partial)
 */
function tool_record_payment({ tenant_name, amount, payment_method, reference_code }) {
    try {
        if (!tenant_name || !amount) {
            return { error: 'tenant_name and amount are required.' };
        }

        // Find tenant by partial name match
        const tenant = db.prepare(
            `SELECT id, full_name FROM tenants WHERE full_name LIKE ? AND status = 'Active' LIMIT 1`
        ).get(`%${tenant_name}%`);

        if (!tenant) {
            return { error: `No active tenant found matching "${tenant_name}". Please check the name and try again.` };
        }

        const paymentId = crypto.randomUUID();
        db.prepare(`
      INSERT INTO transactions (id, tenant_id, type, amount, payment_method, reference_code, description)
      VALUES (?, ?, 'Payment', ?, ?, ?, ?)
    `).run(
            paymentId,
            tenant.id,
            amount,
            payment_method || 'Cash',
            reference_code || null,
            `AI-recorded payment of KES ${amount}`
        );

        return {
            success: true,
            message: `Payment of KES ${amount} recorded for ${tenant.full_name}.`,
            transaction_id: paymentId
        };
    } catch (err) {
        return { error: `Failed to record payment: ${err.message}` };
    }
}

/**
 * Create a maintenance request by looking up the house number
 */
function tool_create_maintenance_request({ house_number, title, description, priority }) {
    try {
        if (!house_number || !title || !description) {
            return { error: 'house_number, title, and description are required.' };
        }

        // Look up house by number (partial match)
        const house = db.prepare(
            `SELECT h.id, h.house_number, p.id AS property_id
       FROM houses h
       LEFT JOIN properties p ON h.property_id = p.id
       WHERE h.house_number LIKE ? LIMIT 1`
        ).get(`%${house_number}%`);

        if (!house) {
            return { error: `No house found matching unit "${house_number}". Please check the unit number.` };
        }

        const requestId = crypto.randomUUID();
        db.prepare(`
      INSERT INTO maintenance_requests
        (id, house_id, property_id, title, description, priority, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Open')
    `).run(
            requestId,
            house.id,
            house.property_id || null,
            title,
            description,
            priority || 'Normal'
        );

        return {
            success: true,
            message: `Maintenance request "${title}" has been logged for Unit ${house.house_number}.`,
            request_id: requestId
        };
    } catch (err) {
        return { error: `Failed to create maintenance request: ${err.message}` };
    }
}

// Tool dispatch map
const TOOL_HANDLERS = {
    get_tenants: tool_get_tenants,
    get_debtors: tool_get_debtors,
    record_payment: tool_record_payment,
    create_maintenance_request: tool_create_maintenance_request
};

/**
 * Execute one or more tool calls from Ollama and return results
 */
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

        return {
            role: 'tool',
            name: name,
            content: JSON.stringify(result)
        };
    });
}

// ─────────────────────────────────────────
// Main Agent Loop
// ─────────────────────────────────────────

/**
 * runAgent – sends messages to Ollama and handles the tool-call loop.
 * @param {Array} messages - [ { role: 'user'|'assistant'|'tool', content: string }, ... ]
 * @returns {string} - final text response from the assistant
 */
async function runAgent(messages) {
    const MAX_ITERATIONS = 6; // Prevent infinite loops

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
                    stream: false,
                    keep_alive: '1h', // Keep model in RAM for 1 hour to prevent cold starts on subsequent requests
                    options: {
                        temperature: 0.1, // Low temperature for more deterministic tool usage
                        num_ctx: 4096 // Bound context size to improve inference speed 
                    }
                },
                { timeout: 300000 } // 5 minute timeout for slow models/initial load
            );

            const assistantMessage = response.data?.message;
            if (!assistantMessage) {
                throw new Error('Ollama returned an unexpected empty response.');
            }

            // Always append the assistant's message for context
            conversationMessages.push(assistantMessage);

            // Check if the model wants to call tools
            if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                logAi(`Model requested ${assistantMessage.tool_calls.length} tool call(s)`);
                const toolResults = executeToolCalls(assistantMessage.tool_calls);
                conversationMessages.push(...toolResults);
                // Continue the loop with tool results fed back
                continue;
            }

            // No tool calls – we have the final text response
            return assistantMessage.content || 'I could not generate a response. Please try again.';
        } catch (err) {
            if (err.response) {
                errorAi(`Ollama API returned ${err.response.status}:`, err.response.data);
                if (err.response.data?.error) {
                    throw new Error(`Ollama Error: ${err.response.data.error}`);
                }
            }
            throw err;
        }
    }

    return 'I was unable to complete your request after several attempts. Please try rephrasing your question.';
}

// ─────────────────────────────────────────
// Express Route Handler
// ─────────────────────────────────────────

/**
 * POST /api/ai/chat
 * Body: { messages: [{role, content}], userInput: string }
 */
async function chatHandler(req, res) {
    try {
        const { messages = [], userInput } = req.body;

        if (!userInput && (!messages.length || !messages[messages.length - 1]?.content)) {
            return res.status(400).json({ error: 'userInput or messages array is required.' });
        }

        // Build a clean message history for the agent
        let history = userInput
            ? [...messages, { role: 'user', content: userInput }]
            : messages;

        // OPTIMIZATION: Keep only the most recent 6 messages to reduce token processing time
        if (history.length > 6) {
            history = history.slice(-6);
        }

        const finalResponse = await runAgent(history);

        return res.json({
            response: finalResponse,
            // Return the user message for the client to maintain history easily
            userMessage: userInput || messages[messages.length - 1]?.content
        });
    } catch (err) {
        console.error('[AI Controller] Error:', err.message);

        // Friendly error for when Ollama is not running
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
            return res.status(503).json({
                error: 'AI service is unavailable. Please ensure Ollama is running on this machine (run: ollama serve).'
            });
        }

        if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
            return res.status(504).json({
                error: 'The AI model took too long to respond. It might be loading into memory or processing a complex query. Please try again.'
            });
        }

        if (err.response?.status === 404) {
            return res.status(404).json({
                error: `Model "${OLLAMA_MODEL}" not found in Ollama. Run: ollama pull ${OLLAMA_MODEL}`
            });
        }

        return res.status(500).json({ error: 'An error occurred while processing your AI request.' });
    }
}

module.exports = { chatHandler };
