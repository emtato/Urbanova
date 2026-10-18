"""Rebuild the Flexity's open terminal shells; keep its body, rig scale and texture.

Run from the repo root with .venv/bin/python frontend/scripts/repair_streetcar_asset.py.
Requires numpy. Re-running replaces the named cab meshes instead of stacking them.
"""
from pathlib import Path
import copy
import json
import math
import struct

import numpy as np

MODELS = Path(__file__).resolve().parents[1] / 'public' / 'models'
SOURCE = MODELS / 'flexity_outlook.glb'
WIDTH = 1.27
BODY_ROOF_Y = 3.42
CAB_ROOF_SCALE = (BODY_ROOF_Y - 1.23) / (3.82 - 1.23)
MODULES = [(-12.8, -9.1), (-8.4, -3.3), (-2.6, 2.6), (3.3, 8.4), (9.1, 12.2)]
REBUILD_MATERIALS = {0, 1, 2, 4, 5, 8, 10, 11, 13, 14, 15, 16}


def roof_height(y):
    return y if y <= 1.23 else 1.23 + (y - 1.23) * CAB_ROOF_SCALE


def body_half_width(y):
    return float(np.interp(y, [2.45, 3.25, BODY_ROOF_Y], [WIDTH, 1.1938, .9906]))


def read_glb(path):
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from('<III', raw)
    assert magic == 0x46546C67 and version == 2 and length == len(raw)
    size, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4E4F534A
    document = json.loads(raw[20:20 + size])
    binary_size, kind = struct.unpack_from('<II', raw, 20 + size)
    assert kind == 0x004E4942
    return document, raw[28 + size:28 + size + binary_size]


def attribute(document, binary, index):
    item = document['accessors'][index]
    view = document['bufferViews'][item['bufferView']]
    dtype = {5126: '<f4', 5125: '<u4', 5123: '<u2'}[item['componentType']]
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[item['type']]
    stride = view.get('byteStride', np.dtype(dtype).itemsize * width)
    return np.ndarray((item['count'], width), dtype=dtype, buffer=binary,
                      offset=view.get('byteOffset', 0) + item.get('byteOffset', 0),
                      strides=(stride, np.dtype(dtype).itemsize)).copy()


class Mesh:
    def __init__(self, name, material):
        self.name, self.material = name, material
        self.positions, self.normals, self.uv, self.indices = [], [], [], []

    def triangle(self, points, uv=None, outward=None):
        points = np.asarray(points, dtype=float)
        normal = np.cross(points[1] - points[0], points[2] - points[0])
        if np.linalg.norm(normal) < 1e-10:
            return
        uv = list(uv or [(0, 0), (1, 0), (1, 1)])
        if outward is not None and np.dot(normal, outward) < 0:
            points = points[[0, 2, 1]]
            uv = [uv[0], uv[2], uv[1]]
            normal = -normal
        normal /= np.linalg.norm(normal)
        start = len(self.positions)
        self.positions.extend(points.tolist())
        self.normals.extend([normal.tolist()] * 3)
        self.uv.extend(uv)
        self.indices.append([start, start + 1, start + 2])

    def quad(self, points, outward=None, uv=None):
        uv = uv or [(0, 0), (1, 0), (1, 1), (0, 1)]
        for ids in ((0, 1, 2), (0, 2, 3)):
            self.triangle([points[i] for i in ids], [uv[i] for i in ids], outward)


def box(mesh, center, size):
    center, half = np.array(center), np.array(size) / 2
    for axis in range(3):
        a, b = [i for i in range(3) if i != axis]
        for sign in [-1, 1]:
            points = []
            for u, v in [(-1, -1), (1, -1), (1, 1), (-1, 1)]:
                p = center.copy()
                p[axis] += sign * half[axis]
                p[a] += u * half[a]
                p[b] += v * half[b]
                points.append(p)
            normal = np.zeros(3)
            normal[axis] = sign
            mesh.quad(points, normal)


