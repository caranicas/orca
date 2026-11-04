import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  type ButtonInteraction,
  type Message
} from 'discord.js'
import type { PendingPrompt } from '../../../shared/agent-pending-prompt'
import { isAuthorized } from './bridge-authorization'
import type { BridgeConfig } from './bridge-config'
import type { ThreadPoster } from './conversation-event-relay'
import { ORCA_COMMAND, OrcaSlashCommands, type BridgeLog } from './discord-slash-commands'
import {
  buttonLabel,
  chunkMessage,
  deliveryText,
  describeError,
  isNotLinked,
  NO_MENTIONS,
  orcaErrorText,
  promptCardText
} from './discord-post-text'
import type { ConnectorDelivery, OrcaConnectorClient } from './orca-connector-client'
import type { ThreadPostLedger } from './thread-post-ledger'

const ANSWER_PREFIX = 'orca:answer:'
const MAX_BUTTONS = 25
const BUTTONS_PER_ROW = 5

export class DiscordBridgeBot implements ThreadPoster {
  private readonly client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      // Privileged: enable "Message Content Intent" on the bot's page in the developer portal.
      GatewayIntentBits.MessageContent
    ]
  })
  private readonly commands: OrcaSlashCommands

  constructor(
    private readonly config: BridgeConfig,
    private readonly orca: OrcaConnectorClient,
    ledger: ThreadPostLedger,
    private readonly log: BridgeLog
  ) {
    this.commands = new OrcaSlashCommands(orca, ledger, log)
    this.client.once(Events.ClientReady, (ready) => {
      this.log('discord_ready', { user: ready.user.tag })
      void this.registerCommands()
    })
    this.client.on(Events.ShardDisconnect, () => this.log('discord_disconnected'))
    this.client.on(Events.ShardResume, () => this.log('discord_resumed'))
    this.client.on(Events.MessageCreate, (message) => void this.onMessage(message))
    this.client.on(Events.InteractionCreate, (interaction) => {
      if (interaction.isAutocomplete()) {
        void (this.allowed(interaction.guildId, interaction.user.id)
          ? this.commands.autocomplete(interaction)
          : interaction.respond([]))
      } else if (interaction.isChatInputCommand()) {
        void (this.allowed(interaction.guildId, interaction.user.id)
          ? this.commands.run(interaction)
          : interaction.reply({
              content: 'You aren’t allowed to control Orca from here.',
              flags: MessageFlags.Ephemeral
            }))
      } else if (interaction.isButton() && interaction.customId.startsWith(ANSWER_PREFIX)) {
        void this.onAnswer(interaction)
      }
    })
  }

  async start(): Promise<void> {
    await this.client.login(this.config.botToken)
  }

  async stop(): Promise<void> {
    await this.client.destroy()
  }

  async postText(threadId: string, text: string): Promise<void> {
    const thread = await this.thread(threadId)
    for (const content of chunkMessage(text)) {
      await thread.send({ content, allowedMentions: NO_MENTIONS })
    }
  }

  async postPrompt(threadId: string, prompt: PendingPrompt): Promise<void> {
    const thread = await this.thread(threadId)
    const options = prompt.kind === 'unsupported' ? [] : prompt.options.slice(0, MAX_BUTTONS)
    const rows: ActionRowBuilder<ButtonBuilder>[] = []
    for (let i = 0; i < options.length; i += BUTTONS_PER_ROW) {
      const buttons = options
        .slice(i, i + BUTTONS_PER_ROW)
        .map((option) =>
          new ButtonBuilder()
            .setCustomId(`${ANSWER_PREFIX}${prompt.promptId}:${option.id}`)
            .setLabel(buttonLabel(option.label))
            .setStyle(buttonStyle(option.id))
        )
      rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons))
    }
    // Buttons ride on the last chunk so they sit under the whole question.
    const chunks = chunkMessage(promptCardText(prompt))
    const last = chunks.pop() ?? ''
    for (const content of chunks) {
      await thread.send({ content, allowedMentions: NO_MENTIONS })
    }
    await thread.send({ content: last, components: rows, allowedMentions: NO_MENTIONS })
  }

  async showTyping(threadId: string): Promise<void> {
    await (await this.thread(threadId)).sendTyping()
  }

  private async thread(threadId: string) {
    const channel = await this.client.channels.fetch(threadId)
    if (!channel?.isThread()) {
      throw new Error('thread_not_found')
    }
    return channel
  }

  private async registerCommands(): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(this.config.guildId)
      await guild.commands.set([ORCA_COMMAND.toJSON()])
      this.log('discord_commands_registered', { guildId: this.config.guildId })
    } catch (error) {
      this.log('discord_commands_failed', { error: describeError(error) })
    }
  }

  private allowed(guildId: string | null, userId: string): boolean {
    const ok = isAuthorized(this.config, { guildId, userId })
    if (!ok) {
      this.log('discord_unauthorized', { guildId, userId })
    }
    return ok
  }

  private async onMessage(message: Message): Promise<void> {
    if (message.author.bot || !message.channel.isThread() || message.content.trim() === '') {
      return
    }
    if (!this.allowed(message.guildId, message.author.id)) {
      return
    }
    const threadId = message.channel.id
    let delivery: ConnectorDelivery
    try {
      delivery = await this.orca.send(threadId, message.id, message.content)
    } catch (error) {
      // Threads the bridge never linked are ordinary Discord threads.
      if (!isNotLinked(error)) {
        this.log('orca_send_failed', { threadId, error: describeError(error) })
        await message.reply({ content: orcaErrorText(error), allowedMentions: NO_MENTIONS })
      }
      return
    }
    this.log('orca_send', { threadId, outcome: delivery.outcome })
    await (delivery.outcome === 'accepted'
      ? message.react('📨')
      : message.reply({ content: deliveryText(delivery), allowedMentions: NO_MENTIONS }))
  }

  private async onAnswer(interaction: ButtonInteraction): Promise<void> {
    if (!this.allowed(interaction.guildId, interaction.user.id)) {
      await interaction.reply({
        content: 'Only allowed Orca users can answer this.',
        flags: MessageFlags.Ephemeral
      })
      return
    }
    const [promptId, optionId] = interaction.customId.slice(ANSWER_PREFIX.length).split(':')
    if (!promptId || !optionId) {
      return
    }
    await interaction.deferUpdate()
    let delivery: ConnectorDelivery
    try {
      delivery = await this.orca.answer(interaction.channelId, promptId, optionId)
    } catch (error) {
      this.log('orca_answer_failed', { error: describeError(error) })
      await interaction.followUp({ content: orcaErrorText(error), flags: MessageFlags.Ephemeral })
      return
    }
    this.log('orca_answer', { threadId: interaction.channelId, outcome: delivery.outcome })
    if (delivery.outcome === 'accepted') {
      const label = buttonText(interaction, optionId)
      await interaction.editReply({
        content: `${interaction.message.content}\n\n<@${interaction.user.id}> answered: **${label}**`,
        components: [],
        allowedMentions: NO_MENTIONS
      })
      return
    }
    if (delivery.outcome === 'refused' && delivery.reason === 'prompt_not_pending') {
      await interaction.editReply({ components: [] })
    }
    await interaction.followUp({ content: deliveryText(delivery), flags: MessageFlags.Ephemeral })
  }
}

function buttonStyle(optionId: string): ButtonStyle {
  if (optionId.startsWith('allow')) {
    return ButtonStyle.Success
  }
  return optionId.startsWith('reject') ? ButtonStyle.Danger : ButtonStyle.Secondary
}

function buttonText(interaction: ButtonInteraction, optionId: string): string {
  for (const row of interaction.message.components) {
    if (!('components' in row)) {
      continue
    }
    for (const component of row.components) {
      if ('customId' in component && component.customId?.endsWith(`:${optionId}`)) {
        return 'label' in component && component.label ? component.label : optionId
      }
    }
  }
  return optionId
}
