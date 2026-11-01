const fs = require('fs')
const path = require('path')
const target = process.argv[2]
const needle = process.argv[3]
const replacement = process.argv[4]
const file = fs.readFileSync(target, 'utf8')
const occurrences = file.split(needle).length - 1
if (occurrences !== 1) {
  console.error('ABORT: expected 1 occurrence, found ' + occurrences)
  process.exit(1)
}
fs.writeFileSync(path.resolve(target), file.split(needle).join(replacement))
console.log('replaced 1 occurrence in ' + target)
