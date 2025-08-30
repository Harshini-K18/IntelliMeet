from transformers import pipeline
from app.core.config import settings

_summarizer = None

def _get():
    global _summarizer
    if _summarizer is None:
        _summarizer = pipeline("summarization", model=settings.HF_SUMMARIZER)
    return _summarizer

def summarize_long(text: str, max_chunk_chars: int = 3000):
    if not text.strip():
        return ""
    summ = _get()
    chunks, buf = [], []
    total = 0
    for token in text.split():
        buf.append(token)
        total += len(token) + 1
        if total > max_chunk_chars:
            chunks.append(" ".join(buf))
            buf, total = [], 0
    if buf: chunks.append(" ".join(buf))

    partials = []
    for c in chunks:
        out = summ(c, max_length=220, min_length=60, do_sample=False)[0]["summary_text"]
        partials.append(out)
    if len(partials) == 1:
        return partials[0]
    # final pass
    final = summ(" ".join(partials), max_length=250, min_length=80, do_sample=False)[0]["summary_text"]
    return final
