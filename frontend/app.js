// State Management
let apiKey = localStorage.getItem('gemini_api_key') || '';
let modelName = 'gemini-3.5-flash';
let currentPaperId = '';
let chatHistory = [];
let isPdfVisible = true;
let currentTheme = localStorage.getItem('app_theme') || 'dark';
let currentSummaryData = null;

// Initialize Mermaid
mermaid.initialize({
    startOnLoad: false,
    theme: currentTheme === 'light' ? 'default' : 'dark',
    securityLevel: 'loose',
    flowchart: {
        useMaxWidth: true,
        htmlLabels: true
    }
});

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadScreen = document.getElementById('upload-screen');
const loadingScreen = document.getElementById('loading-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loadingStatus = document.getElementById('loading-status');
const modelSelector = document.getElementById('model-selector');
const apiKeyBtn = document.getElementById('api-key-btn');
const newSummaryBtn = document.getElementById('new-summary-btn');
const apiModal = document.getElementById('api-key-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const saveKeyBtn = document.getElementById('save-key-btn');
const clearKeyBtn = document.getElementById('clear-key-btn');
const apiKeyInput = document.getElementById('api-key-input');
const toggleKeyVisibility = document.getElementById('toggle-key-visibility');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const exportMDBtn = document.getElementById('export-md-btn');
const exportPDFBtn = document.getElementById('export-pdf-btn');

// Loading steps elements
const stepUpload = document.getElementById('step-upload');
const stepExtract = document.getElementById('step-extract');
const stepGap = document.getElementById('step-gap');
const stepArchitecture = document.getElementById('step-architecture');
const stepSummarize = document.getElementById('step-summarize');

// Dashboard elements
const paperTitle = document.getElementById('paper-title');
const paperAuthors = document.getElementById('paper-authors');
const paperPub = document.getElementById('paper-pub');
const pdfIframe = document.getElementById('pdf-iframe');
const togglePdfBtn = document.getElementById('toggle-pdf-btn');
const pdfPanel = document.getElementById('pdf-panel');
const summaryPanel = document.getElementById('summary-panel');

// Chat elements
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const suggestBtns = document.querySelectorAll('.suggest-btn');

// Startup Initialization
function init() {
    // Apply saved theme
    applyTheme(currentTheme);

    // Theme toggle listener
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Export buttons listeners
    if (exportMDBtn) exportMDBtn.addEventListener('click', exportMarkdown);
    if (exportPDFBtn) exportPDFBtn.addEventListener('click', exportPDF);

    // Setup Copy Buttons
    setupCopyButtons();

    // Model Selection
    modelSelector.value = modelName;
    modelSelector.addEventListener('change', (e) => {
        modelName = e.target.value;
    });

    // API Key setup
    if (apiKey) {
        apiKeyInput.value = apiKey;
        apiKeyBtn.classList.add('active');
    }

    // Event listeners for modal
    apiKeyBtn.addEventListener('click', () => apiModal.classList.add('active'));
    closeModalBtn.addEventListener('click', () => apiModal.classList.remove('active'));
    saveKeyBtn.addEventListener('click', saveApiKey);
    clearKeyBtn.addEventListener('click', clearApiKey);
    
    // Toggle password visibility
    toggleKeyVisibility.addEventListener('click', () => {
        const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
        apiKeyInput.setAttribute('type', type);
        toggleKeyVisibility.querySelector('i').classList.toggle('fa-eye');
        toggleKeyVisibility.querySelector('i').classList.toggle('fa-eye-slash');
    });

    // Reset back to upload screen
    newSummaryBtn.addEventListener('click', resetApp);

    // Setup tabs
    setupTabs();

    // Setup drag & drop
    setupDragAndDrop();

    // Toggle PDF pane split view
    togglePdfBtn.addEventListener('click', togglePdfView);

    // Chat events
    chatSendBtn.addEventListener('click', handleChatSubmit);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleChatSubmit();
    });

    // Chat suggestion pills
    suggestBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            chatInput.value = btn.textContent;
            handleChatSubmit();
        });
    });
}

