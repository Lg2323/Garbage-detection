from dataclasses import dataclass
from typing import Any


@dataclass
class AIVerifyOutput:
    is_clean: bool
    score: float | None = None
    details: dict[str, Any] | None = None


def verify_cleanup(before_path: str, after_path: str) -> AIVerifyOutput:
    """
    Заглушка.
    Позже здесь будет:
    - детекция мусора на before
    - детекция мусора на after
    - сравнение/правило принятия
    """
    return AIVerifyOutput(
        is_clean=True,
        score=0.5,
        details={"note": "stub verifier, replace with ML inference"}
    )
