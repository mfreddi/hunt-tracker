import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { LogTail } from '../logTail'

let dir: string
let file: string

beforeEach(async () => {
  dir = await fs.mkdtemp(join(tmpdir(), 'hunt-tail-'))
  file = join(dir, 'Game.log')
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('LogTail', () => {
  it('returns only complete lines and keeps a partial one for the next read', async () => {
    const t = new LogTail()
    await fs.writeFile(file, 'one\ntwo\nthr')
    await t.attach(file, false)
    expect(await t.read()).toEqual(['one', 'two'])
    await fs.appendFile(file, 'ee\nfour\n')
    expect(await t.read()).toEqual(['three', 'four'])
    expect(await t.read()).toEqual([])
    expect(t.healthy).toBe(true)
  })

  it('handles CRLF and a UTF-8 BOM', async () => {
    const t = new LogTail()
    await fs.writeFile(file, '\uFEFFfirst\r\nsecond\r\n')
    await t.attach(file, false)
    expect(await t.read()).toEqual(['first', 'second'])
  })

  it('does not split a multi-byte character across reads', async () => {
    const t = new LogTail()
    const bytes = Buffer.from('Привет\n', 'utf8')
    await fs.writeFile(file, bytes.subarray(0, 3)) // cuts the second letter in half
    await t.attach(file, false)
    expect(await t.read()).toEqual([])
    await fs.appendFile(file, bytes.subarray(3))
    expect(await t.read()).toEqual(['Привет'])
  })

  it('startAtEnd skips what is already there', async () => {
    const t = new LogTail()
    await fs.writeFile(file, 'old1\nold2\n')
    await t.attach(file, true)
    expect(await t.read()).toEqual([])
    await fs.appendFile(file, 'new\n')
    expect(await t.read()).toEqual(['new'])
  })

  it('re-reads from the start when the file is truncated and rewritten', async () => {
    const t = new LogTail()
    await fs.writeFile(file, 'aaaa\nbbbb\ncccc\n')
    await t.attach(file, false)
    await t.read()
    const gen = t.generation
    await fs.writeFile(file, 'x\n')
    expect(await t.read()).toEqual(['x'])
    expect(t.generation).toBeGreaterThan(gen)
  })

  it('detects an in-place rewrite that regrew past the old size', async () => {
    const t = new LogTail()
    await fs.writeFile(file, 'AAAAAAAAAA\n')
    await t.attach(file, false)
    await t.read()
    // same size or bigger, different bytes at the cursor: only the fingerprint can tell
    await fs.writeFile(file, 'BBBBBBBBBB\nnext\n')
    expect(await t.read()).toEqual(['BBBBBBBBBB', 'next'])
  })

  it('caps the read at maxPosition', async () => {
    const t = new LogTail()
    await fs.writeFile(file, 'a\nb\nc\n')
    await t.attach(file, false)
    expect(await t.read(4)).toEqual(['a', 'b'])
    expect(await t.read()).toEqual(['c'])
  })

  it('is unhealthy while the file is missing and recovers when it appears', async () => {
    const t = new LogTail()
    await t.attach(file, false)
    expect(await t.read()).toEqual([])
    expect(t.healthy).toBe(false)
    await fs.writeFile(file, 'hello\n')
    expect(await t.read()).toEqual(['hello'])
    expect(t.healthy).toBe(true)
  })

  it('reset detaches', async () => {
    const t = new LogTail()
    await fs.writeFile(file, 'a\n')
    await t.attach(file, false)
    t.reset()
    expect(t.attached).toBe(false)
    expect(await t.read()).toEqual([])
  })
})
