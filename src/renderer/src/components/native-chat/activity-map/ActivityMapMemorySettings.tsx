import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useTranslate } from '@/i18n/use-translate'
import { useActivityMapPreferences } from './use-activity-map-preferences'

function ListField({
  label,
  value,
  onCommit
}: {
  label: string
  value: string[]
  onCommit: (value: string[]) => void
}) {
  return (
    <label className="block space-y-1 text-xs">
      <span>{label}</span>
      <Textarea
        aria-label={label}
        key={value.join('\n')}
        variant="code"
        rows={2}
        defaultValue={value.join('\n')}
        onBlur={(event) =>
          onCommit(
            event.target.value
              .split('\n')
              .map((word) => word.trim())
              .filter(Boolean)
          )
        }
      />
    </label>
  )
}

export function ActivityMapMemorySettings() {
  const t = useTranslate()
  const { options, update } = useActivityMapPreferences()
  return (
    <details>
      <summary className="cursor-pointer text-xs">
        {t('components.native-chat.activityMap.memorySettings', 'Memory and hooks')}
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-muted-foreground">
          {t(
            'components.native-chat.activityMap.onePerLine',
            'Enter one item per line. Changes apply when you leave a field.'
          )}
        </p>
        <ListField
          label={t('components.native-chat.activityMap.memoryServers', 'Memory MCP servers')}
          value={options.memoryServers}
          onCommit={(memoryServers) => update({ memoryServers })}
        />
        <ListField
          label={t('components.native-chat.activityMap.memoryCommands', 'Memory commands')}
          value={options.memoryCommands}
          onCommit={(memoryCommands) => update({ memoryCommands })}
        />
        <ListField
          label={t(
            'components.native-chat.activityMap.memorySubcommands',
            'Subcommands safe to display'
          )}
          value={options.memorySubcommands}
          onCommit={(memorySubcommands) => update({ memorySubcommands })}
        />
        <ListField
          label={t('components.native-chat.activityMap.memoryPaths', 'Memory path fragments')}
          value={options.memoryPaths}
          onCommit={(memoryPaths) => update({ memoryPaths })}
        />
        <ListField
          label={t(
            'components.native-chat.activityMap.memoryLabels',
            'Memory tool labels (tool=name)'
          )}
          value={options.memoryLabels}
          onCommit={(memoryLabels) => update({ memoryLabels })}
        />
        <label className="flex items-center justify-between gap-3 text-xs">
          {t('components.native-chat.activityMap.hookRecords', 'Show numbered hook records')}
          <Switch
            checked={options.hookRecords}
            onCheckedChange={(hookRecords) => update({ hookRecords })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-xs">
          {t('components.native-chat.activityMap.hookReasons', 'Show hook refusal reasons')}
          <Switch
            checked={options.hookReasons}
            onCheckedChange={(hookReasons) => update({ hookReasons })}
          />
        </label>
        <ListField
          label={t('components.native-chat.activityMap.colors', 'Color overrides (name=#rrggbb)')}
          value={options.colors}
          onCommit={(colors) => update({ colors })}
        />
        <p className="text-2xs text-muted-foreground">
          {t(
            'components.native-chat.activityMap.colorNames',
            'background, node, line, spoke, text, label, faint, accent, active, error, memory, memoryActive, route'
          )}
        </p>
      </div>
    </details>
  )
}
