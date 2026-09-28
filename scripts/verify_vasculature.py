"""Verify the transformation against labels released independently by the authors.

Pass --annotation-raw the decompressed little-endian uint32 Allen annotation_10.nrrd
payload. It has 1320 × 800 × 1140 voxels, AP fastest. Requires numpy and scipy.
"""
import argparse
import gzip
import json
from pathlib import Path
import numpy as np
from prepare_vasculature import ROOT, to_ccf

parser = argparse.ArgumentParser()
parser.add_argument("--annotation-raw", type=Path, required=True)
parser.add_argument("--report", type=Path, required=True)
args = parser.parse_args()
assert args.annotation_raw.stat().st_size == 1320 * 800 * 1140 * 4
atlas = np.memmap(args.annotation_raw, dtype="<u4", mode="r", shape=(1140, 800, 1320))
fixture = json.loads(gzip.decompress((ROOT / "tests/fixtures/vascular-registration.json.gz").read_bytes()))
ontology = json.loads((ROOT / "public/data/ontology.json").read_text())
by_id = {n["id"]: n for n in ontology}
by_acronym = {n["acronym"]: n for n in ontology}


def sample(points):
    coordinates = to_ccf(np.asarray(points), ROOT / "public/vasculature/adult")
    indices = np.floor(coordinates / 10 + .5).astype(int)
    valid = np.all((indices >= 0) & (indices < [1320, 800, 1140]), axis=1)
    labels = np.zeros(len(points), dtype=np.uint32)
    ap, dv, ml = indices[valid].T
    labels[valid] = atlas[ml, dv, ap]
    return labels


voxel_labels = sample(fixture["voxelPoints"])
# The author's NIfTI stores IDs in float32, which rounds large ontology IDs.
voxel_matches = np.count_nonzero(voxel_labels.astype(np.float32) == np.abs(fixture["voxelLabels"]))
voxel_coordinates = to_ccf(np.asarray(fixture["voxelPoints"]), ROOT / "public/vasculature/adult")
hemisphere_matches = np.count_nonzero((np.asarray(fixture["voxelLabels"]) < 0) == (voxel_coordinates[:, 2] < 5700))
group_matches = group_total = 0
for label, expected in zip(sample(fixture["graphPoints"]), fixture["graphGroups"]):
    if expected in ["bgr", "root"] or expected not in by_acronym:
        continue
    group_total += 1
    node, group = by_id.get(int(label)), by_acronym[expected]
    group_matches += bool(node and (node["color"] == group["color"] or group["id"] in node["structureIdPath"]))
report = {
    "voxelMatches": int(voxel_matches), "voxelSamples": len(voxel_labels),
    "voxelAgreement": float(voxel_matches / len(voxel_labels)),
    "hemisphereMatches": int(hemisphere_matches), "hemisphereSamples": len(voxel_labels),
    "graphGroupMatches": group_matches, "graphGroupSamples": group_total,
    "graphGroupAgreement": group_matches / group_total,
    "scope": "Coordinate conversion reproduction, not independent anatomical landmark accuracy.",
    "voxelCoverage": fixture["voxelCoverage"],
    "graphExclusions": "background, root, or groups absent from the local ontology",
}
args.report.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report))
assert report["voxelAgreement"] >= .99
assert hemisphere_matches == len(voxel_labels)
assert report["graphGroupAgreement"] >= .99