// Theme Toggle Logic
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggleBtn) {
        const icon = themeToggleBtn.querySelector('i');
        if (icon) {
            icon.className = theme === 'light' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
    }
    localStorage.setItem('app_theme', theme);
    currentTheme = theme;
}

function toggleTheme() {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    showToast(`Switched to ${nextTheme.toUpperCase()} theme`, "info");
    
    // Re-render mermaid graph with new theme if data is loaded
    if (currentSummaryData && currentSummaryData.architecture && currentSummaryData.architecture.mermaid_diagram) {
        renderMermaidGraph(currentSummaryData.architecture.mermaid_diagram);
    }
}

// Copy to Clipboard Feature
function setupCopyButtons() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.copyTarget;
            let textToCopy = '';

            if (targetId) {
                const targetEl = document.getElementById(targetId);
                if (targetEl) textToCopy = targetEl.innerText;
            } else {
                const parentSection = btn.closest('.summary-section');
                if (parentSection) {
                    const textEl = parentSection.querySelector('p, ul, ol');
                    if (textEl) textToCopy = textEl.innerText;
                }
            }

            if (textToCopy) {
                navigator.clipboard.writeText(textToCopy.trim()).then(() => {
                    const originalHTML = btn.innerHTML;
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                    btn.classList.add('copied');
                    setTimeout(() => {
                        btn.innerHTML = originalHTML;
                        btn.classList.remove('copied');
                    }, 2000);
                }).catch(err => {
                    console.error("Copy failed:", err);
                    showToast("Failed to copy text", "error");
                });
            }
        });
    });
}

// Export Summary Features
function exportMarkdown() {
    if (!currentSummaryData) {
        showToast("No summarized paper available to export.", "warning");
        return;
    }

    const s = currentSummaryData;
    let md = `# ${s.title}\n\n`;
    md += `**Authors:** ${s.authors.join(', ')}\n\n`;
    md += `**Publication:** ${s.publication_info}\n\n`;
    md += `---\n\n`;
    md += `## 💡 Core Achievement\n${s.one_sentence_summary}\n\n`;
    md += `## 📄 Abstract (Simplified)\n${s.abstract_simple}\n\n`;
    md += `## 🎯 Practical Takeaways\n${s.practical_takeaways}\n\n`;
    
    md += `## 🔍 Research Gap\n`;
    md += `- **The Problem:** ${s.research_gap.problem}\n`;
    md += `- **Previous Limitations:** ${s.research_gap.previous_limitations}\n`;
    md += `- **Gap Addressed:** ${s.research_gap.gap_addressed}\n\n`;
    
    md += `## ⚙️ Methodology\n`;
    md += `**Core Idea:** ${s.methodology.core_idea}\n\n`;
    md += `**Novelty:** ${s.methodology.novelty}\n\n`;
    md += `**Key Steps:**\n`;
    s.methodology.key_steps.forEach((step, idx) => {
        md += `${idx + 1}. ${step}\n`;
    });
    
    md += `\n## 🏗️ Architecture\n${s.architecture.description}\n\n`;
    if (s.architecture.mermaid_diagram) {
        md += `\`\`\`mermaid\n${s.architecture.mermaid_diagram}\n\`\`\`\n\n`;
    }
    
    md += `## 📊 Results & Performance\n`;
    md += `**Performance Comparison:** ${s.results.performance_comparison}\n\n`;
    md += `**Datasets Used:** ${s.results.datasets_used.join(', ')}\n\n`;
    md += `**Key Findings:**\n`;
    s.results.key_findings.forEach(f => md += `- ${f}\n`);
    
    md += `\n**Strengths:**\n`;
    s.critical_review.strengths.forEach(st => md += `- ${st}\n`);
    md += `\n**Limitations:**\n`;
    s.critical_review.limitations.forEach(l => md += `- ${l}\n`);

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_summary.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Summary exported as Markdown!", "success");
}

