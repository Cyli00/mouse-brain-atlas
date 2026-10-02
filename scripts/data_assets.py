"""Shared deterministic byte formats for offline atlas preparation."""
from __future__ import annotations

import gzip
import hashlib
import struct
from pathlib import Path


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def file_digest(path: Path, algorithm: str = "sha256") -> str:
    digest = hashlib.new(algorithm)
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def mesh_bytes(vertex_count: int, triangle_count: int, vertices: bytes, triangles: bytes) -> bytes:
    if vertex_count <= 0 or triangle_count <= 0:
        raise ValueError("A mesh needs vertices and triangles")
    if len(vertices) != vertex_count * 12 or len(triangles) != triangle_count * 12:
        raise ValueError("Mesh buffers must contain three little-endian 32-bit values per item")
    return struct.pack("<II", vertex_count, triangle_count) + vertices + triangles


def write_gzip(path: Path, raw: bytes, *, uncompressed_hash: bool = True) -> dict:
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(compressed)
    result = {
        "bytes": len(compressed), "uncompressedBytes": len(raw),
        "sha256": sha256(compressed),
    }
    if uncompressed_hash:
        result["uncompressedSha256"] = sha256(raw)
    return result
