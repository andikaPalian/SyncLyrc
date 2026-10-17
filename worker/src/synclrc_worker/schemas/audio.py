from pydantic import BaseModel, HttpUrl


class AudioUrlRequest(BaseModel):
    url: HttpUrl
