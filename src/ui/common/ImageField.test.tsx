import { describe, expect, it } from 'vitest'
import { compressImage } from './ImageField'

const bytesOf = (dataUrl: string) => Math.floor(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4)

describe('compressImage', () => {
  it('output is under maxBytes for a 3MB jpeg', async () => {
    const file = new File([new Uint8Array(3_000_000)], 'big.jpg', { type: 'image/jpeg' })
    const calls: Array<[number, number]> = []
    // fake encoder: size grows with quality and with max side
    const encode = async (_f: File, maxSide: number, quality: number) => {
      calls.push([maxSide, quality])
      return 'data:image/jpeg;base64,' + 'A'.repeat(Math.round(maxSide * maxSide * quality * 0.4))
    }
    const out = await compressImage(file, 200_000, encode)
    expect(bytesOf(out)).toBeLessThanOrEqual(200_000)
    expect(calls.length).toBeGreaterThan(1)
    expect(calls[0][0]).toBe(1600)
  })

  it('throws when it cannot get under the limit', async () => {
    const file = new File([new Uint8Array(10)], 'x.jpg', { type: 'image/jpeg' })
    const encode = async () => 'data:image/jpeg;base64,' + 'A'.repeat(10_000_000)
    await expect(compressImage(file, 1000, encode)).rejects.toThrow()
  })
})
