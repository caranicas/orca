import { useState } from 'react'
import { defineFixture } from '../../component-fixtures/component-fixture'
import { WorkspaceColorField } from './WorkspaceColorField'
import { PinnedWorkspaceGroupsDialog } from './PinnedWorkspaceGroupsDialog'
import { useWorkspaceOrganization } from '@/store/workspace-organization'

function ColorExample() {
  const [color, setColor] = useState<string | null>('#8b5cf6')
  return (
    <div className="bg-background p-6 text-foreground">
      <WorkspaceColorField value={color} onChange={setColor} />
    </div>
  )
}

export const colorField = defineFixture({ width: 620, render: () => <ColorExample /> })

export const groups = defineFixture({
  width: 640,
  setup: () =>
    useWorkspaceOrganization.setState({
      grouping: {
        groups: [
          { id: 'migrations', name: 'Component migrations' },
          { id: 'accessibility', name: 'Accessibility' },
          { id: 'later', name: 'Follow up' }
        ],
        memberships: {}
      },
      managerOpen: true
    }),
  render: () => <PinnedWorkspaceGroupsDialog />
})
