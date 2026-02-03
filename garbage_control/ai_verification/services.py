from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

from django.conf import settings


@dataclass
class AIVerifyOutput:
    is_clean: bool
    score: float | None = None
    details: dict[str, Any] | None = None


def _get_model_path() -> Path:
    model_path = getattr(settings, "AI_MODEL_PATH", None)
    if model_path is None:
        raise RuntimeError("AI_MODEL_PATH is not configured in settings.")
    path = Path(model_path)
    if not path.is_file():
        raise FileNotFoundError(f"AI model not found: {path}")
    return path


@lru_cache(maxsize=1)
def _load_model():
    try:
        from ultralytics import YOLO
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("ultralytics is required for AI verification.") from exc

    return YOLO(str(_get_model_path()))


def _get_class_names_map(model) -> dict[int, str] | None:
    names = None
    if hasattr(model, "names"):
        names = model.names
    elif hasattr(model, "model") and hasattr(model.model, "names"):
        names = model.model.names

    if names is None:
        return None

    if isinstance(names, dict):
        return {int(k): str(v) for k, v in names.items()}

    if isinstance(names, (list, tuple)):
        return {idx: str(name) for idx, name in enumerate(names)}

    return None


def _resolve_class_ids(model) -> list[int] | None:
    class_ids = getattr(settings, "AI_GARBAGE_CLASS_IDS", None)
    class_names = getattr(settings, "AI_GARBAGE_CLASS_NAMES", None)

    if class_ids:
        if isinstance(class_ids, int):
            return [class_ids]
        return [int(v) for v in class_ids]

    if class_names:
        if isinstance(class_names, str):
            class_names = [class_names]

        names_map = _get_class_names_map(model)
        if not names_map:
            raise RuntimeError("AI_GARBAGE_CLASS_NAMES is set but model class names are unavailable.")

        resolved = []
        for name in class_names:
            for idx, label in names_map.items():
                if label == name:
                    resolved.append(idx)

        if not resolved:
            raise RuntimeError(f"No class ids found for names: {class_names}")
        return sorted(set(resolved))

    return None


def _count_detections(
    results: Iterable,
    class_ids: list[int] | None,
    conf_threshold: float,
) -> tuple[int, dict[int, int]]:
    total = 0
    per_class: dict[int, int] = {}
    class_filter = set(class_ids) if class_ids else None

    for result in results:
        boxes = getattr(result, "boxes", None)
        if boxes is None:
            continue

        cls_list = boxes.cls.tolist() if hasattr(boxes, "cls") else []
        conf_list = boxes.conf.tolist() if hasattr(boxes, "conf") else []

        for cls_id, conf in zip(cls_list, conf_list):
            cls_id_int = int(cls_id)
            if class_filter and cls_id_int not in class_filter:
                continue
            if float(conf) < conf_threshold:
                continue
            total += 1
            per_class[cls_id_int] = per_class.get(cls_id_int, 0) + 1

    return total, per_class


def verify_cleanup(before_path: str, after_path: str) -> AIVerifyOutput:
    model = _load_model()
    class_ids = _resolve_class_ids(model)
    conf_threshold = float(getattr(settings, "AI_CONF_THRESHOLD", 0.25))
    device = getattr(settings, "AI_DEVICE", None)

    predict_kwargs: dict[str, Any] = {
        "conf": conf_threshold,
        "verbose": False,
        "save": False,
    }
    if device:
        predict_kwargs["device"] = device
    if class_ids:
        predict_kwargs["classes"] = class_ids

    before_results = model.predict(source=str(before_path), **predict_kwargs)
    after_results = model.predict(source=str(after_path), **predict_kwargs)

    before_count, before_by_class = _count_detections(before_results, class_ids, conf_threshold)
    after_count, after_by_class = _count_detections(after_results, class_ids, conf_threshold)

    if before_count == 0:
        reduction = 1.0 if after_count == 0 else 0.0
    else:
        reduction = max(0.0, (before_count - after_count) / before_count)

    max_after = int(getattr(settings, "AI_MAX_AFTER", 0))
    min_reduction = float(getattr(settings, "AI_MIN_REDUCTION", 0.8))

    is_clean = (after_count <= max_after) or (reduction >= min_reduction)

    details = {
        "before_count": before_count,
        "after_count": after_count,
        "before_by_class": before_by_class,
        "after_by_class": after_by_class,
        "reduction": reduction,
        "class_filter": class_ids,
        "conf_threshold": conf_threshold,
        "model_path": str(_get_model_path()),
    }

    return AIVerifyOutput(is_clean=is_clean, score=reduction, details=details)


def detect_garbage_before(before_path: str) -> AIVerifyOutput:
    model = _load_model()
    class_ids = _resolve_class_ids(model)
    conf_threshold = float(getattr(settings, "AI_CONF_THRESHOLD", 0.25))
    device = getattr(settings, "AI_DEVICE", None)

    predict_kwargs: dict[str, Any] = {
        "conf": conf_threshold,
        "verbose": False,
        "save": False,
    }
    if device:
        predict_kwargs["device"] = device
    if class_ids:
        predict_kwargs["classes"] = class_ids

    before_results = model.predict(source=str(before_path), **predict_kwargs)
    before_count, before_by_class = _count_detections(before_results, class_ids, conf_threshold)

    details = {
        "stage": "before",
        "before_count": before_count,
        "before_by_class": before_by_class,
        "class_filter": class_ids,
        "conf_threshold": conf_threshold,
        "model_path": str(_get_model_path()),
    }

    has_garbage = before_count > 0
    return AIVerifyOutput(is_clean=not has_garbage, score=None, details=details)
