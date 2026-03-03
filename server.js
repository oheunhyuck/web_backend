app.use(cors({
  origin: '*'
}));
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// In-memory store for preset designs and clients
const userPresets = {};
const clients = new Map(); // userId -> WebSocket connection

wss.on('connection', (ws, req) => {
    // Extract userId from URL (e.g., ws://localhost:3000?userId=test_user)
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const userId = urlParams.get('userId') || 'guest';

    console.log(`Client connected: User ${userId}`);
    clients.set(userId, ws);

    // Send existing preset if available
    if (userPresets[userId]) {
        ws.send(JSON.stringify({
            type: 'design_updated',
            payload: userPresets[userId]
        }));
    }

    ws.on('close', () => {
        console.log(`Client disconnected: User ${userId}`);
        if (clients.get(userId) === ws) {
            clients.delete(userId);
        }
    });
});

app.post('/api/design/update', (req, res) => {
    const { userId, cssCode, presetName } = req.body;

    if (!userId || !cssCode) {
        return res.status(400).json({ error: 'userId and cssCode are required' });
    }

    userPresets[userId] = { presetName, cssCode };

    // Push update to the specific user's extension
    const clientWs = clients.get(userId);
    if (clientWs && clientWs.readyState === 1 /* OPEN */) {
        clientWs.send(JSON.stringify({
            type: 'design_updated',
            payload: { presetName, cssCode }
        }));
    }

    res.json({ success: true, message: 'Design updated & pushed to extension' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});
