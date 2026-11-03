// Test helper: builds PDFs with bookmarks (pdf-lib low-level objects).
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, type PDFRef } from 'pdf-lib'

/** PDF with `n` pages and top-level bookmarks [title, 0-based page]; `named` uses named destinations. */
export async function outlinedPdf(n: number, marks: [string, number][], named = false): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < n; i++) doc.addPage([200, 200])
  const ctx = doc.context
  const pageRefs = doc.getPages().map((p) => p.ref)
  const rootRef = ctx.nextRef()
  const itemRefs: PDFRef[] = marks.map(() => ctx.nextRef())
  const nameEntries: unknown[] = []
  marks.forEach(([title, page], i) => {
    const dest = ctx.obj([pageRefs[page], PDFName.of('Fit')])
    const destName = `sec${i}`
    if (named) nameEntries.push(PDFHexString.fromText(destName), dest)
    const item = ctx.obj({ Title: PDFHexString.fromText(title), Parent: rootRef }) as PDFDict
    item.set(PDFName.of('Dest'), named ? PDFHexString.fromText(destName) : dest)
    if (i > 0) item.set(PDFName.of('Prev'), itemRefs[i - 1])
    if (i < marks.length - 1) item.set(PDFName.of('Next'), itemRefs[i + 1])
    ctx.assign(itemRefs[i], item)
  })
  ctx.assign(rootRef, ctx.obj({ Type: 'Outlines', First: itemRefs[0], Last: itemRefs.at(-1)!, Count: marks.length }))
  doc.catalog.set(PDFName.of('Outlines'), rootRef)
  if (named) {
    const names = ctx.obj({ Names: ctx.obj(nameEntries as never[]) as PDFArray })
    doc.catalog.set(PDFName.of('Names'), ctx.obj({ Dests: names }))
  }
  return doc.save()
}
