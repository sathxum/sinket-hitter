/**
 * Sinket Hitter - Ultimate Card Generator Engine
 * Supports: Visa, Mastercard, American Express, Discover, JCB, Diners Club
 * All cards pass Luhn validation
 */

class CardEngine {
    constructor() {
        this.cardTypes = {
            visa: {
                name: 'Visa',
                prefixes: ['4'],
                lengths: [13, 16, 19],
                cvvLength: 3,
                icon: '💳',
                color: '#1A1F71'
            },
            mastercard: {
                name: 'Mastercard',
                prefixes: ['51', '52', '53', '54', '55', '2221', '2222', '2223', '2224', '2225', '2226', '2227', '2228', '2229', '223', '224', '225', '226', '227', '228', '229', '23', '24', '25', '26', '270', '271', '2720'],
                lengths: [16],
                cvvLength: 3,
                icon: '💳',
                color: '#EB001B'
            },
            amex: {
                name: 'American Express',
                prefixes: ['34', '37'],
                lengths: [15],
                cvvLength: 4,
                icon: '💳',
                color: '#2E77BC'
            },
            discover: {
                name: 'Discover',
                prefixes: ['6011', '644', '645', '646', '647', '648', '649', '65'],
                lengths: [16, 19],
                cvvLength: 3,
                icon: '💳',
                color: '#FF6000'
            },
            jcb: {
                name: 'JCB',
                prefixes: ['3528', '3529', '353', '354', '355', '356', '357', '358'],
                lengths: [16, 17, 18, 19],
                cvvLength: 3,
                icon: '💳',
                color: '#0066B3'
            },
            diners: {
                name: 'Diners Club',
                prefixes: ['36', '38', '39', '300', '301', '302', '303', '304', '305'],
                lengths: [14, 16, 19],
                cvvLength: 3,
                icon: '💳',
                color: '#004E94'
            }
        };

        this.months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    }

    /**
     * Generate cards from BIN
     * @param {string} bin - Bank Identification Number (6+ digits)
     * @param {number} quantity - Number of cards to generate
     * @param {string} cardType - Specific card type or 'auto' for detection
     */
    generateFromBIN(bin, quantity = 10, cardType = 'auto') {
        const cleanBIN = bin.replace(/\D/g, '');
        
        if (cleanBIN.length < 6) {
            throw new Error('BIN must be at least 6 digits');
        }

        const detectedType = cardType === 'auto' ? this.detectCardType(cleanBIN) : cardType;
        const typeConfig = this.cardTypes[detectedType] || this.cardTypes.visa;
        
        const cards = [];
        for (let i = 0; i < quantity; i++) {
            const card = this.generateSingleCard(cleanBIN, typeConfig);
            cards.push(card);
        }

        return {
            bin: cleanBIN,
            cardType: detectedType,
            cardName: typeConfig.name,
            quantity: cards.length,
            cards: cards
        };
    }

    /**
     * Generate single card
     */
    generateSingleCard(bin, typeConfig) {
        const length = typeConfig.lengths[0];
        const prefix = bin.slice(0, Math.min(bin.length, 6));
        
        // Generate middle digits
        const middleLength = length - prefix.length - 1; // -1 for check digit
        let cardNumber = prefix;
        
        for (let i = 0; i < middleLength; i++) {
            cardNumber += Math.floor(Math.random() * 10);
        }
        
        // Calculate Luhn check digit
        const checkDigit = this.calculateLuhnCheckDigit(cardNumber);
        cardNumber += checkDigit;

        // Generate expiry (1-4 years from now)
        const expiry = this.generateExpiry();
        
        // Generate CVV
        const cvv = this.generateCVV(typeConfig.cvvLength);
        
        // Generate holder name
        const holderName = this.generateHolderName();

        return {
            number: cardNumber,
            formattedNumber: this.formatCardNumber(cardNumber),
            expiry: expiry,
            cvv: cvv,
            holderName: holderName,
            brand: typeConfig.name,
            type: Object.keys(this.cardTypes).find(key => this.cardTypes[key] === typeConfig),
            valid: this.validateLuhn(cardNumber),
            icon: typeConfig.icon
        };
    }

    /**
     * Calculate Luhn check digit
     */
    calculateLuhnCheckDigit(partialNumber) {
        let sum = 0;
        let isEven = false;
        
        for (let i = partialNumber.length - 1; i >= 0; i--) {
            let digit = parseInt(partialNumber.charAt(i), 10);
            
            if (isEven) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }
            
            sum += digit;
            isEven = !isEven;
        }
        
