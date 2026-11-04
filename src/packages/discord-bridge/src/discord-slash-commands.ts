import {
  ChannelType,
  MessageFlags,
  SlashCommandBuilder,
  ThreadAutoArchiveDuration,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction
} from 'discord.js'
import { deliveryText, describeError, NO_MENTIONS, orcaErrorText } from './discord-post-text'
import type { OrcaConnectorClient } from './orca-connector-client'
import type { ThreadPostLedger } from './thread-post-ledger'

export type BridgeLog = (event: string, fields?: Record<string, unknown>) => void

const MAX_THREAD_NAME = 100
const MAX_CHOICE_CHARS = 100
const MAX_CHOICES = 25

export const ORCA_COMMAND = new SlashCommandBuilder()
  .setName('orca')
  .setDescription('Drive Orca agent sessions from Discord')
  .addSubcommand((sub) => sub.setName('help').setDescription('Show what the bridge can do'))
  .addSubcommand((sub) =>
    sub.setName('sessions').setDescription('List Claude Code and Codex sessions running in Orca')
  )
  .addSubcommand((sub) =>
    sub
      .setName('link')
      .setDescription('Link an Orca session to a thread (creates one when run in a channel)')
      .addStringOption((option) =>
        option
          .setName('session')
          .setDescription('The Orca agent session')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('unlink').setDescription('Stop driving the Orca session from this thread')
  )

const HELP = [
  '**Orca bridge**',
  '`/orca sessions` lists agent sessions running in Orca.',
  '`/orca link` links one to a thread. Messages in the thread go to that session, and its replies come back here.',
  '`/orca unlink` detaches the thread. The agent keeps running in Orca.',
  'Approval and question prompts show up as buttons.'
].join('\n')

/** `/orca` handlers; callers check authorization before dispatching here. */
export class OrcaSlashCommands {
  constructor(
    private readonly orca: OrcaConnectorClient,
    private readonly ledger: ThreadPostLedger,
    private readonly log: BridgeLog
  ) {}

  async run(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      switch (interaction.options.getSubcommand()) {
        case 'help':
          await interaction.reply({ content: HELP, flags: MessageFlags.Ephemeral })
          break
        case 'sessions':
          await this.listSessions(interaction)
          break
        case 'link':
          await this.link(interaction, interaction.options.getString('session', true))
          break
        case 'unlink':
          await this.unlink(interaction)
          break
      }
    } catch (error) {
      this.log('discord_command_failed', { error: describeError(error) })
      const content = orcaErrorText(error)
      await (interaction.deferred || interaction.replied
        ? interaction.editReply({ content })
        : interaction.reply({ content, flags: MessageFlags.Ephemeral }))
    }
  }

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    try {
      const typed = interaction.options.getFocused().toLowerCase()
      const panes = await this.orca.agentPanes()
      await interaction.respond(
        panes
          .map((pane) => ({
            name: `${pane.title} · ${pane.agent} · ${pane.branch}`.slice(0, MAX_CHOICE_CHARS),
            value: pane.paneKey
          }))
          .filter((choice) => choice.name.toLowerCase().includes(typed))
          .slice(0, MAX_CHOICES)
      )
    } catch (error) {
      this.log('discord_autocomplete_failed', { error: describeError(error) })
      await interaction.respond([])
    }
  }

  private async listSessions(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const lines = (await this.orca.agentPanes()).map(
      (pane) => `• **${pane.title}** (${pane.agent}) on \`${pane.branch || pane.worktreePath}\``
    )
    await interaction.editReply({
      content:
        lines.length > 0 ? lines.join('\n') : 'No Claude Code or Codex sessions are running.',
      allowedMentions: NO_MENTIONS
    })
  }

  private async link(interaction: ChatInputCommandInteraction, paneKey: string): Promise<void> {
    await interaction.deferReply()
    const pane = (await this.orca.agentPanes()).find((candidate) => candidate.paneKey === paneKey)
    if (!pane) {
      await interaction.editReply('That session isn’t running in Orca. Pick one from the list.')
      return
    }
    const channel = interaction.channel
    let thread
    if (channel?.isThread()) {
      thread = channel
    } else if (channel?.type === ChannelType.GuildText) {
      thread = await channel.threads.create({
        name: `${pane.title} · ${pane.branch}`.slice(0, MAX_THREAD_NAME),
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        reason: 'Orca session link'
      })
    } else {
      await interaction.editReply('Run this in a text channel or one of its threads.')
      return
    }
    const delivery = await this.orca.link(thread.id, paneKey)
    this.log('orca_link', { threadId: thread.id, outcome: delivery.outcome })
    if (delivery.outcome !== 'accepted') {
      await interaction.editReply(deliveryText(delivery))
      return
    }
    await interaction.editReply(`Linked **${pane.title}** to <#${thread.id}>.`)
    if (thread.id !== interaction.channelId) {
      await thread.send({
        content: `Linked to **${pane.title}** (${pane.agent}) on \`${pane.branch}\`. Messages here go to that session.`,
        allowedMentions: NO_MENTIONS
      })
    }
  }

  private async unlink(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.channel?.isThread()) {
      await interaction.reply({
        content: 'Run this inside a linked thread.',
        flags: MessageFlags.Ephemeral
      })
      return
    }
    await interaction.deferReply()
    await this.orca.unlink(interaction.channel.id)
    this.ledger.forget(interaction.channel.id)
    await interaction.editReply('Unlinked. The agent keeps running in Orca.')
  }
}