function exportPDF() {
    if (!currentSummaryData) {
        showToast("No summarized paper available to export.", "warning");
        return;
    }
    showToast("Preparing document for PDF printing...", "info");
    setTimeout(() => {
        window.print();
    }, 500);
}

// API Key Logic
function saveApiKey() {
    const key = apiKeyInput.value.trim();
    if (key) {
        apiKey = key;
        localStorage.setItem('gemini_api_key', key);
        apiKeyBtn.classList.add('active');
        apiModal.classList.remove('active');
        showToast("Gemini API Key saved successfully!", "success");
    } else {
        showToast("Please enter a valid API Key.", "warning");
    }
}

function clearApiKey() {
    apiKey = '';
    apiKeyInput.value = '';
    localStorage.removeItem('gemini_api_key');
    apiKeyBtn.classList.remove('active');
    apiModal.classList.remove('active');
    showToast("API Key cleared from local storage.", "info");
}

// Tab Switching Logic
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const tabId = `tab-${btn.dataset.tab}`;
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// Split PDF Layout Control
function togglePdfView() {
    isPdfVisible = !isPdfVisible;
    if (isPdfVisible) {
        pdfPanel.classList.remove('hidden');
        summaryPanel.classList.remove('full-width');
        togglePdfBtn.classList.add('active');
        togglePdfBtn.querySelector('span').textContent = "Split PDF View";
    } else {
        pdfPanel.classList.add('hidden');
        summaryPanel.classList.add('full-width');
        togglePdfBtn.classList.remove('active');
        togglePdfBtn.querySelector('span').textContent = "Summary Only";
    }
}

// Drag and Drop Handling
function setupDragAndDrop() {
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });
}

// File Upload & Summarization
async function handleFileUpload(file) {
    if (file.type !== 'application/pdf') {
        showToast("Please upload a valid PDF document.", "error");
        return;
    }

    // Switch to loading screen
    switchScreen('loading');
    updateLoadingSteps('upload');

    const formData = new FormData();
    formData.append('file', file);

    const headers = {};
    if (apiKey) {
        headers['X-API-Key'] = apiKey;
    }
    
    // Pass selected model name in URL query param
    const uploadUrl = `/api/summarize?model_name=${modelName}`;

    try {
        updateLoadingSteps('extract');
        
        // Timeout check or background update simulation
        const progressTimer = simulateLoadingProgress();

        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData,
            headers: headers
        });

        clearInterval(progressTimer);

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Server failed to process summary.");
        }

        const summary = await response.json();
        
        // Finalize loading steps
        updateLoadingSteps('complete');
        await sleep(500); // smooth transition
        
        // Render Dashboard
        await renderDashboard(summary);

    } catch (err) {
        console.error("Upload error:", err);
        showToast(err.message, "error");
        switchScreen('upload');
    }
}