def cylinder(mesh, start, end, radius, segments=16):
    start, end = np.array(start, float), np.array(end, float)
    axis = end - start
    axis /= np.linalg.norm(axis)
    tangent = np.cross(axis, [0, 1, 0] if abs(axis[1]) < .9 else [1, 0, 0])
    tangent /= np.linalg.norm(tangent)
    bitangent = np.cross(axis, tangent)
    offsets = [radius * (tangent * math.cos(t) + bitangent * math.sin(t))
               for t in np.linspace(0, 2 * math.pi, segments, endpoint=False)]
    for i in range(segments):
        j = (i + 1) % segments
        mesh.quad([start + offsets[i], start + offsets[j], end + offsets[j], end + offsets[i]], offsets[i] + offsets[j])
        mesh.triangle([start, start + offsets[i], start + offsets[j]], outward=-axis)
        mesh.triangle([end, end + offsets[i], end + offsets[j]], outward=axis)


# y, half-width, foremost z, amount the round corners sweep back.
# The final bands taper into a closed roof instead of leaving an open extrusion.
PROFILE = [
    (.22, 1.18, 15.02, .65), (.32, 1.24, 15.10, .67),
    (.38, 1.27, 15.14, .69), (.88, 1.27, 15.17, .70),
    (.94, 1.27, 15.18, .70), (1.17, 1.27, 15.18, .70),
    (1.23, 1.26, 15.15, .70), (3.08, 1.16, 14.78, .62),
    (3.18, 1.15, 14.75, .62), (3.35, 1.14, 14.73, .62),
    (3.55, 1.12, 14.65, .60), (3.72, 1.03, 14.48, .53),
    (3.82, .88, 14.26, .40),
]


def front_point(x, y, sign=1, offset=0):
    widths = [p[1] for p in PROFILE]
    width = np.interp(y, [p[0] for p in PROFILE], widths)
    z = np.interp(y, [p[0] for p in PROFILE], [p[2] for p in PROFILE])
    depth = np.interp(y, [p[0] for p in PROFILE], [p[3] for p in PROFILE])
    xratio = min(abs(x / width), 1)
    z -= depth * (1 - math.sqrt(1 - xratio * xratio))
    return np.array([x, y, sign * (z + offset)])


def closed_shell(sign, materials):
    label = 'front' if sign > 0 else 'rear'
    meshes = {m: Mesh(f'Cab_{label}_{m}', m) for m in [0, 1, 2, materials['glass']]}
    base = 12.18 if sign > 0 else 12.78
    angles = np.linspace(-math.pi / 2, math.pi / 2, 33)
    rings = []
    for y, width, front, depth in PROFILE:
        # Straight returns meet the unmodified passenger body at the cab seam.
        seam_width = body_half_width(roof_height(y))
        ring = [[-seam_width, y, sign * base]]
        ring += [[width * math.sin(t), y, sign * (front - depth * (1 - math.cos(t)))] for t in angles]
        ring += [[seam_width, y, sign * base]]
        rings.append(np.array(ring))
    shell_faces = []
    for k, (bottom, top) in enumerate(zip(rings, rings[1:])):
        y = (PROFILE[k][0] + PROFILE[k + 1][0]) / 2
        material = 0 if y < .38 or .94 < y < 1.23 or y > 3.35 else 1
        if 1.23 < y < 3.18:
            material = materials['glass']
        mesh = meshes[material]
        for j in range(len(bottom)):
            nxt = (j + 1) % len(bottom)
            points = [bottom[j], bottom[nxt], top[nxt], top[j]]
            midpoint = np.mean(points, axis=0)
            if j == len(bottom) - 1:
                outward = [0, 0, -sign]
            elif j == 0:
                outward = [-1, 0, 0]
            elif j == len(bottom) - 2:
                outward = [1, 0, 0]
            else:
                outward = [midpoint[0] / WIDTH, 0, sign * max(.05, (abs(midpoint[2]) - 14) / .8)]
            mesh.quad(points, outward)
            shell_faces.extend([points[:3], [points[0], points[2], points[3]]])
    for ring, outward in [(rings[0], [0, -1, 0]), (rings[-1], [0, 1, 0])]:
        center = np.mean(ring, axis=0)
        mesh = meshes[0]
        for i in range(len(ring)):
            points = [center, ring[i], ring[(i + 1) % len(ring)]]
            mesh.triangle(points, outward=outward)
            shell_faces.append(points)
    # Confirm the shell is closed across material seams by welding positions.
    from collections import Counter
    edges = Counter()
    for points in shell_faces:
        keys = [tuple(np.round(point, 5)) for point in points]
        for a, b in zip(keys, keys[1:] + keys[:1]):
            edges[tuple(sorted((a, b)))] += 1
    assert all(count == 2 for count in edges.values()), f'{label} shell has an open boundary'
    return list(meshes.values())


