from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class AlignLineInput(BaseModel):
    text: str = Field(min_length=1)
    start: float = Field(ge=0.0, allow_inf_nan=False)
    end: float = Field(gt=0.0, allow_inf_nan=False)

    @model_validator(mode="after")
    def validate_window(self) -> "AlignLineInput":
        if not self.text.strip() or self.end <= self.start:
            raise ValueError("Baris harus berisi teks dan end harus lebih besar dari start.")
        return self


class AlignedWordItem(BaseModel):
    word: str
    start: float
    end: float
    score: float = 1.0


class AlignedLineResult(BaseModel):
    index: int
    aligned: bool
    words: list[AlignedWordItem]


class AlignResponse(BaseModel):
    lines: list[AlignedLineResult]
    model_used: str
    processing_ms: int
    separated: bool = False
