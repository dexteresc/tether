#!/bin/bash

# Test runner script for LLM service integration tests

echo "=========================================="
echo "LLM Service Integration Tests"
echo "=========================================="
echo ""

# Check if Ollama is running
echo "Checking Ollama availability..."
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "ERROR: Ollama is not running!"
    echo "Please start Ollama first:"
    echo "  ollama serve"
    exit 1
fi

# Check if llama3.2 model is available
echo "Checking for llama3.2 model..."
if ! ollama list | grep -q "llama3.2"; then
    echo "Model llama3.2 not found. Pulling it now..."
    ollama pull llama3.2
fi

# Check if Supabase is running
echo "Checking Supabase availability..."
if ! curl -s http://127.0.0.1:54321/rest/v1/ > /dev/null 2>&1; then
    echo "ERROR: Supabase is not running!"
    echo "Please start Supabase first:"
    echo "  supabase start"
    exit 1
fi

echo ""
echo "✓ Ollama is running"
echo "✓ Supabase is running"
echo ""

# Set Python path
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Run tests
echo "Running integration tests..."
echo ""
python -m pytest tests/test_integration.py -v -s --tb=short

echo ""
echo "=========================================="
echo "Tests completed!"
echo "=========================================="