def details(sign):
    label = 'front' if sign > 0 else 'rear'
    black, white = Mesh(f'Cab_{label}_trim', 2), Mesh(f'Cab_{label}_pillars', 1)
    lamps = Mesh(f'Cab_{label}_lamps', 14 if sign > 0 else 15)
    amber = Mesh(f'Cab_{label}_indicators', 18)
    sign_mesh = Mesh(f'Cab_{label}_destination', 16)
    # Fit a curved display onto the glazing, using the existing embedded 505 artwork.
    for i in range(16):
        x0, x1 = -.83 + 1.66 * i / 16, -.83 + 1.66 * (i + 1) / 16
        u0, u1 = i / 16, (i + 1) / 16
        if sign < 0:
            u0, u1 = 1 - u0, 1 - u1
        sign_mesh.quad([front_point(x0, 2.77, sign, .022), front_point(x1, 2.77, sign, .022),
                        front_point(x1, 3.06, sign, .022), front_point(x0, 3.06, sign, .022)],
                       [0, 0, sign], [(u0, 1), (u1, 1), (u1, 0), (u0, 0)])
    # White A pillars, integrated into the curved windscreen corners.
    for side in [-1, 1]:
        for k in range(12):
            y0, y1 = 1.23 + 1.95 * k / 12, 1.23 + 1.95 * (k + 1) / 12
            w0 = np.interp(y0, [p[0] for p in PROFILE], [p[1] for p in PROFILE])
            w1 = np.interp(y1, [p[0] for p in PROFILE], [p[1] for p in PROFILE])
            white.quad([front_point(side * (w0 - .11), y0, sign, .012), front_point(side * (w0 - .04), y0, sign, .012),
                        front_point(side * (w1 - .04), y1, sign, .012), front_point(side * (w1 - .11), y1, sign, .012)], [side, 0, sign])
        for x in [side * .70, side * .90]:
            point = front_point(x, 1.055, sign, .018)
            cylinder(black, point, point + [0, 0, sign * .045], .076)
            cylinder(lamps, point + [0, 0, sign * .046], point + [0, 0, sign * .051], .052)
        point = front_point(side * 1.04, 1.055, sign, .02)
        box(amber, point, [.10, .035, .025])
    if sign > 0:
        cylinder(black, front_point(.12, 1.29, sign, .028), front_point(-.24, 2.38, sign, .028), .013, 10)
        cylinder(black, front_point(-.06, 1.72, sign, .032), front_point(-.40, 2.93, sign, .032), .019, 10)
        for side in [-1, 1]:
            cylinder(black, [side * 1.13, 2.91, 14.16], [side * 1.38, 2.91, 14.16], .018, 10)
            box(white, [side * 1.39, 2.84, 14.18], [.11, .25, .16])
            box(black, [side * 1.39, 2.84, 14.266], [.075, .20, .012])
    else:
        # Small rear service-panel seam, rather than an opening into the carriage.
        for side in [-1, 1]:
            cylinder(black, front_point(side * .32, .41, sign, .012), front_point(side * .32, .82, sign, .012), .006, 6)
    return [black, white, lamps, amber, sign_mesh]


def smooth_shell(mesh):
    from collections import defaultdict
    shared = defaultdict(list)
    normals = np.asarray(mesh.normals)
    for i, point in enumerate(mesh.positions):
        shared[tuple(np.round(point, 6))].append(i)
    result = normals.copy()
    for indices in shared.values():
        adjacent = normals[indices]
        for index in indices:
            # Keep hard corners; blend the finely sampled curved nose and roof.
            average = adjacent[adjacent @ normals[index] > .5].sum(axis=0)
            result[index] = average / np.linalg.norm(average)
    mesh.normals = result.tolist()


def level_cab_roof(mesh):
    positions = np.asarray(mesh.positions, dtype=float)
    normals = np.asarray(mesh.normals, dtype=float)
    upper = positions[:, 1] > 1.23
    positions[upper, 1] = 1.23 + (positions[upper, 1] - 1.23) * CAB_ROOF_SCALE
    # Inverse-transpose normal transform for the vertical compression.
    normals[upper, 1] /= CAB_ROOF_SCALE
    normals /= np.linalg.norm(normals, axis=1)[:, None]
    mesh.positions, mesh.normals = positions, normals


