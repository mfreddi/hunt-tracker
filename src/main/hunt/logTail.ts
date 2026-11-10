// Incremental reader for a growing log file (Game.log / HuntGame_<pid>.log).
// Ported from the reference tracker (TrackerIO.ps1: New-TailState /
// Read-AppendedLines): keeps the UTF-8 decoder state across reads, and verifies
// a fingerprint of the bytes before the cursor so a file that was rewritten in
// place and regrew before the next poll is still detected (Windows also keeps
// the old creation time when a file is deleted and recreated quickly).

import { promises as fs } from 'fs'
import { StringDecoder } from 'string_decoder'

const ANCHOR_BYTES = 64
const CHUNK_BYTES = 256 * 1024
const MAX_LINE_CHARS = 4 * 1024 * 1024
// While the file is idle the cheap stat is enough; still verify the fingerprint
// this often to catch an in-place rewrite that regrew past the old size.
const IDLE_DEEP_CHECK_MS = 1000

export class LogTail {
  path = ''
  healthy = false
  lastError = ''
  // Bumps every time the file is found replaced (truncated / recreated).
  generation = 0

  private position = 0
  private remainder = ''
  private creationMs = 0
  private decoder = new StringDecoder('utf8')
  private anchor: Buffer = Buffer.alloc(0)
  private lastDeepCheck = 0
  private buf = Buffer.alloc(CHUNK_BYTES)

  get attached(): boolean {
    return this.path !== ''
  }

  reset(): void {
    this.path = ''
    this.healthy = false
    this.lastError = ''
    this.position = 0
    this.remainder = ''
    this.creationMs = 0
    this.decoder = new StringDecoder('utf8')
    this.anchor = Buffer.alloc(0)
    this.lastDeepCheck = 0
  }

  /**
   * Starts tailing `path`. startAtEnd: skip what is already in the file (only
   * new lines will be returned); otherwise the first read returns the whole file.
   */
  async attach(path: string, startAtEnd: boolean): Promise<void> {
    this.reset()
    this.path = path
    if (!startAtEnd) return
    try {
      const fh = await fs.open(path, 'r')
      try {
        const st = await fh.stat()
        this.creationMs = st.birthtimeMs
        this.position = st.size
        await this.captureAnchor(fh)
        this.healthy = true
      } finally {
        await fh.close()
      }
    } catch (e: any) {
      this.healthy = false
      this.lastError = String(e?.message || e)
    }
  }

  private async captureAnchor(fh: import('fs').promises.FileHandle): Promise<void> {
    const size = Math.min(ANCHOR_BYTES, this.position)
    this.anchor = Buffer.alloc(size)
    if (size) await fh.read(this.anchor, 0, size, this.position - size)
  }

  /** Returns the complete lines appended since the last read. maxPosition caps the read (snapshot use). */
  async read(maxPosition = Number.MAX_SAFE_INTEGER): Promise<string[]> {
    if (!this.path) return []
    const now = Date.now()
    try {
      if (this.healthy && this.anchor.length) {
        const st = await fs.stat(this.path)
        if (
          st.birthtimeMs === this.creationMs &&
          st.size === this.position &&
          now - this.lastDeepCheck < IDLE_DEEP_CHECK_MS
        ) {
          return []
        }
      }
      this.lastDeepCheck = now
      const fh = await fs.open(this.path, 'r')
      try {
        const st = await fh.stat()
        let replaced = st.birthtimeMs !== this.creationMs || st.size < this.position
        if (!replaced && this.anchor.length) {
          const probe = Buffer.alloc(this.anchor.length)
          const { bytesRead } = await fh.read(
            probe,
            0,
            probe.length,
            this.position - this.anchor.length
          )
          replaced = bytesRead !== this.anchor.length || !probe.equals(this.anchor)
        }
        if (replaced) {
          this.position = 0
          this.remainder = ''
          this.anchor = Buffer.alloc(0)
          this.decoder = new StringDecoder('utf8')
          this.creationMs = st.birthtimeMs
          this.generation++
        }

        const lines: string[] = []
        const limit = Math.min(st.size, maxPosition)
        while (this.position < limit) {
          const want = Math.min(this.buf.length, limit - this.position)
          const { bytesRead } = await fh.read(this.buf, 0, want, this.position)
          if (!bytesRead) break
          this.position += bytesRead
          const text = this.remainder + this.decoder.write(this.buf.subarray(0, bytesRead))
          const parts = text.split(/\r?\n/)
          this.remainder = parts.pop() ?? ''
          if (this.remainder.length > MAX_LINE_CHARS) throw new Error('Log line exceeds 4 MiB.')
          for (const p of parts) lines.push(p.replace(/^\uFEFF/, ''))
        }
        await this.captureAnchor(fh)
        this.healthy = true
        this.lastError = ''
        return lines
      } finally {
        await fh.close()
      }
    } catch (e: any) {
      this.healthy = false
      this.lastError = String(e?.message || e)
      return []
    }
  }
}
