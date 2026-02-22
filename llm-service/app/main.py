from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import extract, stream


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 50)
    print("Tether Intelligence LLM Service")
    print(f"LLM Provider: {settings.llm_provider}")
    print("=" * 50)
    yield


app = FastAPI(
    title="Tether Intelligence LLM Service",
    description="Agentic DB Manager - Extract structured intelligence from natural language text",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(extract.router, prefix="/api", tags=["extract"])
app.include_router(stream.router, prefix="/api", tags=["stream"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "provider": settings.llm_provider,
        "model": settings.llm_model,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