// Loading UI Step Updates
function updateLoadingSteps(stage) {
    // Reset stages
    [stepUpload, stepExtract, stepGap, stepArchitecture, stepSummarize].forEach(el => {
        el.className = 'pending';
        el.querySelector('i').className = 'fa-solid fa-circle';
    });

    if (stage === 'upload') {
        stepUpload.className = 'active';
        stepUpload.querySelector('i').className = 'fa-solid fa-circle-check';
        loadingStatus.textContent = "Uploading Research Paper...";
    } else if (stage === 'extract') {
        stepUpload.className = 'active';
        stepUpload.querySelector('i').className = 'fa-solid fa-circle-check';
        stepExtract.className = 'pending';
        stepExtract.querySelector('i').className = 'fa-solid fa-circle-notch fa-spin';
        loadingStatus.textContent = "Extracting Document Layout...";
    } else if (stage === 'gap') {
        [stepUpload, stepExtract].forEach(el => {
            el.className = 'active';
            el.querySelector('i').className = 'fa-solid fa-circle-check';
        });
        stepGap.className = 'pending';
        stepGap.querySelector('i').className = 'fa-solid fa-circle-notch fa-spin';
        loadingStatus.textContent = "Analyzing Research Goals & Gaps...";
    } else if (stage === 'architecture') {
        [stepUpload, stepExtract, stepGap].forEach(el => {
            el.className = 'active';
            el.querySelector('i').className = 'fa-solid fa-circle-check';
        });
        stepArchitecture.className = 'pending';
        stepArchitecture.querySelector('i').className = 'fa-solid fa-circle-notch fa-spin';
        loadingStatus.textContent = "Mapping Pipeline & Architecture Flow...";
    } else if (stage === 'summarize') {
        [stepUpload, stepExtract, stepGap, stepArchitecture].forEach(el => {
            el.className = 'active';
            el.querySelector('i').className = 'fa-solid fa-circle-check';
        });
        stepSummarize.className = 'pending';
        stepSummarize.querySelector('i').className = 'fa-solid fa-circle-notch fa-spin';
        loadingStatus.textContent = "Drafting Simplified Explanations...";
    } else if (stage === 'complete') {
        [stepUpload, stepExtract, stepGap, stepArchitecture, stepSummarize].forEach(el => {
            el.className = 'active';
            el.querySelector('i').className = 'fa-solid fa-circle-check';
        });
        loadingStatus.textContent = "Summary Compiled Successfully!";
    }
}

// Simulates loading screen text cycles
function simulateLoadingProgress() {
    let elapsed = 0;
    return setInterval(() => {
        elapsed += 2;
        if (elapsed === 4) {
            updateLoadingSteps('gap');
        } else if (elapsed === 10) {
            updateLoadingSteps('architecture');
        } else if (elapsed === 18) {
            updateLoadingSteps('summarize');
        }
    }, 1000);
}

// Dashboard Rendering Logic
async function renderDashboard(summary) {
    currentSummaryData = summary;
    currentPaperId = summary.paper_id;
    chatHistory = [];
    
    // Fill Metadata
    paperTitle.textContent = summary.title;
    paperAuthors.innerHTML = `<i class="fa-solid fa-users"></i> ${summary.authors.join(', ')}`;
    paperPub.innerHTML = `<i class="fa-solid fa-calendar-days"></i> ${summary.publication_info}`;
    
    // Set PDF Frame Src
    pdfIframe.src = `/api/pdf/${currentPaperId}`;

    // Overview Tab
    document.getElementById('one-sentence-summary').textContent = summary.one_sentence_summary;
    document.getElementById('abstract-simple').textContent = summary.abstract_simple;
    document.getElementById('practical-takeaways').textContent = summary.practical_takeaways;

    // Research Gap Tab
    document.getElementById('gap-problem').textContent = summary.research_gap.problem;
    document.getElementById('gap-limitations').textContent = summary.research_gap.previous_limitations;
    document.getElementById('gap-addressed').textContent = summary.research_gap.gap_addressed;

    // Methodology Tab
    document.getElementById('method-core').textContent = summary.methodology.core_idea;
    document.getElementById('method-novelty').textContent = summary.methodology.novelty;
    
    const stepsList = document.getElementById('method-steps');
    stepsList.innerHTML = '';
    summary.methodology.key_steps.forEach(step => {
        const li = document.createElement('li');
        li.textContent = step;
        stepsList.appendChild(li);
    });

    // Architecture Tab
    document.getElementById('arch-description').textContent = summary.architecture.description;
    
    const componentsGrid = document.getElementById('arch-components');
    componentsGrid.innerHTML = '';
    if (summary.architecture.components && summary.architecture.components.length > 0) {
        summary.architecture.components.forEach(comp => {
            const card = document.createElement('div');
            card.className = 'component-card';
            card.innerHTML = `
                <h5>${comp.name}</h5>
                <p>${comp.role}</p>
            `;
            componentsGrid.appendChild(card);
        });
    } else {
        componentsGrid.innerHTML = '<p class="long-text">No distinct modular components defined.</p>';
    }

    // Render Mermaid Graph
    await renderMermaidGraph(summary.architecture.mermaid_diagram);

    // Results Tab
    document.getElementById('results-performance').textContent = summary.results.performance_comparison;
    
    const datasetsList = document.getElementById('results-datasets');
    datasetsList.innerHTML = '';
    summary.results.datasets_used.forEach(ds => {
        const li = document.createElement('li');
        li.textContent = ds;
        datasetsList.appendChild(li);
    });

    const findingsList = document.getElementById('results-findings');
    findingsList.innerHTML = '';
    summary.results.key_findings.forEach(kf => {
        const li = document.createElement('li');
        li.textContent = kf;
        findingsList.appendChild(li);
    });

    // Review Strengths / Limitations
    const strengthsList = document.getElementById('review-strengths');
    strengthsList.innerHTML = '';
    summary.critical_review.strengths.forEach(str => {
        const li = document.createElement('li');
        li.textContent = str;
        strengthsList.appendChild(li);
    });

    const limitList = document.getElementById('review-limitations');
    limitList.innerHTML = '';
    summary.critical_review.limitations.forEach(lim => {
        const li = document.createElement('li');
        li.textContent = lim;
        limitList.appendChild(li);
    });

    // Reset chat panel
    chatMessages.innerHTML = `
        <div class="chat-message bot">
            <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-bubble">
                <p>I have completely parsed and summarized this paper. Feel free to ask me anything about its parameters, equations, logic, or findings. How can I assist you?</p>
            </div>
        </div>
    `;

    // Swap screens
    switchScreen('dashboard');
    newSummaryBtn.classList.remove('hidden');
}

