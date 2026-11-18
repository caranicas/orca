import { z } from 'zod'
import { readActivityMapProviderOptions } from '../agent-session/activity/activity-map-provider-options'

export const ActivityMapProviderOptionsParam = z
  .unknown()
  .optional()
  .transform((value) => (value === undefined ? undefined : readActivityMapProviderOptions(value)))
