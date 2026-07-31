# InsightPaper 🧠📄

InsightPaper is a premium, full-stack, AI-powered Research Paper Summarizer. It translates dense academic jargon into clear, structured, human-understandable sections (Overview, Research Gap, Methodology, Architecture Flowchart, Results) and provides a context-grounded Q&A chatbot to let you converse directly with the paper.

---

## 🌟 Visual Dashboard Demo

Here is how InsightPaper looks and works:

### 1. Overview Tab
Provides a single-sentence core achievement summary, a plain-English abstract, and real-world takeaways.
![Overview Tab](assets/overview.png)

### 2. Research Gap Tab
Highlights the specific problem, limitations of previous works, and the exact research gap this paper fills.
![Research Gap](assets/research_gap.png)

### 3. Methodology Tab
Simplifies the core breakthrough idea, details the chronological steps, and details what makes it novel.
![Methodology](assets/methodology.png)

### 4. Architecture & Pipeline Flow
Includes a structural description, modular component breakdown, and a dynamically rendered **Mermaid.js flowchart** mapping the network/pipeline data flow.
![Architecture Flow](assets/architecture.png)

### 5. Results & Critique
Displays datasets used, performance benchmarks, core findings, and a critical analysis of strengths and limitations.
![Results](assets/results.png)

---

## 🔒 Security: API Key Protection

> [!IMPORTANT]
> **Your Gemini API Key is 100% Secure & Private:**
> - The API key is stored securely in your browser's local sandbox (`localStorage`).
> - It is **never** committed to the codebase or pushed to GitHub.
> - The backend receives the key during active requests via secure request headers and never saves it on the server disk.
> - Alternatively, you can set it as a system environment variable (`GEMINI_API_KEY`) on your host machine to avoid entering it in the browser entirely.

---

## 🛠️ Tech Stack
- **Backend:** FastAPI (Python), Google GenAI SDK (with automatic 503/404 model-rotation fallback: Gemini 3.5 Flash ➔ 3.6 Flash ➔ 2.0 Flash ➔ 1.5 Flash).
- **Frontend:** Single Page Application (HTML5, Vanilla CSS3, Javascript ES6), Mermaid.js CDN (diagram compilers), FontAwesome, Google Fonts.

---

## 🚀 Installation & Setup

### Prerequisites
Make sure you have **Python 3.10+** and **pip** installed.

### 1. Clone the Repository
```bash
git clone https://github.com/akhileshyadav8/InsightPaper.git
cd InsightPaper
```

### 2. Install Dependencies
```bash
pip install -r backend/requirements.txt
```

### 3. Run the Application
Start the FastAPI server:
```bash
python backend/main.py
```

### 4. Open in Browser
Open your browser and navigate to:
```
http://127.0.0.1:8000
```
*(Paste your API Key in the settings modal in the top-right header, or set `GEMINI_API_KEY` in your environment variables before launching).*

---

## 🤝 Contributing
Contributions are welcome! Please open an issue or submit a pull request.
