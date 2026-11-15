import { ActivityMapMemorySettings } from './ActivityMapMemorySettings'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useTranslate } from '@/i18n/use-translate'
import { useActivityMapPreferences } from './use-activity-map-preferences'

function Choice({
  label,
  value,
  choices,
  onChange
}: {
  label: string
  value: string
  choices: readonly (readonly [string, string])[]
  onChange: (value: string) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-7 w-36" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {choices.map(([id, name]) => (
            <SelectItem key={id} value={id}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

export function ActivityMapSettings({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const t = useTranslate()
  const { options, update } = useActivityMapPreferences()
  return (
    <Popover modal onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t('components.native-chat.activityMap.settings', 'Activity map settings')}
        >
          <SlidersHorizontal className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="scrollbar-sleek max-h-[70vh] space-y-3 overflow-y-auto">
          <label className="flex items-center justify-between gap-3 text-xs">
            {t('components.native-chat.activityMap.coreName', 'Center name')}
            <Input
              density="compact"
              className="w-36"
              value={options.coreName}
              maxLength={10}
              onChange={(event) => update({ coreName: event.target.value })}
            />
          </label>
          <Choice
            label={t('components.native-chat.activityMap.language', 'Language')}
            value={options.language}
            choices={[
              ['auto', t('components.native-chat.activityMap.followApp', 'Follow app')],
              ['en', 'English'],
              ['ru', 'Русский'],
              ['es', 'Español'],
              ['fr', 'Français'],
              ['de', 'Deutsch'],
              ['it', 'Italiano'],
              ['pt', 'Português']
            ]}
            onChange={(language) => update({ language })}
          />
          <Choice
            label={t('components.native-chat.activityMap.layout', 'Layout')}
            value={options.layout}
            choices={[
              ['you-top', t('components.native-chat.activityMap.youTop', 'You at top')],
              ['you-bottom', t('components.native-chat.activityMap.youBottom', 'You at bottom')]
            ]}
            onChange={(layout) =>
              update({ layout: layout === 'you-bottom' ? 'you-bottom' : 'you-top' })
            }
          />
          <Choice
            label={t('components.native-chat.activityMap.motion', 'Motion')}
            value={options.motion}
            choices={[
              ['full', t('components.native-chat.activityMap.fullMotion', 'Full')],
              ['reduced', t('components.native-chat.activityMap.reducedMotion', 'Reduced')]
            ]}
            onChange={(motion) => update({ motion: motion === 'reduced' ? 'reduced' : 'full' })}
          />
          <Choice
            label={t('components.native-chat.activityMap.theme', 'Theme')}
            value={options.theme}
            choices={[
              ['auto', t('components.native-chat.activityMap.followApp', 'Follow app')],
              ['light', t('components.native-chat.activityMap.lightTheme', 'Light')],
              ['dark', t('components.native-chat.activityMap.darkTheme', 'Dark')]
            ]}
            onChange={(theme) =>
              update({ theme: theme === 'light' || theme === 'dark' ? theme : 'auto' })
            }
          />
          <Choice
            label={t('components.native-chat.activityMap.background', 'Background')}
            value={options.background}
            choices={[
              ['solid', t('components.native-chat.activityMap.solid', 'Solid')],
              ['transparent', t('components.native-chat.activityMap.transparent', 'Transparent')]
            ]}
            onChange={(background) =>
              update({ background: background === 'transparent' ? 'transparent' : 'solid' })
            }
          />
          <Choice
            label={t('components.native-chat.activityMap.textSize', 'Text size')}
            value={options.textSize}
            choices={[
              ['caption', t('components.native-chat.activityMap.smallText', 'Small')],
              ['footnote', t('components.native-chat.activityMap.mediumText', 'Medium')],
              ['body', t('components.native-chat.activityMap.largeText', 'Large')]
            ]}
            onChange={(textSize) =>
              update({
                textSize: textSize === 'caption' || textSize === 'body' ? textSize : 'footnote'
              })
            }
          />
          <ActivityMapMemorySettings />
        </div>
      </PopoverContent>
    </Popover>
  )
}
