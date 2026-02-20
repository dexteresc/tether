"""
Fuzzy Matching Utilities using RapidFuzz (Feature 003)

This module provides helper functions for fuzzy string matching using
the Jaro-Winkler algorithm via RapidFuzz.
"""

from rapidfuzz.distance import JaroWinkler


def jaro_winkler_similarity(str1: str, str2: str) -> float:
    """
    Calculate Jaro-Winkler similarity between two strings.

    Args:
        str1: First string to compare
        str2: Second string to compare

    Returns:
        Similarity score between 0.0 (no match) and 1.0 (exact match)
    """
    if not str1 or not str2:
        return 0.0

    # Normalize to lowercase for case-insensitive comparison
    str1_lower = str1.lower()
    str2_lower = str2.lower()

    # Calculate Jaro-Winkler similarity
    similarity = JaroWinkler.similarity(str1_lower, str2_lower)

    return similarity


def extract_first_name(full_name: str) -> str:
    """
    Extract the first name from a full name string.

    Args:
        full_name: Full name string (e.g., "John Smith", "John")

    Returns:
        First name component
    """
    if not full_name:
        return ""

    parts = full_name.strip().split()
    return parts[0] if parts else ""
