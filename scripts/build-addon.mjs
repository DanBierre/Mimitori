// Zips anki-addon/ (files at the zip root) into public/mimitori.ankiaddon.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { deflateRawSync, crc32 } from 'node:zlib'

const src = new URL('../anki-addon/', import.meta.url)
const out = new URL('../public/mimitori.ankiaddon', import.meta.url)
const skip = (n) => /^test_.*\.py$/.test(n) || n === '__pycache__' || n === 'meta.json'

const files = readdirSync(src, { withFileTypes: true }).filter((e) => e.isFile() && !skip(e.name))
const parts = []
const central = []
let offset = 0
for (const { name } of files) {
  const data = readFileSync(new URL(name, src))
  const comp = deflateRawSync(data)
  const nameBuf = Buffer.from(name)
  const crc = crc32(data)
  const h = Buffer.alloc(30)
  h.writeUInt32LE(0x04034b50, 0)
  h.writeUInt16LE(20, 4)
  h.writeUInt16LE(0x0800, 6) // utf-8 names
  h.writeUInt16LE(8, 8) // deflate
  h.writeUInt16LE(0, 10)
  h.writeUInt16LE(0x21, 12) // 1980-01-01
  h.writeUInt32LE(crc, 14)
  h.writeUInt32LE(comp.length, 18)
  h.writeUInt32LE(data.length, 22)
  h.writeUInt16LE(nameBuf.length, 26)
  parts.push(h, nameBuf, comp)
  const c = Buffer.alloc(46)
  c.writeUInt32LE(0x02014b50, 0)
  c.writeUInt16LE(20, 4)
  c.writeUInt16LE(20, 6)
  h.copy(c, 8, 6, 30) // flags..name length share the same layout
  c.writeUInt32LE(offset, 42)
  central.push(c, nameBuf)
  offset += 30 + nameBuf.length + comp.length
}
const cd = Buffer.concat(central)
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0)
end.writeUInt16LE(files.length, 8)
end.writeUInt16LE(files.length, 10)
end.writeUInt32LE(cd.length, 12)
end.writeUInt32LE(offset, 16)
const zip = Buffer.concat([...parts, cd, end])
mkdirSync(new URL('./', out), { recursive: true })
writeFileSync(out, zip)
console.log(`public/mimitori.ankiaddon: ${files.length} files, ${zip.length} bytes`)
