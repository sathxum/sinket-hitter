/**
 * Sinket Hitter - Ultimate Stripe Auto-Hitter Server
 * Real success/error detection | WebSocket live updates
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const CardEngine = require('./src/card-engine');
const StripeHitter = require('./src/stripe-hitter');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const activeSessions = new Map();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket handling
wss.on('connection', (ws, req) => {
    const sessionId = uuidv4();
    ws.sessionId = sessionId;
    ws.isAlive = true;
    
    console.log(`[WebSocket] Client connected: ${sessionId}`);
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connected',
        sessionId: sessionId,
        message: 'Connected to Sinket Hitter Server',
        timestamp: new Date().toISOString()
    }));

    // Heartbeat
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`[WebSocket] Received: ${data.type}`);
            
            switch (data.type) {
                case 'start-hitting':
                    await handleHitting(ws, data.payload);
                    break;
                case 'stop-hitting':
                    await stopHitting(ws.sessionId);
                    break;
                case 'generate-cards':
                    handleCardGeneration(ws, data.payload);
                    break;
                case 'validate-bin':
                    handleBINValidation(ws, data.payload);
                    break;
                case 'check-link':
                    await handleLinkCheck(ws, data.payload);
                    break;
                case 'get-test-cards':
                    handleGetTestCards(ws, data.payload);
                    break;
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;
            }
        } catch (error) {
            console.error('[WebSocket] Error:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: error.message,
                timestamp: new Date().toISOString()
            }));
        }
    });

    ws.on('close', () => {
        console.log(`[WebSocket] Client disconnected: ${sessionId}`);
        stopHitting(sessionId);
    });

    ws.on('error', (error) => {
        console.error(`[WebSocket] Error for ${sessionId}:`, error);
    });
});

// Heartbeat interval
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            stopHitting(ws.sessionId);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => clearInterval(interval));

// Handle hitting session
async function handleHitting(ws, payload) {
    const { 
        paymentLink, 
        bin, 
        quantity = 10, 
        delay = 3000, 
        autoRefresh = true,
        cardType = 'auto',
        fillDetails = true
    } = payload;
    
    if (!paymentLink || !paymentLink.includes('stripe.com')) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Please provide a valid Stripe payment link',
            code: 'INVALID_LINK'
        }));
        return;
    }

    const sessionId = ws.sessionId;
    
    // Send initial status
    ws.send(JSON.stringify({
        type: 'status',
        message: '🚀 Initializing Sinket Hitter...',
        step: 'init',
        timestamp: new Date().toISOString()
    }));

    try {
        const hitter = new StripeHitter();
        activeSessions.set(sessionId, { hitter, ws, stopped: false });

        // Event handlers
        hitter.on('status', (data) => {
            if (!activeSessions.get(sessionId)?.stopped) {
                ws.send(JSON.stringify({ type: 'status', ...data }));
            }
        });

        hitter.on('progress', (data) => {
            if (!activeSessions.get(sessionId)?.stopped) {
                ws.send(JSON.stringify({ type: 'progress', ...data }));
            }
        });

        hitter.on('card-result', (data) => {
            if (!activeSessions.get(sessionId)?.stopped) {
                ws.send(JSON.stringify({ type: 'card-result', ...data }));
            }
        });

        hitter.on('session-expired', (data) => {
            ws.send(JSON.stringify({
                type: 'session-expired',
                message: '⏰ Payment session expired!',
                details: data,
                timestamp: new Date().toISOString()
            }));
        });

        hitter.on('error', (data) => {
            ws.send(JSON.stringify({ 
                type: 'error', 
                ...data,
                timestamp: new Date().toISOString()
            }));
        });

        hitter.on('complete', (data) => {
            ws.send(JSON.stringify({
                type: 'complete',
                ...data,
                timestamp: new Date().toISOString()
            }));
            activeSessions.delete(sessionId);
        });

        // Start hitting
        await hitter.start({
            paymentLink,
            bin,
            quantity: parseInt(quantity),
            delay: parseInt(delay),
            autoRefresh,
            cardType,
            fillDetails
        });

    } catch (error) {
        console.error('[Hitting] Error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: `Hitting failed: ${error.message}`,
            code: 'HITTING_ERROR',
            timestamp: new Date().toISOString()
        }));
        activeSessions.delete(sessionId);
    }
}

async function stopHitting(sessionId) {
    const session = activeSessions.get(sessionId);
    if (session) {
        session.stopped = true;
        if (session.hitter) {
            await session.hitter.stop();
        }
        activeSessions.delete(sessionId);
        console.log(`[Session] Stopped: ${sessionId}`);
    }
}

// Handle card generation
function handleCardGeneration(ws, payload) {
    try {
        const { bin, quantity = 10, cardType = 'auto' } = payload;
        const engine = new CardEngine();
        
        if (!engine.validateBIN(bin)) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid BIN. Must be at least 6 digits.',
                code: 'INVALID_BIN'
            }));
            return;
        }

        const result = engine.generateFromBIN(bin, parseInt(quantity), cardType);
        
        ws.send(JSON.stringify({
            type: 'cards-generated',
            ...result,
            timestamp: new Date().toISOString()
        }));

    } catch (error) {
        ws.send(JSON.stringify({
            type: 'error',
            message: error.message,
            code: 'GENERATION_ERROR'
        }));
    }
}

// Handle BIN validation
function handleBINValidation(ws, payload) {
    try {
        const { bin } = payload;
        const engine = new CardEngine();
        const isValid = engine.validateBIN(bin);
        const cardInfo = isValid ? engine.getCardInfo(bin + '0000000000') : null;
        
        ws.send(JSON.stringify({
            type: 'bin-validated',
            bin: bin.replace(/\D/g, ''),
            valid: isValid,
            cardInfo: cardInfo,
            timestamp: new Date().toISOString()
        }));

    } catch (error) {
        ws.send(JSON.stringify({
            type: 'error',
            message: error.message
        }));
    }
}

// Handle link check
async function handleLinkCheck(ws, payload) {
    try {
        const { paymentLink } = payload;
        
        ws.send(JSON.stringify({
            type: 'status',
            message: '🔍 Checking payment link...',
            step: 'checking'
        }));

        const hitter = new StripeHitter();
        const status = await hitter.checkLinkStatus(paymentLink);
        
        ws.send(JSON.stringify({
            type: 'link-status',
            url: paymentLink,
            ...status,
            timestamp: new Date().toISOString()
        }));

    } catch (error) {
        ws.send(JSON.stringify({
            type: 'error',
            message: `Link check failed: ${error.message}`
        }));
    }
}

// Handle get test cards
function handleGetTestCards(ws, payload) {
    try {
        const { brand = 'all' } = payload;
        const engine = new CardEngine();
        const cards = engine.getTestCards(brand);
        
        ws.send(JSON.stringify({
            type: 'test-cards',
            brand: brand,
            cards: cards,
            timestamp: new Date().toISOString()
        }));

    } catch (error) {
        ws.send(JSON.stringify({
            type: 'error',
            message: error.message
        }));
    }
}

// REST API Endpoints
app.post('/api/generate-cards', (req, res) => {
    try {
        const { bin, quantity = 10, cardType = 'auto' } = req.body;
        const engine = new CardEngine();
        const result = engine.generateFromBIN(bin, parseInt(quantity), cardType);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/api/validate-bin', (req, res) => {
    try {
        const { bin } = req.body;
        const engine = new CardEngine();
        const isValid = engine.validateBIN(bin);
        const cardInfo = isValid ? engine.getCardInfo(bin + '0000000000') : null;
        res.json({ success: true, valid: isValid, cardInfo });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/api/check-link', async (req, res) => {
    try {
        const { url } = req.body;
        const hitter = new StripeHitter();
        const status = await hitter.checkLinkStatus(url);
        res.json({ success: true, ...status });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

app.get('/api/test-cards', (req, res) => {
    try {
        const { brand = 'all' } = req.query;
        const engine = new CardEngine();
        const cards = engine.getTestCards(brand);
        res.json({ success: true, cards });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        name: 'Sinket Hitter',
        version: '3.0.0',
        activeSessions: activeSessions.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║           ⚡ SINKET HITTER v3.0 - ULTIMATE EDITION ⚡           ║
║                                                                ║
║  🚀 Server running on port: ${PORT}                                ║
║  🌐 Local URL: http://localhost:${PORT}                            ║
║                                                                ║
║  📱 Supported Cards: Visa | Mastercard | Amex | Discover | JCB ║
║                                                                ║
║  🎯 To expose via Cloudflare Tunnel:                           ║
║     npm run tunnel                                             ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n[Server] Shutting down gracefully...');
    for (const [sessionId, session] of activeSessions) {
        await stopHitting(sessionId);
    }
    server.close(() => {
        console.log('[Server] Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', async () => {
    console.log('\n[Server] SIGTERM received...');
    for (const [sessionId, session] of activeSessions) {
        await stopHitting(sessionId);
    }
    server.close(() => {
        process.exit(0);
    });
});

module.exports = { app, server };
