from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import extract, stream


# Create FastAPI app
app = FastAPI(
    title="Tether Intelligence LLM Service",
    description="Agentic DB Manager - Extract structured intelligence from natural language text",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(extract.router, prefix="/api", tags=["extract"])
app.include_router(stream.router, prefix="/api", tags=["stream"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model,
    }


@app.on_event("startup")
async def startup_event():
    """Startup event handler."""
    print("=" * 50)
    print("Tether Intelligence LLM Service")
    print("=" * 50)
    print(f"LLM Provider: {settings.llm_provider}")
    print(f"LLM Model: {settings.llm_model}")
    print(f"Supabase URL: {settings.supabase_url}")
    print("=" * 50)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
