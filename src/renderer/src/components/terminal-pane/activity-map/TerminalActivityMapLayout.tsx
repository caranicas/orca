import { useState, type ReactNode } from 'react'
import { ResizeHandle } from '@/components/tab-group/TabGroupSplitNodeTree'
import { useTranslate } from '@/i18n/use-translate'

export function TerminalActivityMapLayout({
  children,
  panel
}: {
  children: ReactNode
  panel: ReactNode
}) {
  const [ratio, setRatio] = useState(0.6)
  const t = useTranslate()
  return (
    <div className="absolute inset-0 flex min-h-0 min-w-0">
      <div
        className="relative min-h-0 min-w-0"
        style={{ flex: panel ? `${ratio} 1 0%` : '1 1 0%' }}
      >
        {children}
      </div>
      {panel ? (
        <>
          <ResizeHandle
            direction="horizontal"
            onResizeStart={() => {}}
            onRatioChange={setRatio}
            ratio={ratio}
            label={t('components.terminal.activityMap.resize', 'Resize activity map')}
          />
          <div className="min-h-0 min-w-0 overflow-hidden" style={{ flex: `${1 - ratio} 1 0%` }}>
            {panel}
          </div>
        </>
      ) : null}
    </div>
  )
}
