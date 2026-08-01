import os
import uuid
import time
import shutil
from typing import List, Optional
from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI, UploadFile, File, Header, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

# Define directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "temp_uploads")
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure upload directory exists
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    yield
    # Shutdown logic (optional)

app = FastAPI(
    title="Research Paper Summarizer API",
    description="Backend API for summarizing research papers using Gemini",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schemas for Gemini Structured Output
class ResearchGap(BaseModel):
    problem: str = Field(description="The primary problem the research paper is trying to solve.")
    previous_limitations: str = Field(description="The key limitations or flaws of previous/existing approaches.")
    gap_addressed: str = Field(description="The specific research gap that this paper identifies and addresses.")

class Methodology(BaseModel):
    core_idea: str = Field(description="The main conceptual breakthrough, thesis, or approach introduced by this paper in simple terms.")
    key_steps: List[str] = Field(description="Step-by-step summary of the main steps in the methodology.")
    novelty: str = Field(description="What makes this specific methodology unique or different from prior work.")

class Component(BaseModel):
    name: str = Field(description="Name of the component, layer, module, or step.")
    role: str = Field(description="The role or purpose of this component in the system.")

class Architecture(BaseModel):
    has_architecture: bool = Field(description="True if the paper proposes a specific system architecture, model structure, pipeline, or framework layout. False otherwise.")
    description: str = Field(description="Detailed plain-English description of the model or system architecture, explaining how inputs flow to outputs.")
    components: List[Component] = Field(description="List of key components in the architecture, if applicable.")
    mermaid_diagram: str = Field(description="A valid Mermaid.js flowchart (graph TD) showing the flow of data or control through the proposed model/architecture. Make sure it uses valid syntax and handles text labels with quotes if they contain special characters.")

class Results(BaseModel):
    key_findings: List[str] = Field(description="The most important findings, metrics, or experimental results of the paper, stated in simple terms.")
    datasets_used: List[str] = Field(description="The datasets or benchmarks used to evaluate the methodology.")
    performance_comparison: str = Field(description="A brief description of how the proposed method compares to previous state-of-the-art benchmarks.")

class CriticalReview(BaseModel):
    strengths: List[str] = Field(description="The primary strengths, advantages, or breakthroughs of this research.")
    limitations: List[str] = Field(description="Any limitations, assumptions, risks, or potential drawbacks identified in the paper or in its evaluation.")

class PaperSummary(BaseModel):
    title: str = Field(description="The title of the research paper.")
    authors: List[str] = Field(description="List of authors of the research paper.")
    publication_info: str = Field(description="Information about where/when the paper was published, e.g., CVPR 2024, arXiv 2025. Set to 'Unknown' if not found.")
    one_sentence_summary: str = Field(description="A highly concise, single-sentence summary of the paper's core achievement.")
    abstract_simple: str = Field(description="A simple, jargon-free, plain-English explanation of the paper's abstract.")
    research_gap: ResearchGap = Field(description="Analysis of the research gap identified by the paper.")
    methodology: Methodology = Field(description="Summary of the methodology proposed in the paper.")
    architecture: Architecture = Field(description="Details on the system or model architecture proposed by the paper.")
    results: Results = Field(description="Summary of the research results and experiments.")
    critical_review: CriticalReview = Field(description="Critical review of strengths and limitations.")
    practical_takeaways: str = Field(description="Main takeaways and practical applications of this research in the real world.")

# Request Schemas for endpoints
class ChatMessage(BaseModel):
    role: str # 'user' or 'model'
    content: str

class ChatRequest(BaseModel):
    paper_id: str
    message: str
    history: List[ChatMessage]
    model_name: Optional[str] = "gemini-3.5-flash"

def cleanup_old_files():
    """Removes upload files older than 24 hours."""
    try:
        now = time.time()
        for filename in os.listdir(UPLOAD_DIR):
            filepath = os.path.join(UPLOAD_DIR, filename)
            if os.path.isfile(filepath):
                # 86400 seconds = 24 hours
                if now - os.path.getmtime(filepath) > 86400:
                    os.remove(filepath)
    except Exception as e:
        print(f"Error during file cleanup: {e}")

def get_genai_client(x_api_key: Optional[str] = None):
    # Check if header API key is provided, otherwise fall back to environment variable
    api_key = x_api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="Gemini API Key is missing. Please set the GEMINI_API_KEY environment variable or provide it in the API Key input in the UI."
        )
    return genai.Client(api_key=api_key)

