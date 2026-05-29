import asyncio

class StreamStateProxy:
    """
    High-performance boolean proxy that allows dynamic state changes.
    Enables `from app.core.stream_state import STREAMING_ENABLED` to be imported
    directly while preserving mutable runtime evaluations across other modules.
    """
    def __init__(self, value: bool = True):
        self.value = value

    def __bool__(self):
        return self.value

    def __repr__(self):
        return str(self.value)

    def __eq__(self, other):
        if isinstance(other, StreamStateProxy):
            return self.value == other.value
        return self.value == other

    @property
    def enabled(self) -> bool:
        return self.value

    @enabled.setter
    def enabled(self, val: bool):
        self.value = val

# Centralized global thread-safe stream variables
STREAMING_ENABLED = StreamStateProxy(True)
STREAM_LOCK = asyncio.Lock()