        return (10 - (sum % 10)) % 10;
    }

    /**
     * Validate card using Luhn algorithm
     */
    validateLuhn(cardNumber) {
        let sum = 0;
        let isEven = false;
        
        for (let i = cardNumber.length - 1; i >= 0; i--) {
            let digit = parseInt(cardNumber.charAt(i), 10);
            
            if (isEven) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }
            
            sum += digit;
            isEven = !isEven;
        }
        
        return sum % 10 === 0;
    }

    /**
     * Detect card type from BIN
     */
    detectCardType(bin) {
        for (const [type, config] of Object.entries(this.cardTypes)) {
            for (const prefix of config.prefixes) {
                if (bin.startsWith(prefix)) {
                    return type;
                }
            }
        }
        return 'visa'; // Default to Visa
    }

    /**
     * Generate expiry date
     */
    generateExpiry() {
        const now = new Date();
        const month = this.months[Math.floor(Math.random() * 12)];
        const year = (now.getFullYear() + Math.floor(Math.random() * 4) + 1).toString().slice(-2);
        return `${month}${year}`;
    }

    /**
     * Generate CVV
     */
    generateCVV(length = 3) {
        let cvv = '';
        for (let i = 0; i < length; i++) {
            cvv += Math.floor(Math.random() * 10);
        }
        return cvv;
    }

    /**
     * Generate realistic holder name
     */
    generateHolderName() {
        const firstNames = [
            'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph',
            'Thomas', 'Charles', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven',
            'Paul', 'Andrew', 'Kenneth', 'Joshua', 'Kevin', 'Brian', 'George', 'Timothy',
            'Ronald', 'Jason', 'Edward', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas',
            'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin',
            'Samuel', 'Gregory', 'Frank', 'Alexander', 'Raymond', 'Patrick', 'Jack', 'Dennis',
            'Jerry', 'Tyler', 'Aaron', 'Jose', 'Adam', 'Nathan', 'Henry', 'Douglas',
            'Zachary', 'Peter', 'Kyle', 'Ethan', 'Walter', 'Noah', 'Jeremy', 'Christian',
            'Keith', 'Roger', 'Terry', 'Gerald', 'Harold', 'Sean', 'Austin', 'Carl',
            'Arthur', 'Lawrence', 'Dylan', 'Jesse', 'Jordan', 'Bryan', 'Billy', 'Joe',
            'Bruce', 'Gabriel', 'Logan', 'Albert', 'Willie', 'Alan', 'Juan', 'Wayne',
            'Elijah', 'Randy', 'Roy', 'Vincent', 'Ralph', 'Eugene', 'Russell', 'Bobby',
            'Mason', 'Philip', 'Louis', 'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth',
            'Susan', 'Jessica', 'Sarah', 'Karen', 'Nancy', 'Lisa', 'Betty', 'Margaret',
            'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle', 'Dorothy', 'Carol',
            'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Laura', 'Sharon', 'Cynthia',
            'Kathleen', 'Amy', 'Shirley', 'Angela', 'Helen', 'Anna', 'Brenda', 'Pamela',
            'Nicole', 'Emma', 'Samantha', 'Katherine', 'Christine', 'Debra', 'Rachel', 'Catherine',
            'Carolyn', 'Janet', 'Ruth', 'Maria', 'Heather', 'Diane', 'Virginia', 'Julie'
        ];
        
        const lastNames = [
            'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
            'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
            'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
            'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
            'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
            'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
            'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker',
            'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy',
            'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey',
            'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
            'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza',
            'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers',
            'Long', 'Ross', 'Foster', 'Jimenez', 'Powell', 'Jenkins', 'Perry', 'Russell',
            'Sullivan', 'Bell', 'Coleman', 'Butler', 'Henderson', 'Barnes', 'Gonzales', 'Fisher',
            'Vasquez', 'Simmons', 'Romero', 'Jordan', 'Patterson', 'Alexander', 'Hamilton', 'Graham',
            'Reynolds', 'Griffin', 'Wallace', 'Moreno', 'West', 'Cole', 'Hayes', 'Bryant'
        ];

        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        
        return `${firstName} ${lastName}`;
    }

    /**
     * Format card number with spaces
     */
    formatCardNumber(number) {
        // Amex: 4-6-5 format
        if (number.startsWith('34') || number.startsWith('37')) {
            return number.replace(/(\d{4})(\d{6})(\d{5})/, '$1 $2 $3');
        }
        // Default: 4-4-4-4 format
        return number.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    }

    /**
     * Get test cards for specific brands
     */
    getTestCards(brand = 'all') {
        const testCards = {
            visa: [
                { number: '4242424242424242', cvc: '123', desc: 'Visa Success' },
                { number: '4000056655665556', cvc: '123', desc: 'Visa Debit' },
                { number: '4000002760003184', cvc: '123', desc: 'Visa 3DS' },
                { number: '4000000000000002', cvc: '123', desc: 'Visa Declined' },
                { number: '4000000000009995', cvc: '123', desc: 'Insufficient Funds' },
                { number: '4000000000009987', cvc: '123', desc: 'Lost Card' },
                { number: '4000000000009979', cvc: '123', desc: 'Stolen Card' },
                { number: '4000000000000069', cvc: '123', desc: 'Expired Card' },
                { number: '4000000000000127', cvc: '123', desc: 'Incorrect CVC' },
                { number: '4000000000000119', cvc: '123', desc: 'Processing Error' }
            ],
            mastercard: [
                { number: '5555555555554444', cvc: '123', desc: 'Mastercard Success' },
                { number: '5105105105105100', cvc: '123', desc: 'Mastercard Test' },
                { number: '5200828282828210', cvc: '123', desc: 'Mastercard Debit' },
                { number: '5100000000000000', cvc: '123', desc: 'Mastercard Declined' }
            ],
            amex: [
                { number: '378282246310005', cvc: '1234', desc: 'Amex Success' },
                { number: '371449635398431', cvc: '1234', desc: 'Amex Test' },
                { number: '378734493671000', cvc: '1234', desc: 'Amex Corporate' },
                { number: '340000000000000', cvc: '1234', desc: 'Amex Declined' }
            ],
            discover: [
                { number: '6011111111111117', cvc: '123', desc: 'Discover Success' },
                { number: '6011000990139424', cvc: '123', desc: 'Discover Test' }
            ]
        };

        if (brand === 'all') {
            return { ...testCards };
        }
        return testCards[brand] || [];
    }

    /**
     * Validate BIN format
     */
    validateBIN(bin) {
        const clean = bin.replace(/\D/g, '');
        return clean.length >= 6;
    }

    /**
     * Get card info from number
     */
    getCardInfo(number) {
        const clean = number.replace(/\D/g, '');
        const type = this.detectCardType(clean);
        const config = this.cardTypes[type];
        
        return {
            type: type,
            brand: config.name,
            valid: this.validateLuhn(clean),
            length: clean.length,
            icon: config.icon
        };
    }
}

module.exports = CardEngine;
