/**
 * 通用双语切换组件
 * 使用方式：在 HTML 元素上添加 data-zh 和 data-en 属性
 */
class LanguageSwitcher {
    constructor() {
        this.currentLang = this.getStoredLanguage() || this.detectLanguage();
        this.init();
    }

    getStoredLanguage() {
        return localStorage.getItem('eon_language');
    }

    detectLanguage() {
        const browserLang = navigator.language || navigator.userLanguage;
        const isChinese = browserLang.toLowerCase().startsWith('zh');
        return isChinese ? 'zh' : 'en';
    }

    init() {
        this.switchLanguage(this.currentLang);
        this.bindEvents();
    }

    bindEvents() {
        // 绑定所有语言切换按钮
        document.querySelectorAll('.lang-switch, .language-switch, [data-lang-switch]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleLanguage();
            });
        });
    }

    toggleLanguage() {
        const newLang = this.currentLang === 'zh' ? 'en' : 'zh';
        this.switchLanguage(newLang);
    }

    switchLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('eon_language', lang);
        
        // 更新 HTML lang 属性
        document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
        
        // 更新所有带有 data-zh 和 data-en 属性的元素
        document.querySelectorAll('[data-zh][data-en]').forEach(el => {
            const text = el.getAttribute(`data-${lang}`);
            if (text) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    if (el.placeholder) {
                        el.placeholder = text;
                    }
                } else {
                    el.textContent = text;
                }
            }
        });

        // 更新 placeholder 属性
        document.querySelectorAll('[data-placeholder-zh][data-placeholder-en]').forEach(el => {
            el.placeholder = el.getAttribute(`data-placeholder-${lang}`);
        });

        // 更新 title 属性
        document.querySelectorAll('[data-title-zh][data-title-en]').forEach(el => {
            el.title = el.getAttribute(`data-title-${lang}`);
        });
        
        // 更新页面标题
        const titleEl = document.querySelector('title[data-zh][data-en]');
        if (titleEl) {
            document.title = titleEl.getAttribute(`data-${lang}`);
        }
        
        // 更新语言切换按钮文本
        document.querySelectorAll('.lang-switch, .language-switch, [data-lang-switch]').forEach(btn => {
            const btnText = lang === 'zh' ? 'EN' : '中文';
            // 保留图标，只更新文本
            const icon = btn.querySelector('i');
            if (icon) {
                btn.innerHTML = '';
                btn.appendChild(icon);
                btn.appendChild(document.createTextNode(' ' + btnText));
            } else {
                btn.textContent = btnText;
            }
        });

        // 触发自定义事件
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    }

    getCurrentLang() {
        return this.currentLang;
    }
}

// 自动初始化
let langSwitcher;
document.addEventListener('DOMContentLoaded', () => {
    langSwitcher = new LanguageSwitcher();
});

// 导出到全局
window.LanguageSwitcher = LanguageSwitcher;
window.getLang = () => langSwitcher?.getCurrentLang() || 'zh';
window.switchLang = (lang) => langSwitcher?.switchLanguage(lang);
window.toggleLang = () => langSwitcher?.toggleLanguage();
