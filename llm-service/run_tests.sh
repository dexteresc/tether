#!/bin/bash

# Test runner script for LLM service tests
#
# Usage:
#   ./run_tests.sh           # Fast mode (uses VCR cassettes, no Ollama required)
#   ./run_tests.sh --record  # Recording mode (requires Ollama, updates cassettes)

MODE="fast"

# Parse arguments
if [ "$1" = "--record" ] || [ "$1" = "-r" ]; then
    MODE="record"
fi

echo "=========================================="
echo "LLM Service Tests"
echo "Mode: $MODE"
echo "=========================================="
echo ""

if [ "$MODE" = "record" ]; then
    # Recording mode - requires Ollama
    echo "Recording mode: Will update VCR cassettes"
    echo ""

    # Check if Ollama is running
    echo "Checking Ollama availability..."
    if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "ERROR: Ollama is not running!"
        echo "Please start Ollama first:"
        echo "  ollama serve"
        exit 1
    fi

    # Check if qwen2.5:7b model is available
    echo "Checking for qwen2.5:7b model..."
    if ! ollama list | grep -q "qwen2.5:7b"; then
        echo "Model qwen2.5:7b not found. Pulling it now..."
        ollama pull qwen2.5:7b
    fi

    echo "✓ Ollama is running"
fi

# Check if Supabase is running (required for both modes)
echo "Checking Supabase availability..."
if ! curl -s http://127.0.0.1:54321/rest/v1/ > /dev/null 2>&1; then
    echo "ERROR: Supabase is not running!"
    echo "Please start Supabase first:"
    echo "  supabase start"
    exit 1
fi

echo "✓ Supabase is running"
echo ""

# Run tests
if [ "$MODE" = "record" ]; then
    echo "Running tests in RECORDING mode (updating cassettes)..."
    echo ""
    python -m pytest tests/ -v --record-mode=rewrite
else
    echo "Running tests in FAST mode (using cassettes)..."
    echo ""
    python -m pytest tests/ -v
fi

echo ""
echo "=========================================="
echo "Tests completed!"
echo "=========================================="
