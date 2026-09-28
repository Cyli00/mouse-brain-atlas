"""Pack VesSAP / VesselGraph BL6J-no1 vessel edges in Allen CCF space.

Offline dependencies: numpy, scipy, pandas. Inputs remain in a temporary cache.
See DATA_SOURCES.md for provenance, coordinate checks and rendering limitations.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.ndimage import map_coordinates

ROOT = Path(__file__).resolve().parents[1]


def parameters(path):
    return {key: value.strip() for key, value in
            re.findall(r'\((\w+) ([^\n]*?)\)', path.read_text())}


def vector(params, key):
    return np.fromstring(params[key], sep=" ")


def to_ccf(points, transform_dir):
    rigid = parameters(transform_dir / "TransformParameters.0.FullRes.txt")
    spline = parameters(transform_dir / "TransformParameters.1.FullRes.txt")
    assert rigid["Transform"] == '"EulerTransform"'
    assert rigid["ComputeZYX"] == '"false"'
    assert spline["HowToCombineTransforms"] == '"Compose"'
    assert spline["BSplineTransformSplineOrder"] == "3"
    assert np.array_equal(vector(rigid, "Spacing"), [.1, .1, .1])
    angles = vector(rigid, "TransformParameters")
    center = vector(rigid, "CenterOfRotationPoint")
    cx, cy, cz = np.cos(angles[:3])
    sx, sy, sz = np.sin(angles[:3])
    rotation = (np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
                @ np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
                @ np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]))
    # Elastix Compose applies the initial rigid transform BEFORE the B-spline.
    physical = (points * .1 - center) @ rotation.T + center + angles[3:]
    grid = ((physical - vector(spline, "GridOrigin")) /
            vector(spline, "GridSpacing"))[:, ::-1].T
    coefficients = vector(spline, "TransformParameters").reshape(
        3, *vector(spline, "GridSize").astype(int)[::-1])
    displacement = np.stack([map_coordinates(c, grid, order=3, prefilter=False,
                                              mode="constant") for c in coefficients], axis=1)
    # Author grid axes are ML/AP/DV; 0.1 registration units represent 3 µm.
    # Undo voxel-centre resampling from the 10 µm atlas to the author's 3 µm grid.
    return (physical + displacement)[:, [1, 2, 0]] * 30 - 3.5


def sha(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8 * 1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--graph", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=ROOT / "public/vasculature/adult")
    args = parser.parse_args()
    out = args.output
    out.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.graph) as archive:
        nodes_name = next(n for n in archive.namelist() if n.endswith("nodes_processed.csv"))
        edges_name = next(n for n in archive.namelist() if n.endswith("edges_processed.csv"))
        with archive.open(nodes_name) as f:
            nodes = pd.read_csv(f, sep=";", usecols=["id", "pos_x", "pos_y", "pos_z"])
        assert np.array_equal(nodes.id.to_numpy(), np.arange(len(nodes)))
        parts = []
        with archive.open(edges_name) as f:
            for chunk in pd.read_csv(f, sep=";", usecols=["node1id", "node2id", "avgRadiusAvg"],
                                     chunksize=250000):
                parts.append(chunk[chunk.avgRadiusAvg >= 6])
        edges = pd.concat(parts).sort_values("avgRadiusAvg", ascending=False, kind="stable")
    indices = edges[["node1id", "node2id"]].to_numpy().astype(int)
    unique, inverse = np.unique(indices, return_inverse=True)
    ccf = to_ccf(nodes[["pos_x", "pos_y", "pos_z"]].to_numpy()[unique], out)
    positions = ccf[inverse].reshape(-1, 6).astype("<f4")
    assert np.isfinite(positions).all()
    assert np.all((ccf > -1000) & (ccf < np.array([14200, 9000, 12400])))
    packed = gzip.compress(positions.tobytes(), compresslevel=9, mtime=0)
    binary = out / "segments.float32.gz"
    binary.write_bytes(packed)
    manifest = {
        "dataset": "VesSAP / VesselGraph BL6J-no1", "stage": "adult",
        "license": "CC-BY-NC-4.0", "licenseUrl": "https://creativecommons.org/licenses/by-nc/4.0/",
        "attribution": "Todorov et al., Nature Methods 2020; Paetzold et al., NeurIPS Datasets and Benchmarks 2021.",
        "sourceVoxelSpacingUm": 3,
        "coordinateSpace": "Allen CCFv3 2017", "axisOrder": ["AP", "DV", "ML"],
        "units": "um", "representation": "straight graph edges between measured vessel nodes",
        "minimumSourceDiameterUm": 36, "segmentCount": len(edges),
        "countsByMinimumDiameterUm": {str(d): int((edges.avgRadiusAvg * 6 >= d).sum()) for d in [36, 48, 60]},
        "segments": {"url": "/vasculature/adult/segments.float32.gz", "bytes": len(packed),
                     "uncompressedBytes": positions.nbytes, "sha256": sha(binary)},
        "sources": {
            "paper": "https://doi.org/10.1038/s41592-020-0792-1",
            "graphs": "https://github.com/jocpae/VesselGraph",
            "graphUrl": "https://syncandshare.lrz.de/dl/fiVTuLxJeLrqyWdMBy5BGrug/C57BL_6_no1.zip",
            "graphSha256": sha(args.graph),
            "transformsGuide": "https://discotechnologies.org/VesSAP/",
        },
        "transforms": {name: sha(out / name) for name in
                       ["TransformParameters.0.FullRes.txt", "TransformParameters.1.FullRes.txt"]},
        "limitations": ["One adult specimen, not a population vascular atlas.",
                        "Straight edges approximate paths; no vessel walls or artery/vein classification.",
                        "Source diameters are estimates before atlas deformation; smaller vessels omitted.",
                        "Registration reproduction checks do not measure biological landmark error."]
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"segments": len(edges), "bytes": len(packed), "levels": manifest["countsByMinimumDiameterUm"]}))


if __name__ == "__main__":
    main()
