const axios = require('axios');

async function test() {
    try {
        const response = await axios.post('http://localhost:11434/api/chat', {
            model: 'llama3.1:latest',
            messages: [{ role: 'user', content: 'What is the weather in Nairobi?' }],
            tools: [{
                type: 'function',
                function: {
                    name: 'get_weather',
                    description: 'Get weather for a location.',
                    parameters: {
                        type: 'object',
                        properties: { location: { type: 'string' } },
                        required: ['location']
                    }
                }
            }],
            stream: true
        }, { responseType: 'stream' });

        response.data.on('data', chunk => {
            console.log("CHUNK:", chunk.toString().trim());
        });

        response.data.on('end', () => console.log("END"));
    } catch (e) {
        console.error(e.message);
    }
}
test();
