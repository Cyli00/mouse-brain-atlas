"""Register the MICe CBA anatomical labels to the bundled Allen CCF annotation.

Dependencies: numpy, scipy, nibabel, pillow. All fitting uses anatomical labels;
vessel locations are never fitting targets. The output maps MINC RAS millimetres
to CCF AP/DV/ML micrometres and records separate, unused anatomical checks.
"""
from __future__ import annotations

import argparse
import gzip
import importlib.metadata
import json
from pathlib import Path

import nibabel as nib
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage, optimize, spatial

from data_assets import file_digest as sha

ROOT = Path(__file__).resolve().parents[1]

# MICe's key uses gross structures. Allen descendants are grouped explicitly;
# MICe's left olfactory bulb is 140 in the volume (the PDF prints 14).
REGIONS = [
    ("olfactory bulb", (140, 198), (507, 151), "fit"),
    ("striatum / caudoputamen", (42, 154), (672,), "fit"),
    ("thalamus", (102, 9), (549,), "fit"),
    ("midbrain", (223, 225), (313,), "fit"),
    ("cerebellum including arbor vitae", (199, 19), (512, 728), "fit"),
    ("hippocampus including fimbria", (58, 44), (1080, 603), "check"),
    ("hypothalamus", (229, 200), (1097,), "fit"),
    ("pons", (33, 35), (771,), "check"),
    ("medulla", (66, 61), (354,), "check"),
    ("globus pallidus", (100, 3), (1022, 1031), "check"),
    ("corpus callosum", (34, 4), (776,), "check"),
    ("anterior commissure", (22, 23), (900, 908), "check"),
    ("fasciculus retroflexus", (201, 216), (595,), "check"),
]


def apply(matrix, points):
    return np.asarray(points) @ matrix[:3, :3].T + matrix[:3, 3]


def surface(mask):
    return mask & ~ndimage.binary_erosion(mask)


def points(mask, affine, maximum=None):
    indices = np.argwhere(mask)
    if maximum and len(indices) > maximum:
        indices = indices[np.linspace(0, len(indices) - 1, maximum, dtype=int)]
    return apply(affine, indices)


def centroid(mask, affine):
    return apply(affine, np.argwhere(mask).mean(axis=0))


def field(mask, spacing):
    outside = ndimage.distance_transform_edt(~mask, sampling=spacing)
    inside = ndimage.distance_transform_edt(mask, sampling=spacing)
    return (outside - inside).astype(np.float32)


def sample(values, index_from_world, world):
    return ndimage.map_coordinates(values, apply(index_from_world, world).T,
                                   order=1, prefilter=False, mode="constant", cval=3.)


def matrix_from_parameters(parameters):
    result = np.eye(4)
    result[:3] = parameters.reshape(3, 4)
    return result


def boundary_metrics(source_mask, target_mask, source_affine, target_affine, matrix):
    src = apply(matrix, points(surface(source_mask), source_affine))
    dst = points(surface(target_mask), target_affine)
    distances = np.concatenate([spatial.cKDTree(dst).query(src)[0],
                                spatial.cKDTree(src).query(dst)[0]]) * 1000
    # Resampling is only for overlap measurement; output vessel meshes retain
    # their native 32-µm sampling before applying the fitted physical transform.
    back = np.linalg.inv(source_affine) @ np.linalg.inv(matrix) @ target_affine
    moved = ndimage.affine_transform(source_mask.astype(np.uint8), back[:3, :3],
                                    offset=back[:3, 3], output_shape=target_mask.shape,
                                    order=0, prefilter=False).astype(bool)
    return {
        "dice": float(2 * np.count_nonzero(moved & target_mask) /
                      (np.count_nonzero(moved) + np.count_nonzero(target_mask))),
        "centroidDistanceUm": float(np.linalg.norm(
            apply(matrix, centroid(source_mask, source_affine)) -
            centroid(target_mask, target_affine)) * 1000),
        "meanSymmetricSurfaceDistanceUm": float(distances.mean()),
        "symmetricSurfaceDistance95Um": float(np.percentile(distances, 95)),
    }


