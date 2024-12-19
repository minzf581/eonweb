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
            margin-bottom: 3rem;
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
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
        }

        .strength-item {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 15px;
            padding: 2.5rem;
            text-align: center;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
            cursor: pointer;
        }

        .strength-item:before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, rgba(77, 171, 247, 0.1) 0%, rgba(77, 171, 247, 0) 100%);
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .strength-item:hover {
            transform: translateY(-10px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }

        .strength-item:hover:before {
            opacity: 1;
        }

        .strength-icon {
            width: 80px;
            height: 80px;
            margin: 0 auto 1.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, var(--primary-color) 0%, #357ABD 100%);
            border-radius: 50%;
            position: relative;
            transition: transform 0.3s ease;
        }

        .strength-item:hover .strength-icon {
            transform: scale(1.1);
        }

        .strength-icon i {
            font-size: 2rem;
            color: white;
            transition: transform 0.3s ease;
        }

        .strength-item:hover .strength-icon i {
            transform: scale(1.1);
        }

        .strength-item h3 {
            color: var(--text-color);
            font-size: 1.5rem;
            margin-bottom: 1rem;
            position: relative;
            z-index: 1;
        }

        .strength-item p {
            color: var(--secondary-color);
            line-height: 1.6;
            margin: 0;
            position: relative;
            z-index: 1;
            transition: color 0.3s ease;
        }

        .strength-item:hover p {
            color: var(--text-color);
        }

        @media (max-width: 768px) {
            .strengths-grid {
                grid-template-columns: 1fr;
            }

            .core-strengths {
                padding: 4rem 0;
            }

            .core-strengths h2 {
                font-size: 2rem;
            }

            .strength-item {
                padding: 2rem;
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
                        <div class="strength-icon">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <h3>Security First</h3>
                        <p>Enterprise-grade encryption and secure data handling ensure your information remains protected at all times.</p>
                    </div>
                    <div class="strength-item">
                        <div class="strength-icon">
                            <i class="fas fa-bolt"></i>
                        </div>
                        <h3>High Performance</h3>
                        <p>Optimized architecture delivers lightning-fast processing and real-time data collaboration capabilities.</p>
                    </div>
                    <div class="strength-item">
                        <div class="strength-icon">
                            <i class="fas fa-network-wired"></i>
                        </div>
                        <h3>Scalable Solution</h3>
                        <p>Built to grow with your needs, our platform seamlessly scales from startups to enterprise-level operations.</p>
                    </div>
                </div>
            </div>
        `;
    }
});