def continuous_roof_trim():
    """Red roof shoulders at the same height as the cab; bellows stay exposed."""
    bottom = roof_height(3.35)
    cross_section = [(-body_half_width(bottom) - .002, bottom),
                     (body_half_width(bottom) + .002, bottom),
                     (1.1958, 3.25), (.9926, BODY_ROOF_Y),
                     (-.9926, BODY_ROOF_Y), (-1.1958, 3.25)]
    result = []
    for index, (start, end) in enumerate(MODULES):
        mesh = Mesh(f'RoofTrim_module_{index + 1}', 0)
        near = [np.array([x, y, start]) for x, y in cross_section]
        far = [np.array([x, y, end]) for x, y in cross_section]
        center = np.array([0, (bottom + BODY_ROOF_Y) / 2, (start + end) / 2])
        for i in range(len(near)):
            j = (i + 1) % len(near)
            points = [near[i], near[j], far[j], far[i]]
            mesh.quad(points, np.mean(points, axis=0) - center)
        for ring, direction in [(near, [0, 0, -1]), (far, [0, 0, 1])]:
            midpoint = np.mean(ring, axis=0)
            for i in range(len(ring)):
                mesh.triangle([midpoint, ring[i], ring[(i + 1) % len(ring)]], outward=direction)
        smooth_shell(mesh)
        result.append(mesh)
    return result


