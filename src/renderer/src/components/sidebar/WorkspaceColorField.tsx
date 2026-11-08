import { Button } from '@/components/ui/button'
import { ColorPicker } from '@/components/ui/color-picker'
import { Label } from '@/components/ui/label'
import { DEFAULT_REPO_BADGE_COLOR } from '../../../../shared/repo-badge-color'
import { WORKSPACE_COLORS, WORKSPACE_COLOR_NAMES } from '../../../../shared/workspace-colors'
import { translate } from '@/i18n/i18n'

export function WorkspaceColorField({
  value,
  onChange,
  disabled = false
}: {
  value: string | null
  onChange: (color: string | null) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label>{translate('custom.workspace.color', 'Workspace color')}</Label>
      <div className="flex flex-wrap items-center gap-2">
        {WORKSPACE_COLORS.map((color, index) => (
          <Button
            key={color}
            type="button"
            variant={value === color ? 'secondary' : 'ghost'}
            size="icon-sm"
            disabled={disabled}
            aria-label={WORKSPACE_COLOR_NAMES[index]}
            aria-pressed={value === color}
            onClick={() => onChange(color)}
          >
            <span
              aria-hidden="true"
              className="size-4 rounded-full border border-border"
              style={{ backgroundColor: color }}
            />
          </Button>
        ))}
        <fieldset disabled={disabled}>
          <ColorPicker
            label={translate('custom.workspace.customColor', 'Custom workspace color')}
            value={value ?? DEFAULT_REPO_BADGE_COLOR}
            onChange={onChange}
            triggerLabel={translate('custom.workspace.custom', 'Custom')}
          />
        </fieldset>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || value === null}
          onClick={() => onChange(null)}
        >
          {translate('custom.workspace.noColor', 'No color')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {translate(
          'custom.workspace.colorHint',
          'A sidebar accent. Agent status keeps its own indicator.'
        )}
      </p>
    </div>
  )
}