// Mermaid Rendering Utility
async function renderMermaidGraph(diagramCode) {
    const container = document.getElementById('mermaid-container');
    container.innerHTML = '';

    if (!diagramCode || diagramCode.trim() === '') {
        container.innerHTML = '<p class="long-text">No flowchart available.</p>';
        return;
    }

    // Clean up markdown markers if Gemini outputs them inside the string
    let cleanCode = diagramCode.trim();
    if (cleanCode.startsWith('```mermaid')) {
        cleanCode = cleanCode.substring(10);
    } else if (cleanCode.startsWith('```')) {
        cleanCode = cleanCode.substring(3);
    }
    if (cleanCode.endsWith('```')) {
        cleanCode = cleanCode.substring(0, cleanCode.length - 3);
    }
    cleanCode = cleanCode.trim();

    // Default to graph TD if the diagram doesn't specify a diagram type
    if (!cleanCode.startsWith('graph ') && !cleanCode.startsWith('flowchart ') && !cleanCode.startsWith('sequenceDiagram') && !cleanCode.startsWith('classDiagram') && !cleanCode.startsWith('stateDiagram') && !cleanCode.startsWith('erDiagram') && !cleanCode.startsWith('gantt') && !cleanCode.startsWith('pie')) {
        cleanCode = 'graph TD\n' + cleanCode;
    }

    const id = "mermaid-svg-" + Math.floor(Math.random() * 1000000);
    try {
        const { svg } = await mermaid.render(id, cleanCode);
        container.innerHTML = svg;
    } catch (err) {
        console.error("Mermaid rendering error:", err);
        // Clean up any bad SVG containers injected by Mermaid's error handler in the document body
        const badElement = document.getElementById(id);
        if (badElement) badElement.remove();
        
        container.innerHTML = `
            <div class="note-box" style="margin-bottom:10px; border-color:var(--caution);">
                <i class="fa-solid fa-triangle-exclamation" style="color:var(--caution);"></i>
                <span>Syntax error rendering flow chart. Showing raw chart definitions below:</span>
            </div>
            <pre style="background: rgba(0, 0, 0, 0.4); padding: 12px; border-radius: 8px; font-family: monospace; font-size: 13px; color: #a5b4fc; overflow-x: auto; width:100%;">${cleanCode}</pre>
        `;
    }
}

