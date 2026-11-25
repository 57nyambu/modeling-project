import { Badge, Button, Group, List, Stack, Text, Title, Tooltip } from '@mantine/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Meta, Params } from '../api'
import { IconChevron, IconDownload, IconExpand } from '../components/Icons'
import { PageHeader } from '../components/Page'
import { CHAPTERS, DIAGRAMS } from '../diagrams/registry'

interface Props {
  meta: Meta
  params: Params
  diagramId: string | null
  onSelect: (id: string) => void
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function serialise(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.removeAttribute('style')
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`
}

export function DiagramsPage({ meta, params, diagramId, onSelect }: Props) {
  const index = Math.max(0, DIAGRAMS.findIndex((d) => d.id === diagramId))
  const entry = DIAGRAMS[index]
  const stageRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [showToc, setShowToc] = useState(true)
  const number = String(index + 1).padStart(2, '0')

  const go = useCallback((delta: number) => {
    const next = DIAGRAMS[Math.min(DIAGRAMS.length - 1, Math.max(0, index + delta))]
    if (next.id !== entry.id) onSelect(next.id)
  }, [index, entry.id, onSelect])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1) }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const svg = () => frameRef.current?.querySelector('svg') ?? null

  const exportSvg = () => {
    const el = svg()
    if (el) download(new Blob([serialise(el)], { type: 'image/svg+xml' }), `diagram-${number}-${entry.id}.svg`)
  }

  const exportPng = () => {
    const el = svg()
    if (!el) return
    const w = Number(el.getAttribute('width'))
    const h = Number(el.getAttribute('height'))
    const img = new Image()
    const url = URL.createObjectURL(new Blob([serialise(el)], { type: 'image/svg+xml' }))
    img.onload = () => {
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = w * scale
      canvas.height = h * scale
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((b) => b && download(b, `diagram-${number}-${entry.id}.png`), 'image/png')
    }
    img.src = url
  }

  const present = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else stageRef.current?.requestFullscreen?.()
  }

  return (
    <>
      <PageHeader
        title="How the model works"
        description="Seventeen diagrams that walk through the model, from the store floor to the statistics. Use them to learn the model, to present it, or as figures in the report."
        actions={
          <Button variant="default" size="xs" onClick={() => setShowToc((v) => !v)}>
            {showToc ? 'Hide contents' : 'Show contents'}
          </Button>
        }
      />
      <div className={`workspace${showToc ? '' : ' wide'}`} style={showToc ? { gridTemplateColumns: '250px minmax(0, 1fr)' } : undefined}>
        <nav className="side panel" aria-label="Diagrams" style={{ padding: '10px 8px', display: showToc ? undefined : 'none' }}>
          {CHAPTERS.map((ch) => (
            <div key={ch} style={{ marginBottom: 8 }}>
              <Text size="xs" fw={600} c="var(--ink-2)" px={10} pt={6} pb={4}>{ch}</Text>
              {DIAGRAMS.map((d, i) => d.chapter !== ch ? null : (
                <button key={d.id} type="button" className="toc-item" aria-current={d.id === entry.id} onClick={() => onSelect(d.id)}>
                  <span className="toc-n">{i + 1}</span>
                  <span>{d.title}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div ref={stageRef} className="diagram-stage" style={{ minWidth: 0 }}>
          <Stack gap={14}>
            <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
              <div>
                <Group gap={8} mb={4}>
                  <Text size="sm" c="var(--ink-2)">Diagram {index + 1} of {DIAGRAMS.length}</Text>
                  <Text size="sm" c="var(--ink-3)">{entry.chapter}</Text>
                  {entry.live && (
                    <Tooltip label="Drawn from the parameters currently set on the Simulation page">
                      <Badge variant="light" color="blue">Uses your parameters</Badge>
                    </Tooltip>
                  )}
                </Group>
                <Title order={2}>{entry.title}</Title>
              </div>
              <Group gap={6}>
                <Button size="xs" variant="default" leftSection={<IconChevron dir="left" size={14} />} onClick={() => go(-1)} disabled={index === 0}>
                  Previous
                </Button>
                <Button size="xs" variant="default" rightSection={<IconChevron size={14} />} onClick={() => go(1)} disabled={index === DIAGRAMS.length - 1}>
                  Next
                </Button>
                {!fullscreen && (
                  <>
                    <Button size="xs" variant="default" leftSection={<IconExpand size={14} />} onClick={present}>Present</Button>
                    <Button size="xs" variant="default" leftSection={<IconDownload size={14} />} onClick={exportSvg}>SVG</Button>
                    <Button size="xs" variant="default" leftSection={<IconDownload size={14} />} onClick={exportPng}>PNG</Button>
                  </>
                )}
                {fullscreen && <Button size="xs" onClick={present}>Exit presentation</Button>}
              </Group>
            </Group>

            <div className="diagram-frame" ref={frameRef}>
              {entry.render({ meta, params })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 24 }}>
              <div>
                <Text size="sm" fw={600} mb={4}>What it shows</Text>
                <Text size="sm" c="var(--ink-2)" maw={680} lh={1.6}>{entry.summary}</Text>
              </div>
              <div>
                <Text size="sm" fw={600} mb={4}>How to read it</Text>
                <List size="sm" spacing={4} c="var(--ink-2)">
                  {entry.read.map((r) => <List.Item key={r}>{r}</List.Item>)}
                </List>
                <Text size="sm" fw={600} mt={12} mb={4}>In the code</Text>
                <Stack gap={2}>
                  {entry.code.map((c) => <Text key={c} size="xs" ff="monospace" c="var(--ink-2)">{c}</Text>)}
                </Stack>
              </div>
            </div>
            <Text size="xs" c="var(--ink-3)">Use the left and right arrow keys to move between diagrams. Present opens the diagram full screen.</Text>
          </Stack>
        </div>
      </div>
    </>
  )
}
