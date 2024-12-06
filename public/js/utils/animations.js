{\rtf1\ansi\ansicpg936\cocoartf2818
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx566\tx1133\tx1700\tx2267\tx2834\tx3401\tx3968\tx4535\tx5102\tx5669\tx6236\tx6803\pardirnatural\partightenfactor0

\f0\fs24 \cf0 class AnimationHandler \{\
    constructor() \{\
        this.animatedElements = document.querySelectorAll('[data-animate]');\
        this.init();\
    \}\
\
    init() \{\
        this.setupObserver();\
        this.setupScrollAnimations();\
        this.setupCounters();\
    \}\
\
    setupObserver() \{\
        const options = \{\
            root: null,\
            rootMargin: '0px',\
            threshold: 0.1\
        \};\
\
        this.observer = new IntersectionObserver((entries) => \{\
            entries.forEach(entry => \{\
                if (entry.isIntersecting) \{\
                    const element = entry.target;\
                    const animation = element.dataset.animate;\
                    element.classList.add(animation);\
                    this.observer.unobserve(element);\
                \}\
            \});\
        \}, options);\
\
        this.animatedElements.forEach(element => \{\
            this.observer.observe(element);\
        \});\
    \}\
\
    setupScrollAnimations() \{\
        window.addEventListener('scroll', () => \{\
            this.updateProgressBar();\
            this.parallaxEffect();\
        \});\
    \}\
\
    updateProgressBar() \{\
        const progressBar = document.getElementById('progressBar');\
        if (!progressBar) return;\
\
        const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;\
        const scrolled = (window.scrollY / windowHeight) * 100;\
        progressBar.style.width = `$\{scrolled\}%`;\
    \}\
\
    parallaxEffect() \{\
        const parallaxElements = document.querySelectorAll('[data-parallax]');\
        parallaxElements.forEach(element => \{\
            const speed = element.dataset.parallax || 0.5;\
            const offset = window.scrollY * speed;\
            element.style.transform = `translateY($\{offset\}px)`;\
        \});\
    \}\
\
    setupCounters() \{\
        const counterElements = document.querySelectorAll('[data-counter]');\
        const counterObserver = new IntersectionObserver((entries) => \{\
            entries.forEach(entry => \{\
                if (entry.isIntersecting) \{\
                    this.animateCounter(entry.target);\
                    counterObserver.unobserve(entry.target);\
                \}\
            \});\
        \});\
\
        counterElements.forEach(counter => \{\
            counterObserver.observe(counter);\
        \});\
    \}\
\
    animateCounter(element) \{\
        const target = parseInt(element.dataset.counter);\
        const duration = parseInt(element.dataset.duration) || 2000;\
        let start = 0;\
        const startTime = performance.now();\
\
        const updateCounter = (currentTime) => \{\
            const elapsed = currentTime - startTime;\
            const progress = Math.min(elapsed / duration, 1);\
\
            const current = Math.floor(progress * target);\
            element.textContent = current.toLocaleString();\
\
            if (progress < 1) \{\
                requestAnimationFrame(updateCounter);\
            \}\
        \};\
\
        requestAnimationFrame(updateCounter);\
    \}\
\}\
\
// \uc0\u21021 \u22987 \u21270 \u21160 \u30011 \u22788 \u29702 \
document.addEventListener('DOMContentLoaded', () => \{\
    new AnimationHandler();\
\});}