// Chatbot Q&A Interaction
async function handleChatSubmit() {
    const question = chatInput.value.trim();
    if (!question) return;

    // Add user message to UI
    appendChatMessage('user', question);
    chatInput.value = '';

    // Show bot typing indicator
    const typingIndicator = appendTypingIndicator();
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const requestBody = {
        paper_id: currentPaperId,
        message: question,
        history: chatHistory,
        model_name: modelName
    };

    const headers = {
        'Content-Type': 'application/json'
    };
    if (apiKey) {
        headers['X-API-Key'] = apiKey;
    }

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        // Remove indicator
        typingIndicator.remove();

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Failed to communicate with research assistant.");
        }

        const data = await response.json();
        
        // Add bot message to UI
        appendChatMessage('bot', data.response);
        
        // Save chat history
        chatHistory.push({ role: 'user', content: question });
        chatHistory.push({ role: 'model', content: data.response });

    } catch (err) {
        typingIndicator.remove();
        console.error("Chat error:", err);
        appendChatMessage('bot', `⚠️ Error: ${err.message}. Please try again.`);
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendChatMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${role}`;
    
    const avatarIcon = role === 'bot' ? 'fa-robot' : 'fa-user';
    const formattedText = text.replace(/\n/g, '<br>');

    msgDiv.innerHTML = `
        <div class="message-avatar"><i class="fa-solid ${avatarIcon}"></i></div>
        <div class="message-bubble">
            <p>${formattedText}</p>
        </div>
    `;
    chatMessages.appendChild(msgDiv);
}

function appendTypingIndicator() {
    const indicatorDiv = document.createElement('div');
    indicatorDiv.className = 'chat-message bot';
    indicatorDiv.innerHTML = `
        <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
        <div class="message-bubble">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    chatMessages.appendChild(indicatorDiv);
    return indicatorDiv;
}

// Navigation Screens Helper
function switchScreen(screenName) {
    [uploadScreen, loadingScreen, dashboardScreen].forEach(el => el.classList.remove('active'));
    
    if (screenName === 'upload') {
        uploadScreen.classList.add('active');
    } else if (screenName === 'loading') {
        loadingScreen.classList.add('active');
    } else if (screenName === 'dashboard') {
        dashboardScreen.classList.add('active');
    }
}

function resetApp() {
    currentPaperId = '';
    currentSummaryData = null;
    chatHistory = [];
    pdfIframe.src = '';
    fileInput.value = '';
    newSummaryBtn.classList.add('hidden');
    switchScreen('upload');
}

// Utility Toast Notifications
function showToast(message, type = "info") {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '10px';
    toast.style.backdropFilter = 'blur(10px)';
    toast.style.color = '#fff';
    toast.style.zIndex = '999';
    toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
    toast.style.fontFamily = 'Inter, sans-serif';
    toast.style.fontSize = '14px';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '10px';
    toast.style.animation = 'modal-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
    toast.style.border = '1px solid rgba(255, 255, 255, 0.1)';

    let icon = '<i class="fa-solid fa-info-circle"></i>';

    if (type === 'success') {
        icon = '<i class="fa-solid fa-circle-check" style="color:#10b981;"></i>';
        toast.style.borderLeft = '4px solid #10b981';
    } else if (type === 'error') {
        icon = '<i class="fa-solid fa-circle-xmark" style="color:#ef4444;"></i>';
        toast.style.borderLeft = '4px solid #ef4444';
    } else if (type === 'warning') {
        icon = '<i class="fa-solid fa-circle-exclamation" style="color:#f59e0b;"></i>';
        toast.style.borderLeft = '4px solid #f59e0b';
    }

    toast.innerHTML = `${icon} <span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Run init on window load
window.addEventListener('load', init);
