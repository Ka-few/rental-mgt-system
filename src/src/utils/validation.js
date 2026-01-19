// Validation utility functions

export const validateEmail = (email) => {
    if (!email) return { valid: true }; // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return {
        valid: emailRegex.test(email),
        message: 'Please enter a valid email address'
    };
};

export const validatePhone = (phone) => {
    if (!phone) return { valid: false, message: 'Phone number is required' };
    // Kenyan phone format: 07XX XXX XXX or 01XX XXX XXX or +2547XX XXX XXX
    const phoneRegex = /^(\+?254|0)[17]\d{8}$/;
    return {
        valid: phoneRegex.test(phone.replace(/\s/g, '')),
        message: 'Please enter a valid Kenyan phone number (e.g., 0712345678)'
    };
};

export const validateNationalId = (nationalId) => {
    if (!nationalId) return { valid: false, message: 'National ID is required' };
    const cleaned = nationalId.replace(/\s/g, '');
    return {
        valid: cleaned.length === 8 && /^\d+$/.test(cleaned),
        message: 'National ID must be exactly 8 digits'
    };
};

export const validatePositiveNumber = (value, fieldName = 'Value') => {
    const num = parseFloat(value);
    if (isNaN(num)) {
        return { valid: false, message: `${fieldName} must be a number` };
    }
    if (num <= 0) {
        return { valid: false, message: `${fieldName} must be greater than 0` };
    }
    return { valid: true };
};

export const validateRequired = (value, fieldName = 'Field') => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
        return { valid: false, message: `${fieldName} is required` };
    }
    return { valid: true };
};

export const validateDate = (date, fieldName = 'Date') => {
    if (!date) return { valid: false, message: `${fieldName} is required` };
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
        return { valid: false, message: `${fieldName} is not a valid date` };
    }
    return { valid: true };
};
