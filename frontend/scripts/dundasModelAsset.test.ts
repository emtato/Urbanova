import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readGlb(name: string) {
  const bytes = readFileSync(new URL(`../public/models/${name}`, import.meta.url))
  const jsonLength = bytes.readUInt32LE(12)
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString())
  const binaryLength = bytes.readUInt32LE(20 + jsonLength)
  const binary = bytes.subarray(28 + jsonLength, 28 + jsonLength + binaryLength)
  return { json, binary }
}

describe.each([
  { address: '761', primitiveCount: 56 },
  { address: '500', primitiveCount: 2 },
])('$address Dundas Mapbox asset compatibility', ({ address, primitiveCount }) => {
  it('provides uint16 triangle indices for every mesh while preserving all original geometry', () => {
    const original = readGlb(`dundas_${address}.glb`)
    const prepared = readGlb(`dundas_${address}.mapbox.glb`)
    expect(prepared.json.nodes).toEqual(original.json.nodes)
    expect(prepared.json.materials).toEqual(original.json.materials)
    expect(prepared.json.scenes).toEqual(original.json.scenes)
    // Positions, normals, and any other original attributes remain byte-for-byte identical.
    expect(prepared.binary.subarray(0, original.json.buffers[0].byteLength)
      .equals(original.binary.subarray(0, original.json.buffers[0].byteLength))).toBe(true)
    let primitives = 0
    prepared.json.meshes.forEach((mesh: any, meshIndex: number) => {
      mesh.primitives.forEach((primitive: any, primitiveIndex: number) => {
        const { indices, ...unchanged } = primitive
        expect(unchanged).toEqual(original.json.meshes[meshIndex].primitives[primitiveIndex])
        const accessor = prepared.json.accessors[indices]
        const position = prepared.json.accessors[primitive.attributes.POSITION]
        expect(accessor.componentType).toBe(5123)
        expect(accessor.type).toBe('SCALAR')
        expect(accessor.count).toBe(position.count)
        expect(accessor.count % 3).toBe(0)
        const view = prepared.json.bufferViews[accessor.bufferView]
        const sequential = Array.from({ length: accessor.count }, (_, index) => index)
          .every(index => prepared.binary.readUInt16LE(view.byteOffset + index * 2) === index)
        expect(sequential).toBe(true)
        primitives++
      })
    })
    expect(primitives).toBe(primitiveCount)
  })
})
