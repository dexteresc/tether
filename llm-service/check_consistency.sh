#!/bin/bash

# Consistency Check Script
# Runs the test suite 5 times consecutively to verify 100% pass rate

RUNS=5
PASS_COUNT=0
FAIL_COUNT=0

echo "=========================================="
echo "LLM Service Consistency Check"
echo "Running test suite $RUNS times..."
echo "=========================================="
echo ""

for i in $(seq 1 $RUNS); do
    echo "----------------------------------------"
    echo "Run $i of $RUNS"
    echo "----------------------------------------"

    # Run tests
    python -m pytest tests/ -v --tb=line -q

    if [ $? -eq 0 ]; then
        echo "✓ Run $i: PASSED"
        ((PASS_COUNT++))
    else
        echo "✗ Run $i: FAILED"
        ((FAIL_COUNT++))
    fi

    echo ""
done

echo "=========================================="
echo "Consistency Check Summary"
echo "=========================================="
echo "Total runs: $RUNS"
echo "Passed: $PASS_COUNT"
echo "Failed: $FAIL_COUNT"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo "✓ 100% PASS RATE - All tests are consistent!"
    echo "=========================================="
    exit 0
else
    SUCCESS_RATE=$((PASS_COUNT * 100 / RUNS))
    echo "✗ INCONSISTENT - Success rate: $SUCCESS_RATE%"
    echo "=========================================="
    exit 1
fi
