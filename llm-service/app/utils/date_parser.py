import dateparser
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def parse_natural_date(date_str: str) -> datetime:
    """
    Parse natural language dates to datetime objects.

    Handles:
    - Relative dates: "today", "yesterday", "tomorrow", "last Friday"
    - Absolute dates: "March 31", "2024-12-11", "31st December 2024"
    - Complex dates: "last week", "next month", "3 days ago"

    Args:
        date_str: Natural language date string

    Returns:
        datetime object (defaults to current time if parsing fails)
    """
    if not date_str or not date_str.strip():
        return datetime.now()

    # Use dateparser library for robust parsing
    parsed_date = dateparser.parse(
        date_str,
        settings={
            "PREFER_DATES_FROM": "past",  # Assume past dates by default
            "RELATIVE_BASE": datetime.now(),
            "RETURN_AS_TIMEZONE_AWARE": False,
        },
    )

    # If parsing fails, default to current time
    if parsed_date is None:
        logger.warning(f"Could not parse date '{date_str}', defaulting to current time")
        return datetime.now()

    return parsed_date


def format_datetime_for_db(dt: datetime) -> str:
    """
    Format datetime for database storage (ISO 8601 format).

    Args:
        dt: datetime object

    Returns:
        ISO formatted string (e.g., "2024-12-11T14:30:00")
    """
    return dt.isoformat()


def parse_and_format_date(date_str: str) -> str:
    """
    Parse natural language date and format for database storage.

    Args:
        date_str: Natural language date string

    Returns:
        ISO formatted date string
    """
    dt = parse_natural_date(date_str)
    return format_datetime_for_db(dt)