@app.post("/api/summarize")
async def summarize_paper(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    model_name: Optional[str] = "gemini-3.5-flash"
):
    # Run cleanup of old files in the background
    background_tasks.add_task(cleanup_old_files)

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    paper_id = str(uuid.uuid4())
    temp_file_path = os.path.join(UPLOAD_DIR, f"{paper_id}.pdf")

    try:
        # Save the uploaded file
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Read file bytes to send directly to Gemini API
        with open(temp_file_path, "rb") as f:
            pdf_bytes = f.read()

        client = get_genai_client(x_api_key)

        prompt = """
        You are an expert research analyst. Read the attached PDF research paper.
        Summarize the paper in simple, human-understandable, and engaging language. Avoid unnecessary jargon, and explain complex concepts if you must use them.
        Make sure you fill out all sections of the requested schema thoroughly:
        1. Title, authors, publication info.
        2. A simple plain-English abstract.
        3. The research gap (problem, limitations of old work, gap filled).
        4. The methodology (core breakthrough, steps, novelty).
        5. The architecture: If there is a model architecture, framework, or data flow proposed in the paper, describe it in detail and write a clean, valid Mermaid.js flowchart (graph TD) showing the flow of data or control. If there is no specific model architecture or system flow (e.g. it is a purely theoretical paper or experimental survey), set has_architecture to False and write a flowchart explaining the logical workflow/experimental pipeline. Make sure the Mermaid syntax is strictly valid.
        6. Key experimental results, datasets, and performance comparisons.
        7. Strengths and limitations.
        8. Practical, real-world takeaways.
        """

        # Generate structured content with automatic model fallback
        # If the requested model is overloaded (503) or restricted, try fallback models
        fallback_models = [model_name, "gemini-3.6-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
        unique_models = []
        for m in fallback_models:
            if m not in unique_models:
                unique_models.append(m)

        last_exception = None
        for m in unique_models:
            try:
                print(f"Attempting to generate summary with model: {m}")
                response = client.models.generate_content(
                    model=m,
                    contents=[
                        types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                        prompt
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=PaperSummary,
                        temperature=0.2
                    )
                )
                # Parse and return on success
                import json
                summary_data = json.loads(response.text)
                summary_data["paper_id"] = paper_id
                print(f"Success summarizing paper using model: {m}")
                return summary_data
            except Exception as e:
                print(f"Model {m} failed during summarization: {e}")
                last_exception = e

        raise last_exception

    except HTTPException:
        # Clean up file on failure
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        raise
    except Exception as e:
        # Clean up file on failure
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        raise HTTPException(status_code=500, detail=f"Failed to summarize paper: {str(e)}")

@app.post("/api/chat")
async def chat_with_paper(
    request: ChatRequest,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key")
):
    paper_path = os.path.join(UPLOAD_DIR, f"{request.paper_id}.pdf")
    if not os.path.exists(paper_path):
        raise HTTPException(status_code=404, detail="Summarized paper PDF not found. Please upload it again.")

    try:
        with open(paper_path, "rb") as f:
            pdf_bytes = f.read()

        client = get_genai_client(x_api_key)

        # Assemble the contents for conversational QA
        contents = []
        
        # 1. Attach the paper
        contents.append(types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"))
        
        # 2. Add system instructions/guidance
        contents.append(
            "You are a helpful research assistant chatbot. Answer the user's questions about the attached research paper. "
            "Explain things in a simple, human, and clear manner. Cite specific sections or findings of the paper in your answer. "
            "If the answer cannot be found in the paper, explain that, but provide general helpful context based on the field."
        )

        # 3. Add history in the format required by Gemini
        for msg in request.history:
            # Map roles to 'user' or 'model'
            role = "user" if msg.role == "user" else "model"
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg.content)]
                )
            )

        # 4. Add the latest user message
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=request.message)]
            )
        )

        # Call generate content with automatic model fallback
        fallback_models = [request.model_name, "gemini-3.6-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
        unique_models = []
        for m in fallback_models:
            if m not in unique_models:
                unique_models.append(m)

        last_exception = None
        for m in unique_models:
            try:
                print(f"Attempting chat with model: {m}")
                response = client.models.generate_content(
                    model=m,
                    contents=contents
                )
                print(f"Success responding to chat using model: {m}")
                return {"response": response.text}
            except Exception as e:
                print(f"Model {m} failed during chat: {e}")
                last_exception = e

        raise last_exception

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

@app.get("/api/pdf/{paper_id}")
async def get_pdf(paper_id: str):
    paper_path = os.path.join(UPLOAD_DIR, f"{paper_id}.pdf")
    if not os.path.exists(paper_path):
        raise HTTPException(status_code=404, detail="PDF file not found.")
    from fastapi.responses import FileResponse
    return FileResponse(paper_path, media_type="application/pdf")

# Mount frontend files (if frontend directory exists)
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
else:
    # If frontend doesn't exist yet, we will mount it later
    pass

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"\n=======================================================")
    print(f"🚀 InsightPaper Server Active!")
    print(f"👉 Open in Browser: http://127.0.0.1:{port}")
    print(f"=======================================================\n")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
