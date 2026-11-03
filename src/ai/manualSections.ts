import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRef, PDFString, type PDFObject } from 'pdf-lib'

/** A top-level section of the manual: pages [start, end) as 0-based indices. */
export interface ManualSection { title: string; start: number; end: number }

export interface ManualOutline { pageCount: number; sections: ManualSection[] }

/**
 * Sections that don't feed any 3DM step (awards, events, advancement, inspection, glossary...).
 * They start unchecked; the admin can still include them.
 */
const SKIP_BY_DEFAULT =
  /award|prêmio|premia|tournament|torneio|advancement|avanço|district|distrito|championship|campeonato|event rules|regras d[oe] evento|inspection|inspeção|eligibility|elegibilidade|kickoff|volunteer|voluntári|glossary|glossário|revision|revisão|credits|créditos|páginas iniciais/i

export const includedByDefault = (title: string): boolean => !SKIP_BY_DEFAULT.test(title)

const text = (o: PDFObject | undefined): string =>
  o instanceof PDFString || o instanceof PDFHexString ? o.decodeText().trim() : ''

/** Looks a named destination up in the catalog's /Dests dict or /Names → /Dests name tree. */
function namedDest(doc: PDFDocument, name: string): PDFObject | undefined {
  const dests = doc.catalog.lookupMaybe(PDFName.of('Dests'), PDFDict)
  const direct = dests?.lookup(PDFName.of(name))
  if (direct) return direct
  const tree = doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict)?.lookupMaybe(PDFName.of('Dests'), PDFDict)
  const search = (node: PDFDict | undefined, depth: number): PDFObject | undefined => {
    if (!node || depth > 32) return undefined
    const names = node.lookupMaybe(PDFName.of('Names'), PDFArray)
    if (names) {
      for (let i = 0; i + 1 < names.size(); i += 2) if (text(names.lookup(i)) === name) return names.lookup(i + 1)
    }
    const kids = node.lookupMaybe(PDFName.of('Kids'), PDFArray)
    for (let i = 0; kids && i < kids.size(); i++) {
      const hit = search(kids.lookupMaybe(i, PDFDict), depth + 1)
      if (hit) return hit
    }
    return undefined
  }
  return search(tree, 0)
}

/** Page index an outline item points to, or -1. */
function destPage(doc: PDFDocument, item: PDFDict, pageIndex: Map<string, number>): number {
  let dest: PDFObject | undefined = item.lookup(PDFName.of('Dest'))
  if (!dest) {
    const action = item.lookupMaybe(PDFName.of('A'), PDFDict)
    if (action?.lookup(PDFName.of('S'))?.toString() === '/GoTo') dest = action.lookup(PDFName.of('D'))
  }
  for (let hops = 0; dest && hops < 3; hops++) {
    if (dest instanceof PDFArray) {
      const target = dest.get(0)
      return target instanceof PDFRef ? pageIndex.get(target.toString()) ?? -1 : -1
    }
    if (dest instanceof PDFDict) { dest = dest.lookup(PDFName.of('D')); continue }
    const name = dest instanceof PDFName ? dest.decodeText() : text(dest)
    dest = name ? namedDest(doc, name) : undefined
  }
  return -1
}

/**
 * Reads the manual's top-level bookmarks as page ranges. Pages before the first bookmark become
 * "Páginas iniciais". Returns no sections when the PDF has no usable bookmarks.
 */
export async function readManualOutline(bytes: Uint8Array): Promise<ManualOutline> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const pageCount = doc.getPageCount()
  const pageIndex = new Map(doc.getPages().map((p, i) => [p.ref.toString(), i]))
  const starts: { title: string; start: number }[] = []
  let item = doc.catalog.lookupMaybe(PDFName.of('Outlines'), PDFDict)?.lookupMaybe(PDFName.of('First'), PDFDict)
  for (let guard = 0; item && guard < 1000; guard++) {
    const start = destPage(doc, item, pageIndex)
    const title = text(item.lookup(PDFName.of('Title')))
    if (start >= 0 && title) starts.push({ title, start })
    item = item.lookupMaybe(PDFName.of('Next'), PDFDict)
  }
  starts.sort((a, b) => a.start - b.start)
  // Bookmarks on the same page: keep the first, so every section has at least one page.
  const unique = starts.filter((s, i) => i === 0 || s.start !== starts[i - 1].start)
  if (unique.length < 2) return { pageCount, sections: [] }
  const sections: ManualSection[] = unique.map((s, i) => ({ title: s.title, start: s.start, end: unique[i + 1]?.start ?? pageCount }))
  if (sections[0].start > 0) sections.unshift({ title: 'Páginas iniciais (capa e sumário)', start: 0, end: sections[0].start })
  return { pageCount, sections }
}

/** Parses "1-45, 60, 70-80" (1-based, inclusive) into sorted 0-based page indices; null when invalid. */
export function parsePageRanges(input: string, pageCount: number): number[] | null {
  const pages = new Set<number>()
  for (const part of input.split(',').map((p) => p.trim()).filter(Boolean)) {
    const m = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(part)
    if (!m) return null
    const a = Number(m[1]); const b = m[2] ? Number(m[2]) : a
    if (a < 1 || b < a || b > pageCount) return null
    for (let p = a; p <= b; p++) pages.add(p - 1)
  }
  return pages.size ? [...pages].sort((x, y) => x - y) : null
}

/** A new PDF with only the given 0-based pages, in order. */
export async function selectPages(bytes: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const out = await PDFDocument.create()
  for (const p of await out.copyPages(src, pages)) out.addPage(p)
  return out.save()
}
