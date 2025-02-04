import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();

// Enable CORS for Live Server and local network
app.use(cors({
    origin: [
        'http://127.0.0.1:5500',
        'http://localhost:5500',
        'http://192.168.1.156:5500'  // Your local IP
    ],
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept']
}));

app.use(express.json({ limit: '10mb' }));

// Add test endpoint
app.get('/test', (req, res) => {
    res.json({ message: 'Server is running!' });
});

// Initialize OpenAI with new client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, trails } = req.body;
        console.log('Received request with message:', message);
        console.log('Number of trails:', trails?.length);

        if (!message || !trails) {
            console.error('Missing required fields');
            return res.status(400).json({ 
                error: 'Missing required fields',
                details: 'Both message and trails are required'
            });
        }

        if (!process.env.OPENAI_API_KEY) {
            console.error('OpenAI API key not found');
            return res.status(500).json({ 
                error: 'Server configuration error',
                details: 'OpenAI API key not configured'
            });
        }

        console.log('Sending request to OpenAI...');
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are an expert trail guide assistant for OverlandX, specializing in off-road trails in California. 
                    Your role is to help users find the perfect trail based on their specific needs and preferences.

                    When analyzing trails, consider:
                    - Distance (in miles)
                    - Region/Location in California
                    - Technical difficulty (avgRating and peakRating, scale of 1-6, where 1 is easiest)
                    - Terrain type and conditions
                    - Estimated completion time
                    - Best seasons to visit
                    - Vehicle requirements
                    
                    Guidelines for your responses:
                    1. Be conversational and friendly, like an experienced guide
                    2. Provide specific trail recommendations with detailed explanations
                    3. Include relevant details about terrain, difficulty, and time requirements
                    4. If a user's criteria are too specific, suggest the closest matches and explain why
                    5. Always consider user safety and vehicle capabilities
                    6. Keep responses informative but concise
                    
                    Available trails data: ${JSON.stringify(trails)}`
                },
                { role: "user", content: message }
            ],
            temperature: 0.7,
            max_tokens: 500
        });

        console.log('Received response from OpenAI');
        res.json({
            response: completion.choices[0].message.content
        });
    } catch (error) {
        console.error('Server error:', error);
        console.error('Error details:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to process request',
            details: error.response?.data?.error?.message || error.message
        });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
}); 