def main():
    original, original_binary = read_glb(SOURCE)
    material_list = copy.deepcopy(original['materials'][:17])
    material_list[0]['pbrMetallicRoughness'].update(baseColorFactor=[.57, .008, .027, 1], roughnessFactor=.38)
    material_list.append({'name': 'mat_cab_glazing', 'pbrMetallicRoughness': {
        'baseColorFactor': [.025, .055, .075, 1], 'metallicFactor': .3, 'roughnessFactor': .19}})
    material_list.append({'name': 'mat_indicator_amber', 'pbrMetallicRoughness': {
        'baseColorFactor': [1, .3, .005, 1], 'metallicFactor': 0, 'roughnessFactor': .35}, 'emissiveFactor': [.8, .16, 0]})
    meshes = []
    for original_mesh in original['meshes']:
        if original_mesh.get('name', '').startswith(('Cab_', 'RoofTrim_')):
            continue
        for primitive in original_mesh['primitives']:
            mesh = Mesh(original_mesh.get('name', 'Body'), primitive['material'])
            mesh.positions = attribute(original, original_binary, primitive['attributes']['POSITION'])
            mesh.normals = attribute(original, original_binary, primitive['attributes']['NORMAL'])
            mesh.uv = attribute(original, original_binary, primitive['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in primitive['attributes'] else np.zeros((len(mesh.positions), 2))
            indices = attribute(original, original_binary, primitive['indices']).reshape(-1, 3)
            if mesh.material in REBUILD_MATERIALS:
                z = mesh.positions[indices, 2]
                indices = indices[~(np.all(z > 12.17, axis=1) | np.all(z < -12.77, axis=1))]
            if mesh.material in {1, 8}:
                # Remove coplanar white/metal roof faces under the red surface.
                roof_faces = np.all(np.isclose(mesh.positions[indices, 1], BODY_ROOF_Y, atol=1e-5), axis=1)
                indices = indices[~roof_faces]
            mesh.indices = indices
            if len(indices):
                meshes.append(mesh)
    for direction in [1, -1]:
        shells = closed_shell(direction, {'glass': 17})
        for shell in shells:
            smooth_shell(shell)
        cab_meshes = shells + details(direction)
        for mesh in cab_meshes:
            if len(mesh.indices):
                level_cab_roof(mesh)
        meshes.extend(cab_meshes)
    meshes.extend(continuous_roof_trim())
    meshes = [m for m in meshes if len(m.indices)]

    # Repack with no external buffers or textures. Keep the root axes and metre units.
    document = {'asset': copy.deepcopy(original['asset']), 'scene': 0, 'scenes': [{'nodes': [0]}],
                'nodes': [{'name': 'Toronto_Flexity_Outlook_4404', 'children': []}], 'meshes': [],
                'materials': material_list, 'buffers': [], 'bufferViews': [], 'accessors': [],
                'textures': copy.deepcopy(original.get('textures', [])), 'samplers': copy.deepcopy(original.get('samplers', [])), 'images': []}
    document['asset']['extras'] = {'terminal_repair': 'Closed rounded front and rear shells, fitted glazing, lamps and trim; original articulated passenger body retained.',
                                   'roofline': 'Cab roofs and five red body roof trims share the original 3.42 m roof height; articulation joints and rooftop equipment retained.'}
    binary = bytearray()

    def buffer_view(raw, target=None):
        binary.extend(b'\0' * (-len(binary) % 4))
        index = len(document['bufferViews'])
        view = {'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(raw)}
        if target:
            view['target'] = target
        document['bufferViews'].append(view)
        binary.extend(raw)
        return index

    def accessor(data, kind, indices=False):
        data = np.asarray(data, dtype='<u4' if indices else '<f4')
        assert np.isfinite(data).all()
        view = buffer_view(data.tobytes(), 34963 if indices else 34962)
        result = {'bufferView': view, 'componentType': 5125 if indices else 5126,
                  'count': data.size if indices else len(data), 'type': kind}
        if kind == 'VEC3' and not indices:
            result.update(min=data.min(axis=0).tolist(), max=data.max(axis=0).tolist())
        document['accessors'].append(result)
        return len(document['accessors']) - 1

    for item in original.get('images', []):
        view = original['bufferViews'][item['bufferView']]
        image = original_binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
        document['images'].append({**item, 'bufferView': buffer_view(image)})
        (MODELS / 'flexity_destination.png').write_bytes(image)
    for mesh in meshes:
        positions, indices = np.asarray(mesh.positions), np.asarray(mesh.indices)
        assert indices.min() >= 0 and indices.max() < len(positions)
        primitive = {'attributes': {'POSITION': accessor(positions, 'VEC3'), 'NORMAL': accessor(mesh.normals, 'VEC3'),
                                    'TEXCOORD_0': accessor(mesh.uv, 'VEC2')},
                     'indices': accessor(indices, 'SCALAR', True), 'material': mesh.material, 'mode': 4}
        document['nodes'][0]['children'].append(len(document['nodes']))
        document['nodes'].append({'name': mesh.name, 'mesh': len(document['meshes'])})
        document['meshes'].append({'name': mesh.name, 'primitives': [primitive]})
    document['buffers'] = [{'byteLength': len(binary)}]
    binary.extend(b'\0' * (-len(binary) % 4))
    encoded = json.dumps(document, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    total = 12 + 8 + len(encoded) + 8 + len(binary)
    SOURCE.write_bytes(struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded + struct.pack('<II', len(binary), 0x004E4942) + binary)

    # Synchronize the editable OBJ/MTL with the GLB used by the map.
    obj = ['# Toronto Flexity Outlook - repaired terminal shells', 'mtllib flexity_outlook.mtl']
    offset = 1
    for mesh in meshes:
        obj.extend([f'g {mesh.name}', f'usemtl {material_list[mesh.material]["name"]}'])
        obj += ['v ' + ' '.join(f'{x:.6f}' for x in p) for p in mesh.positions]
        obj += [f'vt {p[0]:.6f} {1 - p[1]:.6f}' for p in mesh.uv]
        obj += ['vn ' + ' '.join(f'{x:.6f}' for x in p) for p in mesh.normals]
        obj += ['f ' + ' '.join(f'{int(i) + offset}/{int(i) + offset}/{int(i) + offset}' for i in face) for face in mesh.indices]
        offset += len(mesh.positions)
    (MODELS / 'flexity_outlook.obj').write_text('\n'.join(obj) + '\n')
    mtl = ['# Materials for the repaired Flexity Outlook']
    for material in material_list:
        pbr = material['pbrMetallicRoughness']
        rgba = pbr.get('baseColorFactor', [1, 1, 1, 1])
        mtl += ['', f'newmtl {material["name"]}', 'Kd ' + ' '.join(map(str, rgba[:3])), f'd {rgba[3]}', 'illum 2', 'Ns 60']
        if 'emissiveFactor' in material:
            mtl.append('Ke ' + ' '.join(map(str, material['emissiveFactor'])))
        if 'baseColorTexture' in pbr:
            mtl.append('map_Kd flexity_destination.png')
    (MODELS / 'flexity_outlook.mtl').write_text('\n'.join(mtl) + '\n')
    print(json.dumps({'meshes': len(meshes), 'triangles': sum(len(m.indices) for m in meshes), 'glb_bytes': total,
                      'closed_front_shell': True, 'closed_rear_shell': True, 'obj_and_mtl_synchronized': True}))


if __name__ == '__main__':
    main()
