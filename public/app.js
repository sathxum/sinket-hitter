/**
 * Sinket Hitter - Frontend Application
 * Real-time WebSocket communication with backend
 */

// Global variables
let ws = null;
let isRunning = false;
let sessionId = null;
let results = [];
let generatedCards = [];

// DOM Elements
const elements = {
    connectionStatus: document.getElementById('connectionStatus'),
    paymentLink: document.getElementById('paymentLink'),
    bin: document.getElementById('bin'),
    cardType: document.getElementById('cardType'),
    quantity: document.getElementById('quantity'),
    delay: document.getElementById('delay'),
    autoRefresh: document.getElementById('autoRefresh'),
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    progressSection: document.getElementById('progressSection'),
    progressBar: document.getElementById('progressBar'),
    currentStatus: document.getElementById('currentStatus'),
    progressPercent: document.getElementById('progressPercent'),
    statusLog: document.getElementById('statusLog'),
    resultsSection: document.getElementById('resultsSection'),
    totalCount: document.getElementById('totalCount'),
    successCount: document.getElementById('successCount'),
    failedCount: document.getElementById('failedCount'),
    cardsList: document.getElementById('cardsList'),
    modal: document.getElementById('modal'),
    modalIcon: document.getElementById('modalIcon'),
    modalTitle: document.getElementById('modalTitle'),
    modalMessage: document.getElementById('modalMessage')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
    loadSavedSettings();
});

// WebSocket Connection
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    updateConnectionStatus('connecting', '🔄 Connecting...');
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('[WebSocket] Connected');
        updateConnectionStatus('connected', '✅ Connected');
        addLogEntry('Connected to Sinket Hitter server', 'info');
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (e) {
            console.error('[WebSocket] Parse error:', e);
        }
    };
    
    ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        updateConnectionStatus('disconnected', '❌ Disconnected');
        addLogEntry('Disconnected from server', 'error');
        
        // Auto-reconnect
        setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        updateConnectionStatus('disconnected', '❌ Error');
    };
}

function updateConnectionStatus(status, text) {
    elements.connectionStatus.className = `connection-status ${status}`;
    elements.connectionStatus.innerHTML = status === 'connecting' 
        ? '<span class="spinner">🔄</span> ' + text.replace('🔄 ', '')
        : text;
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'connected':
            sessionId = data.sessionId;
            console.log('[Session] ID:', sessionId);
            break;
            
        case 'status':
            updateProgress(data.progress || 0);
            if (data.message) addLogEntry(data.message, 'info');
            if (data.cardLast4) {
                elements.currentStatus.textContent = `Processing •••• ${data.cardLast4}`;
            }
            break;
            
        case 'progress':
            updateProgress(data.progress || Math.round((data.current / data.total) * 100));
            elements.currentStatus.textContent = `Card ${data.current}/${data.total} • ${data.cardBrand}`;
            break;
            
        case 'card-result':
            handleCardResult(data);
            break;
            
        case 'cards-generated':
            generatedCards = data.cards;
            showModal('🎲', 'Cards Generated', 
                `Generated ${data.quantity} ${data.cardName} cards with BIN ${data.bin}`);
            break;
            
        case 'bin-validated':
            const status = data.valid ? '✅ Valid' : '❌ Invalid';
            const brand = data.cardInfo ? data.cardInfo.brand : 'Unknown';
            showModal('🔍', 'BIN Validation', 
                `BIN: ${data.bin}\nStatus: ${status}\nBrand: ${brand}`);
            break;
            
        case 'link-status':
            const linkStatus = data.expired ? '❌ Expired' : '✅ Active';
            showModal('🔗', 'Link Status', 
                `URL: ${data.url?.substring(0, 40)}...\nStatus: ${linkStatus}`);
            break;
            
        case 'test-cards':
            showTestCards(data.cards);
            break;
            
        case 'session-expired':
            handleSessionExpired(data);
            break;
            
        case 'complete':
            handleComplete(data);
            break;
            
        case 'error':
            addLogEntry(data.message, 'error');
            showModal('❌', 'Error', data.message);
            if (isRunning) resetUI();
            break;
    }
}

