// Check every TS interface's field names against the exported Python schema.
import fs from 'node:fs'
import ts from 'typescript'

const root = new URL('../../', import.meta.url)
const schema = JSON.parse(fs.readFileSync(new URL('data/contracts/comparison.schema.json', root), 'utf8'))
const source = ts.createSourceFile('types.ts', fs.readFileSync(new URL('frontend/src/lib/types.ts', root), 'utf8'), ts.ScriptTarget.Latest, true)
let checked = 0
for (const statement of source.statements) {
  if (!ts.isInterfaceDeclaration(statement)) continue
  const name = statement.name.text
  const definition = name === 'Comparison' ? schema : schema.$defs[name]
  if (!definition) throw new Error(`No Python contract model for ${name}`)
  const fields = statement.members.map(member => {
    if (!ts.isPropertySignature(member) || !member.name || member.questionToken) {
      throw new Error(`${name} must mirror required Python fields`)
    }
    return member.name.getText(source)
  }).sort()
  if (JSON.stringify(fields) !== JSON.stringify(Object.keys(definition.properties).sort())) {
    throw new Error(`Python/TypeScript field drift in ${name}`)
  }
  checked++
}
console.log(`${checked} TypeScript interfaces match Python field names; tsc checks fixture values.`)