def cortical_envelope_metrics(source, target, source_affine, target_affine, matrix, cortex_ids):
    back = np.linalg.inv(source_affine) @ np.linalg.inv(matrix) @ target_affine
    moved = ndimage.affine_transform(source.astype(np.uint8), back[:3, :3],
                                    offset=back[:3, 3], output_shape=target.shape,
                                    order=0, prefilter=False).astype(bool)
    native = target > 0
    cortex = np.isin(target, cortex_ids)
    result = {}
    for axis, reverse, name in [(1, False, "dorsal"), (2, False, "leftLateral"),
                                 (2, True, "rightLateral")]:
        a, b, c = moved, native, cortex
        if reverse:
            a, b, c = [np.flip(v, axis) for v in (a, b, c)]
        source_boundary, target_boundary = a.argmax(axis), b.argmax(axis)
        superficial_cortex = np.take_along_axis(c, np.expand_dims(target_boundary, axis),
                                                axis=axis).squeeze(axis)
        valid = a.any(axis) & b.any(axis) & superficial_cortex
        # Positive values mean the transformed MICe brain lies inside the Allen
        # outer surface along this ray. This does not measure vessel accuracy.
        offsets = (source_boundary[valid] - target_boundary[valid]) * target_affine[axis, axis] * 1000
        result[name] = {"rayCount": int(valid.sum()), "medianSignedInwardOffsetUm": float(np.median(offsets)),
                        "meanAbsoluteOffsetUm": float(np.abs(offsets).mean()),
                        "absoluteOffset95Um": float(np.percentile(np.abs(offsets), 95))}
    result["definition"] = "First nonzero voxel along dorsal/left/right rays; only rays whose Allen exterior voxel belongs to Isocortex are included. Uses 50-um nearest-neighbour resampling, and describes template surface agreement, not vessel landmark error."
    return result


