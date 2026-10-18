"""Add triangle indices required by Mapbox's GLB loader, preserving the source."""

import json
import struct
from pathlib import Path


def prepare(source: Path, destination: Path) -> int:
    raw = source.read_bytes()
    magic, version, total = struct.unpack_from('<4sII', raw)
    assert magic == b'glTF' and version == 2 and total == len(raw)
    json_length, json_type = struct.unpack_from('<II', raw, 12)
    assert json_type == 0x4E4F534A
    document = json.loads(raw[20:20 + json_length])
    binary_offset = 20 + json_length
    binary_length, binary_type = struct.unpack_from('<II', raw, binary_offset)
    assert binary_type == 0x004E4942 and len(document['buffers']) == 1
    binary = bytearray(raw[binary_offset + 8:binary_offset + 8 + binary_length])
    added = 0
    for mesh in document['meshes']:
        for primitive in mesh['primitives']:
            if 'indices' in primitive:
                continue
            assert primitive.get('mode', 4) == 4, 'Expected triangles'
            count = document['accessors'][primitive['attributes']['POSITION']]['count']
            assert count % 3 == 0 and count <= 65536
            binary.extend(b'\0' * (-len(binary) % 4))
            offset = len(binary)
            binary.extend(struct.pack(f'<{count}H', *range(count)))
            view_index = len(document['bufferViews'])
            document['bufferViews'].append({
                'buffer': 0, 'byteOffset': offset, 'byteLength': count * 2,
                'target': 34963,
            })
            primitive['indices'] = len(document['accessors'])
            document['accessors'].append({
                'bufferView': view_index, 'componentType': 5123, 'count': count,
                'type': 'SCALAR', 'min': [0], 'max': [count - 1],
            })
            added += 1
    document['buffers'][0]['byteLength'] = len(binary)
    encoded = json.dumps(document, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    binary.extend(b'\0' * (-len(binary) % 4))
    result = struct.pack('<4sII', b'glTF', 2, 28 + len(encoded) + len(binary))
    result += struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
    result += struct.pack('<II', len(binary), 0x004E4942) + binary
    destination.write_bytes(result)
    return added


if __name__ == '__main__':
    models = Path(__file__).resolve().parents[1] / 'public' / 'models'
    count = prepare(models / 'dundas_761.glb', models / 'dundas_761.mapbox.glb')
    print(f'Prepared Mapbox model: added indices to {count} primitives.')