// Start Hitting
function startHitting() {
    if (!validateInputs()) return;
    
    const config = {
        paymentLink: elements.paymentLink.value.trim(),
        bin: elements.bin.value.trim(),
        quantity: parseInt(elements.quantity.value) || 10,
        delay: parseInt(elements.delay.value) || 3000,
        autoRefresh: elements.autoRefresh.checked,
        cardType: elements.cardType.value,
        fillDetails: true
    };
    
    saveSettings(config);
    
    isRunning = true;
    results = [];
    
    // Update UI
    elements.startBtn.disabled = true;
    elements.startBtn.innerHTML = '<span class="spinner">🔄</span> Starting...';
    elements.progressSection.classList.add('active');
    elements.resultsSection.classList.remove('active');
    elements.statusLog.innerHTML = '';
    
    addLogEntry('🚀 Starting Sinket Hitter...', 'info');
    
    ws.send(JSON.stringify({
        type: 'start-hitting',
        payload: config
    }));
}

function stopHitting() {
    if (!isRunning) return;
    
    isRunning = false;
    
    ws.send(JSON.stringify({ type: 'stop-hitting' }));
    
    addLogEntry('⏹️ Stopping...', 'warning');
    elements.stopBtn.disabled = true;
    elements.stopBtn.innerHTML = '<span class="spinner">🔄</span> Stopping...';
}

function updateProgress(percent) {
    elements.progressBar.style.width = `${percent}%`;
    elements.progressPercent.textContent = `${percent}%`;
}

function handleCardResult(data) {
    results.push(data);
    
    const statusClass = data.success ? 'success' : 'failed';
    const icon = data.success ? '✅' : '❌';
    
    addLogEntry(`${icon} ${data.card.number} - ${data.message}`, statusClass);
}

function handleSessionExpired(data) {
    addLogEntry('⏰ Session expired!', 'warning');
    
    if (elements.autoRefresh.checked) {
        showModal('⏰', 'Session Expired', 
            'Payment session expired. Please provide a new payment link and restart.');
        resetUI();
    }
}

function handleComplete(data) {
    isRunning = false;
    
    // Update stats
    elements.totalCount.textContent = data.stats.total;
    elements.successCount.textContent = data.stats.success;
    elements.failedCount.textContent = data.stats.failed;
    
    // Build cards list
    elements.cardsList.innerHTML = data.results.map(r => `
        <div class="card-item ${r.result.success ? 'success' : 'failed'}">
            <div class="card-info">
                <span class="card-number">${r.card.formattedNumber || r.card.number}</span>
                <span class="card-meta">${r.card.brand} • ${r.card.expiry} • ${r.card.holderName}</span>
            </div>
            <span class="card-status ${r.result.success ? 'success' : 'failed'}">
                ${r.result.success ? '✅ Success' : '❌ Failed'}
            </span>
        </div>
    `).join('');
    
    // Show results
    elements.progressSection.classList.remove('active');
    elements.resultsSection.classList.add('active');
    
    // Reset UI
    resetUI();
    
    // Show completion modal
    const successRate = data.stats.successRate;
    const icon = successRate > 50 ? '🎉' : successRate > 0 ? '✅' : '⚠️';
    showModal(icon, 'Hitting Complete!', 
        `Total: ${data.stats.total}\nSuccess: ${data.stats.success}\nFailed: ${data.stats.failed}\nSuccess Rate: ${successRate}%`);
}

// Quick Tools
function generateCards() {
    const bin = elements.bin.value.trim();
    const quantity = parseInt(elements.quantity.value) || 10;
    const cardType = elements.cardType.value;
    
    if (!bin || bin.length < 6) {
        showModal('⚠️', 'Invalid BIN', 'Please enter a valid BIN (at least 6 digits)');
        return;
    }
    
    addLogEntry('🎲 Generating cards...', 'info');
    
    ws.send(JSON.stringify({
        type: 'generate-cards',
        payload: { bin, quantity, cardType }
    }));
}

function checkLink() {
    const paymentLink = elements.paymentLink.value.trim();
    
    if (!paymentLink) {
        showModal('⚠️', 'Missing Link', 'Please enter a payment link');
        return;
    }
    
    addLogEntry('🔍 Checking link status...', 'info');
    
    ws.send(JSON.stringify({
        type: 'check-link',
        payload: { paymentLink }
    }));
}

function validateBIN() {
    const bin = elements.bin.value.trim();
    
    if (!bin) {
        showModal('⚠️', 'Missing BIN', 'Please enter a BIN');
        return;
    }
    
    ws.send(JSON.stringify({
        type: 'validate-bin',
        payload: { bin }
    }));
}

