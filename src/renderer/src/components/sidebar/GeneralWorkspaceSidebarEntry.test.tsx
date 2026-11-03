// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GeneralWorkspaceSidebarEntry } from './GeneralWorkspaceSidebarEntry'

const mocks = vi.hoisted(() => ({ open: vi.fn(), error: vi.fn(), active: false }))
vi.mock('@/lib/open-general-workspace', () => ({ openGeneralWorkspace: mocks.open }))
vi.mock('sonner', () => ({ toast: { error: mocks.error } }))
vi.mock('@/store', () => ({ useAppStore: () => mocks.active }))

beforeEach(() => {
  mocks.open.mockReset().mockResolvedValue(undefined)
  mocks.error.mockReset()
  mocks.active = false
  vi.stubGlobal('__ORCA_WEB_CLIENT__', false)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('opens General with a labeled clickable control and reflects the active page', async () => {
  mocks.active = true
  render(<GeneralWorkspaceSidebarEntry />)
  const button = screen.getByRole('button', { name: 'General' })
  expect(button.getAttribute('aria-current')).toBe('page')
  await act(async () => {
    fireEvent.click(button)
  })
  expect(mocks.open).toHaveBeenCalledTimes(1)
})

it('prevents duplicate requests while opening and surfaces a failure for retry', async () => {
  let rejectOpen: (error: Error) => void = () => {
    throw new Error('Opening has not started')
  }
  mocks.open.mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, reject) => {
        rejectOpen = reject
      })
  )
  render(<GeneralWorkspaceSidebarEntry />)
  const button = screen.getByRole('button', { name: 'General' })
  fireEvent.click(button)
  fireEvent.click(button)
  await waitFor(() => expect(mocks.open).toHaveBeenCalledTimes(1))
  expect(button.hasAttribute('disabled')).toBe(true)
  await act(async () => {
    rejectOpen(new Error('Disk unavailable'))
  })
  expect(mocks.error).toHaveBeenCalledWith('Could not open General', {
    description: 'Disk unavailable'
  })
  expect(button.hasAttribute('disabled')).toBe(false)
  await act(async () => {
    fireEvent.click(button)
  })
  expect(mocks.open).toHaveBeenCalledTimes(2)
})

it('keeps the local creation control out of paired browser windows', () => {
  vi.stubGlobal('__ORCA_WEB_CLIENT__', true)
  render(<GeneralWorkspaceSidebarEntry />)
  expect(screen.queryByRole('button', { name: 'General' })).toBeNull()
})
