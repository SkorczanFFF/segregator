import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DocumentInput, FILE_VERSIONS, READ_MODEL, type FileVersion, type ReadResult } from 'shared'
import { DEMO_OUT, PHOTO_TYPE, readManifest } from './demo-manifest.ts'
import { readWithModel } from './read-model.ts'

// Measures how well the model reads the fictional documents `uv run python generate.py eval` draws in demo/:
// each photo as taken and as straightened, RUNS times, field by field against what is printed. It calls the
// model the way the reader does, but straight from this machine and outside the app's limits.
// node --env-file=.env src/evaluate-reading.ts

type Field = keyof ReadResult
const METRICS = ['type', 'subtype', 'issuer', 'issuer, recognisable', 'amount', 'docDate', 'dueDate'] as const
type Metric = (typeof METRICS)[number]
// A field the document prints, as the model read it, or one it filled although the document doesn't print it.
type Check = { metric: Metric; want: unknown; got: unknown; right: boolean }
type Reading = { slug: string; version: FileVersion; checks: Check[]; inputTokens: number; outputTokens: number; ms: number }

const DIR = join(DEMO_OUT, 'eval')
// The model answers the same photo differently now and then, so each one is read several times.
const RUNS = 3
// The account may send the model 20 requests a minute (Service Quotas, L-F06F1187), so readings start this far apart.
const PAUSE = 60_000 / 20
const LABELS: Record<FileVersion, string> = { raw: 'Photo as taken', processed: 'Straightened' }
const FIELDS = METRICS.filter((metric): metric is Field => metric !== 'issuer, recognisable')

// Legal forms once punctuation is gone: sp. z o.o., sp. j., sp. k., s.c., S.A., TU and TUW.
const LEGAL_FORMS = / (sp z o o|sp j|sp k|s c|s a|tuw|tu)(?= |$)/g

// An issuer the way a person would recognise it: one case, no quotes, punctuation or legal form. Polish letters
// still count.
const recognisable = (issuer: string) =>
  ` ${issuer.toLocaleLowerCase('pl').replace(/[„”“"'.,()]/g, ' ').replace(/\s+/g, ' ').trim()}`
    .replace(LEGAL_FORMS, '')
    .trim()

function check(expected: DocumentInput, result: ReadResult | undefined): Check[] {
  return FIELDS.flatMap((field): Check[] => {
    const want = expected[field]
    const got = result?.[field]
    if (want === undefined) return got === undefined ? [] : [{ metric: field, want, got, right: false }]
    const exact: Check = { metric: field, want, got, right: got === want }
    if (field !== 'issuer') return [exact]
    const right = typeof got === 'string' && recognisable(got) === recognisable(String(want))
    return [exact, { metric: 'issuer, recognisable', want, got, right }]
  })
}

const share = (right: number, of: number) => (of ? `${Math.round((100 * right) / of)}% (${right}/${of})` : '–')
const mean = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / (values.length || 1))
const shown = (value: unknown) => JSON.stringify(value) ?? 'nothing'

const manifest = await readManifest(DIR)
const readings: Reading[] = []
let last = 0
for (const entry of manifest) {
  const expected = DocumentInput.parse(entry.fields)
  for (const version of FILE_VERSIONS) {
    // The app reads the photo as taken when straightening left it unchanged.
    const file = version === 'raw' ? entry.raw.file : (entry.processed?.file ?? entry.raw.file)
    const bytes = await readFile(join(DIR, file))
    for (let run = 0; run < RUNS; run++) {
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, last + PAUSE - Date.now())))
      last = Date.now()
      const { result, ...counts } = await readWithModel(PHOTO_TYPE, bytes)
      readings.push({ slug: entry.slug, version, checks: check(expected, result), ...counts })
      process.stdout.write('.')
    }
  }
}

const of = (version: FileVersion) => readings.filter((reading) => reading.version === version)
const scored = (version: FileVersion, keep: (one: Check) => boolean) => {
  const checks = of(version).flatMap((reading) => reading.checks.filter((one) => one.want !== undefined && keep(one)))
  return share(checks.filter((one) => one.right).length, checks.length)
}
// Every printed field right, with the issuer counted as recognised, and nothing filled that isn't printed.
const fullyRight = (reading: Reading) => reading.checks.every((one) => one.metric === 'issuer' || one.right)
// Fields of a document the model answered differently across its readings.
function unstable(version: FileVersion) {
  const answers = new Map<string, Set<string>>()
  for (const reading of of(version)) {
    for (const field of FIELDS) {
      const key = `${reading.slug} ${field}`
      const got = reading.checks.find((one) => one.metric === field)?.got
      answers.set(key, (answers.get(key) ?? new Set()).add(shown(got)))
    }
  }
  return [...answers.values()].filter((answered) => answered.size > 1).length
}

const row = (name: string, cell: (version: FileVersion) => string | number) =>
  `| ${name} | ${FILE_VERSIONS.map((version) => cell(version)).join(' | ')} |`
const lines = [
  `# Reading check: ${READ_MODEL}, ${new Date().toISOString().slice(0, 10)}`,
  '',
  `${manifest.length} documents, each version read ${RUNS} times.`,
  '',
  `| | ${FILE_VERSIONS.map((version) => LABELS[version]).join(' | ')} |`,
  `|---|${FILE_VERSIONS.map(() => '---').join('|')}|`,
  ...METRICS.map((metric) => row(metric, (version) => scored(version, (one) => one.metric === metric))),
  row('**All fields, issuer recognisable**', (version) => scored(version, (one) => one.metric !== 'issuer')),
  row('All fields, issuer exact', (version) => scored(version, (one) => one.metric !== 'issuer, recognisable')),
  row('Readings with every field right', (version) => share(of(version).filter(fullyRight).length, of(version).length)),
  row('Fields filled that aren’t printed', (version) =>
    of(version).flatMap((reading) => reading.checks.filter((one) => one.want === undefined)).length,
  ),
  row('Fields answered differently across readings', unstable),
  row('Tokens in, mean', (version) => mean(of(version).map((one) => one.inputTokens))),
  row('Tokens out, mean', (version) => mean(of(version).map((one) => one.outputTokens))),
  row('Time, mean ms', (version) => mean(of(version).map((one) => one.ms))),
  '',
  '## Misses',
  '',
]
for (const entry of manifest) {
  for (const version of FILE_VERSIONS) {
    const mine = readings.filter((reading) => reading.slug === entry.slug && reading.version === version)
    const misses = new Map<Metric, Check[]>()
    for (const one of mine.flatMap((reading) => reading.checks).filter((check) => !check.right)) {
      misses.set(one.metric, [...(misses.get(one.metric) ?? []), one])
    }
    for (const [metric, wrong] of misses) {
      const answers = [...new Set(wrong.map((one) => shown(one.got)))].join(' or ')
      const place = `${entry.slug}, ${LABELS[version].toLowerCase()}`
      lines.push(`- ${place}: ${metric} ${shown(wrong[0]?.want)} → ${answers} (${wrong.length} of ${mine.length})`)
    }
  }
}
const report = `${lines.join('\n')}\n`
await writeFile(join(DIR, 'report.md'), report)
console.log(`\n${report}`)
