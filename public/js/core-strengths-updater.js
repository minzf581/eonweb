document.addEventListener('DOMContentLoaded', function() {
    // Add Font Awesome if not already present
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fontAwesome = document.createElement('link');
        fontAwesome.rel = 'stylesheet';
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
        document.head.appendChild(fontAwesome);
    }

    // Add Core Strengths styles
    const styles = `
        .core-strengths {
            padding: 6rem 0;
            background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
            position: relative;
            overflow: hidden;
        }

        .core-strengths-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 2rem;
            position: relative;
            z-index: 1;
        }

        .core-strengths h2 {
            text-align: center;
            color: var(--text-color);
            font-size: 2.5rem;
            margin-bottom: 4rem;
            position: relative;
        }

        .core-strengths h2:after {
            content: '';
            position: absolute;
            bottom: -10px;
            left: 50%;
            transform: translateX(-50%);
            width: 60px;
            height: 3px;
            background: var(--primary-color);
        }

        .strengths-grid {
            display: flex;
            flex-direction: column;
            gap: 4rem;
        }

        .strength-item {
            display: flex;
            align-items: center;
            gap: 3rem;
            opacity: 0;
            transform: translateY(30px);
            transition: all 0.6s ease;
        }

        .strength-item.visible {
            opacity: 1;
            transform: translateY(0);
        }

        .strength-item:nth-child(even) {
            flex-direction: row-reverse;
        }

        .strength-content {
            flex: 1;
            text-align: left;
        }

        .strength-item:nth-child(even) .strength-content {
            text-align: right;
        }

        .strength-icon-wrapper {
            flex: 0 0 300px;
            position: relative;
        }

        .strength-icon {
            width: 120px;
            height: 120px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, var(--primary-color) 0%, #357ABD 100%);
            border-radius: 50%;
            position: relative;
            transition: transform 0.3s ease;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }

        .strength-icon:before {
            content: '';
            position: absolute;
            top: -10px;
            left: -10px;
            right: -10px;
            bottom: -10px;
            background: linear-gradient(135deg, var(--primary-color) 0%, #357ABD 100%);
            border-radius: 50%;
            opacity: 0.3;
            z-index: -1;
            transition: all 0.3s ease;
        }

        .strength-item:hover .strength-icon {
            transform: scale(1.1);
        }

        .strength-item:hover .strength-icon:before {
            transform: scale(1.2);
            opacity: 0.2;
        }

        .strength-icon i {
            font-size: 3rem;
            color: white;
            transition: transform 0.3s ease;
        }

        .strength-item:hover .strength-icon i {
            transform: scale(1.1);
        }

        .strength-item h3 {
            color: var(--text-color);
            font-size: 2rem;
            margin-bottom: 1rem;
            position: relative;
        }

        .strength-item p {
            color: var(--secondary-color);
            line-height: 1.8;
            font-size: 1.1rem;
            margin: 0;
            position: relative;
            transition: color 0.3s ease;
        }

        .strength-item:hover p {
            color: var(--text-color);
        }

        .strength-background {
            position: absolute;
            width: 200px;
            height: 200px;
            background: radial-gradient(circle, rgba(77, 171, 247, 0.1) 0%, rgba(77, 171, 247, 0) 70%);
            border-radius: 50%;
            z-index: -1;
            transition: all 0.3s ease;
        }

        .strength-item:hover .strength-background {
            transform: scale(1.2);
            opacity: 0.8;
        }

        @media (max-width: 768px) {
            .strength-item,
            .strength-item:nth-child(even) {
                flex-direction: column;
                text-align: center;
                gap: 2rem;
            }

            .strength-content,
            .strength-item:nth-child(even) .strength-content {
                text-align: center;
            }

            .strength-icon-wrapper {
                flex: 0 0 auto;
            }

            .core-strengths {
                padding: 4rem 0;
            }

            .core-strengths h2 {
                font-size: 2rem;
            }

            .strength-item h3 {
                font-size: 1.8rem;
            }
        }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // Update Core Strengths HTML
    const coreStrengthsSection = document.querySelector('.core-strengths');
    if (coreStrengthsSection) {
        coreStrengthsSection.innerHTML = `
            <div class="core-strengths-container">
                <h2>Our Core Strengths</h2>
                <div class="strengths-grid">
                    <div class="strength-item">
                        <div class="strength-icon-wrapper">
                            <div class="strength-background"></div>
                            <div class="strength-icon">
                                <i class="fas fa-shield-alt"></i>
                            </div>
                        </div>
                        <div class="strength-content">
                            <h3>Security First</h3>
                            <p>Enterprise-grade encryption and secure data handling ensure your information remains protected at all times. Our advanced security protocols and continuous monitoring systems provide unmatched protection for your sensitive data.</p>
                        </div>
                    </div>
                    <div class="strength-item">
                        <div class="strength-icon-wrapper">
                            <div class="strength-background"></div>
                            <div class="strength-icon">
                                <i class="fas fa-bolt"></i>
                            </div>
                        </div>
                        <div class="strength-content">
                            <h3>High Performance</h3>
                            <p>Optimized architecture delivers lightning-fast processing and real-time data collaboration capabilities. Experience seamless operations with our cutting-edge infrastructure designed for maximum efficiency and minimal latency.</p>
                        </div>
                    </div>
                    <div class="strength-item">
                        <div class="strength-icon-wrapper">
                            <div class="strength-background"></div>
                            <div class="strength-icon">
                                <i class="fas fa-network-wired"></i>
                            </div>
                        </div>
                        <div class="strength-content">
                            <h3>Scalable Solution</h3>
                            <p>Built to grow with your needs, our platform seamlessly scales from startups to enterprise-level operations. Our flexible architecture adapts to your requirements, ensuring consistent performance as your business expands.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add scroll animation
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.3
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, observerOptions);

        document.querySelectorAll('.strength-item').forEach(item => {
            observer.observe(item);
        });
    }
});