def make_preview(source, target, source_affine, target_affine, matrix, destination):
    back = np.linalg.inv(source_affine) @ np.linalg.inv(matrix) @ target_affine
    moved = ndimage.affine_transform(source, back[:3, :3], offset=back[:3, 3],
                                    output_shape=target.shape, order=0, prefilter=False)
    canvas = Image.new("RGB", (1200, 660), "#151a24")
    draw = ImageDraw.Draw(canvas)
    draw.text((20, 12), "MICe CBA -> Allen CCF: cyan=Allen outline; orange=MICe outline", fill="white")
    for column, (axis, index, name) in enumerate([(0, 120, "coronal AP=6.0 mm"),
                                               (1, 80, "horizontal DV=4.0 mm"),
                                               (2, 114, "sagittal ML=5.7 mm")]):
        for row, (src, dst, title) in enumerate([
                (moved > 0, target > 0, "brain extent"),
                (np.isin(moved, [sid for _, ids, _, use in REGIONS if use == "check" for sid in ids]),
                 np.isin(target, [ids[0] for _, _, ids, use in REGIONS if use == "check"]),
                 "held-out regions")]):
            a = np.take(src, index, axis=axis).T
            b = np.take(dst, index, axis=axis).T
            image = np.zeros((*a.shape, 3), dtype=np.uint8)
            image[a | b] = (35, 45, 55)
            image[b & ~ndimage.binary_erosion(b)] = (70, 215, 235)
            image[a & ~ndimage.binary_erosion(a)] = (255, 150, 55)
            tile = Image.fromarray(image).resize((380, 260), Image.Resampling.NEAREST)
            x, y = 10 + column * 400, 70 + row * 300
            canvas.paste(tile, (x, y))
            draw.text((x, y - 22), name + " | " + title, fill="white")
    canvas.save(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--brain-labels", type=Path, required=True)
    parser.add_argument("--atlas", type=Path, default=ROOT / "public/data")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    image = nib.load(args.brain_labels)
    source = np.rint(np.asarray(image.dataobj)).astype(np.uint16)
    source_affine = image.affine
    assert nib.aff2axcodes(source_affine) == ("R", "A", "S")
    manifest = json.loads((args.atlas / "manifest.json").read_text())
    assert manifest["annotationVersion"] == "ccf_2017"
    assert manifest["axisOrder"] == ["AP", "DV", "ML"]
    target = np.frombuffer(gzip.decompress((args.atlas / "annotation.uint32.gz").read_bytes()),
                           dtype="<u4").reshape(manifest["dimensions"], order="F")
    target_affine = np.diag([*(np.array(manifest["spacingUm"]) / 1000), 1.])
    ontology = json.loads((args.atlas / "ontology.json").read_text())
    masks, source_centroids, target_centroids = [], [], []
    for name, source_ids, target_ids, use in REGIONS:
        descendants = [entry["id"] for entry in ontology
                       if set(entry["structureIdPath"]) & set(target_ids)]
        gross_mask = np.isin(target, descendants)
        for side, source_id in enumerate(source_ids):
            a = source == source_id
            b = gross_mask.copy()
            # Hemisphere follows the CCF physical midline, not the array midpoint.
            if side == 0:
                b[:, :, 114:] = False
            else:
                b[:, :, :114] = False
            assert a.any() and b.any(), (name, side)
            masks.append((name, side, source_id, list(target_ids), use, a, b))
            if use == "fit":
                source_centroids.append(centroid(a, source_affine))
                target_centroids.append(centroid(b, target_affine))
    source_centroids, target_centroids = map(np.array, (source_centroids, target_centroids))
    initial = np.eye(4)
    initial[:3] = np.linalg.lstsq(np.c_[source_centroids, np.ones(len(source_centroids))],
                                 target_centroids, rcond=None)[0].T
    assert np.linalg.det(initial[:3, :3]) > 0
    fitting = []
    small_source_affine, small_target_affine = source_affine.copy(), target_affine.copy()
    small_source_affine[:3, :3] *= 2
    small_target_affine[:3, :3] *= 2
    for _, _, _, _, use, a, b in masks:
        if use == "fit":
            fitting.append((a[::2, ::2, ::2], b[::2, ::2, ::2], 400, .4))
    fitting.append((ndimage.binary_fill_holes(source[::2, ::2, ::2] > 0),
                    ndimage.binary_fill_holes(target[::2, ::2, ::2] > 0), 3500, 2.))
    terms = []
    for a, b, maximum, weight in fitting:
        source_points = points(surface(a), small_source_affine, maximum)
        target_points = points(surface(b), small_target_affine, maximum)
        terms.append((source_points, target_points,
                      field(a, np.linalg.norm(small_source_affine[:3, :3], axis=0)),
                      field(b, np.diag(small_target_affine)[:3]), weight))
    source_indices = np.linalg.inv(small_source_affine)
    target_indices = np.linalg.inv(small_target_affine)

    def residual(parameters):
        matrix = matrix_from_parameters(parameters)
        inverse = np.linalg.inv(matrix)
        residuals = []
        for a, b, source_field, target_field, weight in terms:
            residuals.append(weight * sample(target_field, target_indices, apply(matrix, a)))
            residuals.append(weight * sample(source_field, source_indices, apply(inverse, b)))
        # Keep the named-region correspondence while refining boundary overlap.
        residuals.append(((apply(matrix, source_centroids) - target_centroids) * 4).ravel())
        residuals.append(((matrix[:3, :3] - initial[:3, :3]) * 2).ravel())
        return np.concatenate(residuals)

    parameters = initial[:3].ravel()
    tolerance = np.tile([.35, .35, .35, 1.5], 3)
    result = optimize.least_squares(residual, parameters,
                                    bounds=(parameters - tolerance, parameters + tolerance),
                                    loss="soft_l1", f_scale=.2, max_nfev=100,
                                    ftol=1e-7, xtol=1e-7, gtol=1e-7)
    matrix = matrix_from_parameters(result.x)
    assert np.linalg.det(matrix[:3, :3]) > 0
    assert matrix[2, 0] > 0 and matrix[0, 1] < 0 and matrix[1, 2] < 0
    metrics = []
    for name, side, source_id, target_ids, use, a, b in masks:
        metrics.append({"name": name, "side": ["left", "right"][side],
                        "sourceId": source_id, "allenAncestorIds": target_ids, "use": use,
                        **boundary_metrics(a, b, source_affine, target_affine, matrix)})
    whole = boundary_metrics(source > 0, target > 0, source_affine, target_affine, matrix)
    outer = boundary_metrics(ndimage.binary_fill_holes(source > 0),
                             ndimage.binary_fill_holes(target > 0), source_affine, target_affine, matrix)
    cortex_ids = [entry["id"] for entry in ontology if 315 in entry["structureIdPath"]]
    envelopes = cortical_envelope_metrics(source > 0, target, source_affine, target_affine, matrix, cortex_ids)
    held_out = [entry for entry in metrics if entry["use"] == "check"]
    matrix_um = matrix.copy()
    matrix_um[:3] *= 1000
    report = {
        "method": "12-parameter affine, initialized by 12 named bilateral region centroids; optimized symmetric signed-distance surfaces of the same 12 regions and whole brain mask",
        "coordinateSpace": "Allen CCFv3 2017",
        "sourceWorldRasMmToCcfUm": matrix_um.tolist(),
        "sourceWorldRasMmToCcfMm": matrix.tolist(),
        "sourceBrainIndexToWorldRasMm": source_affine.tolist(),
        "initialCentroidAffineToCcfMm": initial.tolist(),
        "sources": {
            "brainLabelsUrl": "https://www.mouseimaging.ca/mnc/cerebral_vasc_atlas/cba_brain_labels.mnc",
            "brainLabelsSha256": sha(args.brain_labels),
            "allenAnnotationSha256": sha(args.atlas / "annotation.uint32.gz"),
            "keyUrl": "https://www.mouseimaging.ca/technologies/mouse_atlas/cerebral_vasc_atlas/mouse_vasculature_atlas_key.pdf",
        },
        "optimizer": {"converged": bool(result.success), "message": result.message,
                      "evaluations": result.nfev,
                      "initialRmsMm": float(np.sqrt(np.mean(residual(parameters) ** 2))),
                      "finalRmsMm": float(np.sqrt(np.mean(residual(result.x) ** 2))),
                      "linearDeterminant": float(np.linalg.det(matrix[:3, :3]))},
        "fitConfiguration": {"sourceFitGridUm": 128, "targetFitGridUm": 100,
                             "regionSurfaceSamplesPerHemisphere": 400, "regionSurfaceWeight": .4,
                             "filledWholeBrainSurfaceSamples": 3500, "wholeBrainSurfaceWeight": 2.,
                             "centroidWeight": 4., "affinePriorWeight": 2.,
                             "loss": "soft_l1", "lossScaleMm": .2,
                             "linearCoefficientBoundsFromInitial": .35, "translationBoundsFromInitialMm": 1.5,
                             "sampling": "deterministic evenly spaced surface voxel indices"},
        "dependencies": {name: importlib.metadata.version(name) for name in ["numpy", "scipy", "nibabel", "pillow"]},
        "wholeBrain": whole,
        "filledBrainExterior": outer,
        "corticalExteriorEnvelopes": envelopes,
        "regions": metrics,
        "heldOut": {
            "count": len(held_out),
            "medianCentroidDistanceUm": float(np.median([e["centroidDistanceUm"] for e in held_out])),
            "medianMeanSurfaceDistanceUm": float(np.median([e["meanSymmetricSurfaceDistanceUm"] for e in held_out])),
            "maximumSurfaceDistance95Um": float(max(e["symmetricSurfaceDistance95Um"] for e in held_out)),
        },
        "limitations": [
            "A newly fitted inter-atlas affine, not an author-supplied MICe-to-Allen transformation.",
            "MICe CBA and Allen C57BL/6J anatomy and delineation protocols differ; gross-region correspondences are approximate.",
            "Held-out region boundaries did not contribute to the objective, but share the brain volume and outer mask used in fitting; they are not independent specimens or vessel landmarks.",
            "Boundary distances and overlap quantify anatomical label agreement, not individual vessel localization error or a surgical safety margin.",
            "One vascular specimen, no skull or individual-animal registration, no nonlinear correction.",
            "Brain labels contain left olfactory bulb ID 140, whereas the published label key prints 14; identity was checked by bilateral location and shape.",
        ],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    # Use top-level held-out IDs in the preview so descendants remain visible.
    preview_target = target.copy()
    for _, _, target_ids, use in REGIONS:
        if use == "check":
            descendants = [entry["id"] for entry in ontology
                           if set(entry["structureIdPath"]) & set(target_ids)]
            preview_target[np.isin(target, descendants)] = target_ids[0]
    make_preview(source, preview_target, source_affine, target_affine, matrix,
                 args.output.with_suffix(".png"))
    print(json.dumps({"output": str(args.output), "optimizer": report["optimizer"],
                      "wholeBrain": whole, "filledBrainExterior": outer,
                      "corticalExteriorEnvelopes": envelopes, "heldOut": report["heldOut"]}, indent=2))


if __name__ == "__main__":
    main()
