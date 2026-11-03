import { describe, expect, test } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { outlinedPdf } from './testPdf'
import { includedByDefault, parsePageRanges, readManualOutline, selectPages } from './manualSections'

const pageCountOf = async (b: Uint8Array) => (await PDFDocument.load(b)).getPageCount()

describe('readManualOutline', () => {
  test('turns top-level bookmarks into page ranges, with the pages before them first', async () => {
    const pdf = await outlinedPdf(20, [['1 Introduction', 2], ['5 Game Rules', 5], ['8 Robot Construction Rules', 10], ['12 Awards', 16]])
    expect(await readManualOutline(pdf)).toEqual({
      pageCount: 20,
      sections: [
        { title: 'Páginas iniciais (capa e sumário)', start: 0, end: 2 },
        { title: '1 Introduction', start: 2, end: 5 },
        { title: '5 Game Rules', start: 5, end: 10 },
        { title: '8 Robot Construction Rules', start: 10, end: 16 },
        { title: '12 Awards', start: 16, end: 20 },
      ],
    })
  })

  test('resolves named destinations', async () => {
    const pdf = await outlinedPdf(6, [['A', 0], ['B', 3]], true)
    expect((await readManualOutline(pdf)).sections).toEqual([{ title: 'A', start: 0, end: 3 }, { title: 'B', start: 3, end: 6 }])
  })

  test('no bookmarks → no sections', async () => {
    const doc = await PDFDocument.create(); doc.addPage(); doc.addPage()
    expect(await readManualOutline(await doc.save())).toEqual({ pageCount: 2, sections: [] })
  })
})

describe('includedByDefault', () => {
  test('skips sections that do not feed the 3DM', () => {
    for (const t of ['12 Awards', 'Tournaments', '11 Advancement Between Events', 'Event Rules', 'Inspection & Eligibility Rules', 'Glossary', 'Páginas iniciais (capa e sumário)'])
      expect(includedByDefault(t), t).toBe(false)
    for (const t of ['Game Rules', 'Robot Construction Rules', 'ARENA', 'Game Details', 'Introduction'])
      expect(includedByDefault(t), t).toBe(true)
  })
})

describe('parsePageRanges', () => {
  test('parses ranges and single pages, 1-based to 0-based, deduped and sorted', () => {
    expect(parsePageRanges('3-4, 1, 4', 10)).toEqual([0, 2, 3])
  })
  test('rejects bad input', () => {
    for (const s of ['', 'a', '0-2', '5-3', '1-11', '1,,x']) expect(parsePageRanges(s, 10), s).toBeNull()
  })
})

test('selectPages keeps only the chosen pages', async () => {
  const pdf = await outlinedPdf(10, [['A', 0], ['B', 5]])
  expect(await pageCountOf(await selectPages(pdf, [1, 2, 7]))).toBe(3)
})
