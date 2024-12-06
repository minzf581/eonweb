{\rtf1\ansi\ansicpg936\cocoartf2818
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx566\tx1133\tx1700\tx2267\tx2834\tx3401\tx3968\tx4535\tx5102\tx5669\tx6236\tx6803\pardirnatural\partightenfactor0

\f0\fs24 \cf0 class FormHandler \{\
    constructor(formId) \{\
        this.form = document.getElementById(formId);\
        this.setupEventListeners();\
    \}\
\
    setupEventListeners() \{\
        if (this.form) \{\
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));\
            this.setupInputValidation();\
        \}\
    \}\
\
    setupInputValidation() \{\
        const inputs = this.form.querySelectorAll('input, textarea');\
        inputs.forEach(input => \{\
            input.addEventListener('blur', (e) => this.validateInput(e.target));\
            input.addEventListener('input', (e) => this.validateInput(e.target));\
        \});\
    \}\
\
    validateInput(input) \{\
        const value = input.value.trim();\
        const type = input.type;\
        let isValid = true;\
        let errorMessage = '';\
\
        switch(type) \{\
            case 'email':\
                isValid = this.validateEmail(value);\
                errorMessage = 'Please enter a valid email address';\
                break;\
            case 'text':\
                isValid = value.length >= 2;\
                errorMessage = 'This field is required';\
                break;\
            case 'textarea':\
                isValid = value.length >= 10;\
                errorMessage = 'Please enter at least 10 characters';\
                break;\
        \}\
\
        this.toggleError(input, !isValid, errorMessage);\
        return isValid;\
    \}\
\
    validateEmail(email) \{\
        return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);\
    \}\
\
    toggleError(input, show, message) \{\
        const errorElement = input.parentElement.querySelector('.error-message');\
        if (show) \{\
            if (!errorElement) \{\
                const error = document.createElement('div');\
                error.className = 'error-message';\
                error.textContent = message;\
                input.parentElement.appendChild(error);\
            \}\
            input.classList.add('error');\
        \} else \{\
            if (errorElement) \{\
                errorElement.remove();\
            \}\
            input.classList.remove('error');\
        \}\
    \}\
\
    async handleSubmit(e) \{\
        e.preventDefault();\
        \
        const isValid = Array.from(this.form.elements)\
            .filter(element => element.tagName !== 'BUTTON')\
            .every(element => this.validateInput(element));\
\
        if (!isValid) \{\
            return;\
        \}\
\
        const formData = new FormData(this.form);\
        try \{\
            this.showLoadingState();\
            // \uc0\u26367 \u25442 \u20026 \u23454 \u38469 \u30340 API\u31471 \u28857 \
            const response = await fetch('/api/submit', \{\
                method: 'POST',\
                body: formData\
            \});\
            \
            if (!response.ok) \{\
                throw new Error('Submission failed');\
            \}\
\
            this.showSuccess();\
            this.form.reset();\
        \} catch (error) \{\
            this.showError(error.message);\
        \} finally \{\
            this.hideLoadingState();\
        \}\
    \}\
\
    showLoadingState() \{\
        const button = this.form.querySelector('button[type="submit"]');\
        button.disabled = true;\
        button.innerHTML = '<span class="spinner"></span> Sending...';\
    \}\
\
    hideLoadingState() \{\
        const button = this.form.querySelector('button[type="submit"]');\
        button.disabled = false;\
        button.textContent = 'Send Message';\
    \}\
\
    showSuccess() \{\
        const message = document.createElement('div');\
        message.className = 'success-message fade-in';\
        message.textContent = 'Thank you! Your message has been sent.';\
        this.form.appendChild(message);\
        setTimeout(() => message.remove(), 5000);\
    \}\
\
    showError(errorMessage) \{\
        const message = document.createElement('div');\
        message.className = 'error-message fade-in';\
        message.textContent = errorMessage;\
        this.form.appendChild(message);\
        setTimeout(() => message.remove(), 5000);\
    \}\
\}\
\
// \uc0\u21021 \u22987 \u21270 \u34920 \u21333 \u22788 \u29702 \
document.addEventListener('DOMContentLoaded', () => \{\
    new FormHandler('contactForm');\
\});}