from __future__ import annotations

from pydantic import BaseModel


class TranscribedWordItem(BaseModel):
    word: str
    start: float
    end: float
    probability: float = 1.0


class TranscribedSegmentItem(BaseModel):
    id: int
    start: float
    end: float
    text: str
    avg_logprob: float = 0.0
    no_speech_prob: float = 0.0


class TranscribeResponse(BaseModel):
    text: str
    language: str
    duration_seconds: float
    model_used: str
    processing_ms: int
    segments: list[TranscribedSegmentItem]
    words: list[TranscribedWordItem]