function getTestCards() {
    ws.send(JSON.stringify({
        type: 'get-test-cards',
        payload: { brand: 'all' }
    }));
}

function showTestCards(cards) {
    let html = '<div style="max-height: 300px; overflow-y: auto;">';
    
    for (const [brand, cardList] of Object.entries(cards)) {
        if (cardList && cardList.length > 0) {
            html += `<h4 style="margin: 10px 0; color: var(--accent); text-transform: uppercase;">${brand}</h4>`;
            cardList.forEach(card => {
                html += `
                    <div class="card-item" style="margin-bottom: 8px;">
                        <div class="card-info">
                            <span class="card-number">${card.number}</span>
                            <span class="card-meta">${card.desc}</span>
                        </div>
                    </div>
                `;
            });
        }
    }
    
    html += '</div>';
    
    elements.modalIcon.textContent = '🧪';
    elements.modalTitle.textContent = 'Test Cards';
    elements.modalMessage.innerHTML = html;
    elements.modal.classList.add('active');
}

// UI Helpers
function addLogEntry(message, type = 'info') {
    const time = new Date().toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-${type}">${message}</span>
    `;
    
    elements.statusLog.appendChild(entry);
    elements.statusLog.scrollTop = elements.statusLog.scrollHeight;
}

function validateInputs() {
    const paymentLink = elements.paymentLink.value.trim();
    
    if (!paymentLink) {
        showModal('⚠️', 'Missing Payment Link', 'Please enter a Stripe payment link');
        return false;
    }
    
    if (!paymentLink.includes('stripe.com')) {
        showModal('⚠️', 'Invalid Link', 'Please enter a valid Stripe payment link');
        return false;
    }
    
    return true;
}

function resetUI() {
    isRunning = false;
    elements.startBtn.disabled = false;
    elements.startBtn.innerHTML = '<span>🚀</span> START HITTING';
    elements.stopBtn.disabled = false;
    elements.stopBtn.innerHTML = '<span>⏹️</span> STOP';
}

function resetAll() {
    resetUI();
    elements.resultsSection.classList.remove('active');
    elements.progressBar.style.width = '0%';
    elements.currentStatus.textContent = 'Ready';
    elements.progressPercent.textContent = '0%';
    elements.statusLog.innerHTML = '<div class="log-entry"><span class="log-time">--:--:--</span><span class="log-info">Ready to start...</span></div>';
    elements.totalCount.textContent = '0';
    elements.successCount.textContent = '0';
    elements.failedCount.textContent = '0';
    elements.cardsList.innerHTML = '';
    results = [];
}

function exportResults() {
    if (results.length === 0) {
        showModal('⚠️', 'No Results', 'No results to export');
        return;
    }
    
    const csv = [
        'Card Number,Brand,Expiry,CVV,Holder Name,Status,Message',
        ...results.map(r => 
            `"${r.card.number}","${r.card.brand}","${r.card.expiry}","${r.card.cvv}","${r.card.holderName}","${r.success ? 'Success' : 'Failed'}","${r.message}"`
        )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sinket-hitter-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showModal('📥', 'Exported!', 'Results downloaded successfully!');
}

// Modal Functions
function showModal(icon, title, message) {
    elements.modalIcon.textContent = icon;
    elements.modalTitle.textContent = title;
    elements.modalMessage.textContent = message;
    elements.modal.classList.add('active');
}

function closeModal() {
    elements.modal.classList.remove('active');
}

// Settings Management
function saveSettings(config) {
    localStorage.setItem('sinketHitterSettings', JSON.stringify({
        bin: config.bin,
        quantity: config.quantity,
        delay: config.delay,
        autoRefresh: config.autoRefresh,
        cardType: config.cardType
    }));
}

function loadSavedSettings() {
    const saved = localStorage.getItem('sinketHitterSettings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            elements.bin.value = settings.bin || '';
            elements.quantity.value = settings.quantity || 10;
            elements.delay.value = settings.delay || 3000;
            elements.autoRefresh.checked = settings.autoRefresh !== false;
            elements.cardType.value = settings.cardType || 'auto';
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
    
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'Enter' && !isRunning) {
            e.preventDefault();
            startHitting();
        }
        if (e.key === 's' && isRunning) {
            e.preventDefault();
            stopHitting();
        }
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (isRunning && ws) {
        ws.send(JSON.stringify({ type: 'stop-hitting' }));
    }
});
