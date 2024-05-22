import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  GatewayIntentBits,
  Events,
  TextChannel,
  EmbedBuilder,
  PresenceStatusData,
} from "discord.js";
import fs from "fs";
import path from "path";
import { messagingSlack, createMessage } from "./slack";

const settings = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../src/setting.json"), "utf8")
);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
}); //必要な権限を書いている

const id_log_channel = settings.LogChannel;
const key_stat_channel = settings.KeyStatChannel;   //鍵の状態を表示するチャンネルID
const key_log_channel = settings.KeyLogChannel;     //監視対象である鍵の開閉ログのチャンネルID
const token = settings.Token;

const string2boolean = (value: string | null | undefined): boolean => {
  if (!value) {
    return false;
  }
  return value.toLowerCase() === "true" || value === "1";
}; //文字列をbooleanにする.下で操作卓モードにするか決める時に使う.

const mode_console = string2boolean(settings.ModeConsole); //jsonファイルから操作卓モードにするかを決定する.

const isUseSlack = string2boolean(settings.Slack.Use);

type Key = "BORROW" | "OPEN" | "CLOSE" | "RETURN"; //鍵の状態の種類

let var_status: Key = "RETURN"; //鍵の状態を格納する.状態によって値が変わる.

type oper_key = (status: Key) => Key; //鍵への操作を表す関数の型.

const borrow_key: oper_key = (status: Key) => {
  return status === "RETURN" ? "BORROW" : status;
}; //鍵を借りることができるかどうかの判定.0なら成功で1を返し, 失敗なら引数の値をそのまま返す.
const open_key: oper_key = (status: Key) => {
  return (status === "BORROW" || status === "CLOSE") && !mode_console
    ? "OPEN"
    : status;
}; //鍵を開けることができるかどうかの判定.1か3なら成功で2を返し, 失敗なら引数の値をそのまま返す.操作卓モードだと失敗する.
const close_key: oper_key = (status: Key) => {
  return status === "OPEN" && !mode_console ? "CLOSE" : status;
}; //鍵を閉めることができるかどうかの判定.2なら成功で3を返し, 失敗なら引数の値をそのまま返す.操作卓モードだと失敗する.
const return_key: oper_key = (status: Key) => {
  return status === "BORROW" || status === "CLOSE" ? "RETURN" : status;
}; //鍵を返却することができるかどうかの判定.1か3なら成功で3を返し, 失敗なら引数の値をそのまま返す.

// ボタンを定義している
const borrow_button = new ButtonBuilder()
  .setCustomId("BORROW")
  .setLabel("借りる")
  .setStyle(ButtonStyle.Success);
const opne_button = new ButtonBuilder()
  .setCustomId("OPEN")
  .setLabel("開ける")
  .setStyle(ButtonStyle.Success);
const close_button = new ButtonBuilder()
  .setCustomId("CLOSE")
  .setLabel("閉める")
  .setStyle(ButtonStyle.Danger);
const return_button = new ButtonBuilder()
  .setCustomId("RETURN")
  .setLabel("返す")
  .setStyle(ButtonStyle.Danger);

//鍵の状態とラベルを対応付けている
const mapLabel: Map<Key, string> = new Map([
  ["RETURN", "返しました"],
  ["BORROW", "借りました"],
  ["OPEN", "開けました"],
  ["CLOSE", "閉めました"],
]);

//鍵の状態とボタンのセットを対応付けている
const mapButtons: Map<Key, ActionRowBuilder<ButtonBuilder>> = new Map([
  [
    "RETURN",
    new ActionRowBuilder<ButtonBuilder>().addComponents(borrow_button),
  ],
  [
    "BORROW",
    !mode_console
      ? new ActionRowBuilder<ButtonBuilder>()
          .addComponents(opne_button)
          .addComponents(return_button)
      : new ActionRowBuilder<ButtonBuilder>().addComponents(return_button),
  ],
  ["OPEN", new ActionRowBuilder<ButtonBuilder>().addComponents(close_button)],
  [
    "CLOSE",
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(return_button)
      .addComponents(opne_button),
  ],
]);

//鍵の状態とそれに対応する操作を紐づけている
const mapOpers: Map<Key, oper_key> = new Map([
  ["RETURN", return_key],
  ["BORROW", borrow_key],
  ["OPEN", open_key],
  ["CLOSE", close_key],
]);

//setPresenceの引数のオブジェクト内のActivityの型の定義
type Activity = {
  name: string;
};
//setPresenceの引数のオブジェクトの型の定義
type Presence = {
  status: PresenceStatusData;
  activities: Activity[];
};

//状態とPrecenceを紐づけている
const mapPresence: Map<Key, Presence> = new Map([
  [
    "RETURN",
    {
      status: "invisible",
      activities: [],
    },
  ],
  [
    "BORROW",
    {
      status: "idle",
      activities: [],
    },
  ],
  [
    "OPEN",
    {
      status: "online",
      activities: [{ name: "部室" }],
    },
  ],
  [
    "CLOSE",
    {
      status: "idle",
      activities: [],
    },
  ],
]);

//ボットが起動したら
client.once("ready", (bot) => {
  console.log("Ready!");

  if (client.user) {
    console.log(client.user.tag);
  }
  client.user?.setPresence({
    status: "invisible",
    activities: [],
  }); //ステータスを非公開にする

  //鍵用チャンネルに初期メッセージを送る
  if (id_log_channel) {
    const initialButtonSet: ActionRowBuilder<ButtonBuilder> =
      mapButtons.get("RETURN") ?? new ActionRowBuilder<ButtonBuilder>();
    (bot.channels?.cache.get(id_log_channel) as TextChannel).send({
      content: "鍵管理Botです. 鍵をに対する操作を選んでください.",
      components: [initialButtonSet],
    });
  } //discordにメッセージを送る
});
//型がKeyかどうかを確認するためのユーザー定義型ガード
const isKey = (value: string): value is Key => {
  return (
    value === "BORROW" ||
    value === "OPEN" ||
    value === "CLOSE" ||
    value === "RETURN"
  );
};

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) {
    throw Error("interaction is not Button");
  } //インタラクションがボタンかどうかを確認する
  if (!isKey(var_status)) {
    throw Error("var_status is not apropriate");
  } //var_statusの型がKeyかどうかを確認する

  const btn = interaction.customId; //押されたボタンの状態(型:Key)を代入する
  if (!isKey(btn)) {
    throw Error("buttonInteraction.customId is not Key");
  } //customIdがKey型かどうかを確認する.

  const oper = mapOpers.get(btn); //押されたボタンに対応する操作を得る
  if (!oper) {
    throw Error("oper is undefined");
  }
  var_status = oper(var_status); //状態を更新する

  const buttonSet = mapButtons.get(var_status); //更新後の状態に対応するボタンセットを得る
  if (!buttonSet) {
    throw Error("buttonSet is undefined");
  }

  const label = mapLabel.get(var_status); //更新後の状態に対応するラベルを得る
  if (!label) {
    throw Error("label is undefined");
  }

  const presence = mapPresence.get(var_status); //更新後の状態に対応するPresenceを得る
  if (!presence) {
    throw Error("presence is undefined");
  }

  interaction.client.user.setPresence(presence); //Presenceを更新する

  const userTag = interaction.user.tag; // userTagを取得

  // userTagを#で分割して識別タグが0ならば，usernameを取得する
  const username = userTag.split("#")[1] ? interaction.user.username : userTag;

  const userIconUrl = interaction.user.avatarURL();

  const embed = new EmbedBuilder() //鍵になにかした時のメッセージを作る
    .setColor(0x0099ff) //水色っぽい色
    .setAuthor({ name: username, iconURL: userIconUrl ?? undefined }) //ボタンを押した人のユーザー名とアイコンを取得する
    .setTitle(`${label}`) //行った操作を表示する
    .setTimestamp();

  interaction.reply({
    embeds: [embed],
    components: [buttonSet],
  });

  // 前回のメッセージを取得
  const previousMessage = await interaction.channel?.messages.fetch(
    interaction.message.id
  );

  // もし前回のメッセージがあれば，ボタンを無効化する
  if (previousMessage) {
    previousMessage.edit({
      embeds: previousMessage.embeds,
      components: [],
    });
  }

  if (isUseSlack) {
    messagingSlack(createMessage(username)(label))(settings.Slack.WebhookUrl);
  }
});

//鍵の開閉情報をログから受け取り、チャンネル名に開閉情報を表示させる
const key_log_ptn = {"opened": "🟢", "closed":"🟠"};

client.on("messageCreate", (message) => {
  if (message.author.id === client.user.id) return; //自分自身のメッセージの場合、無視する (現段階では必要ないが一応)
  //鍵の開閉ログのメッセージだった場合
  if (message.channel.id === key_log_channel && message.webhookId && message.author.username === "部室鍵") {
    //メッセージが"opened"、もしくは"closed"かどうか判定
    if (key_log_ptn[message.content]) {
      client.chennel.cache.get(key_stat_channel).setName(`${key_log_ptn[message.content]} Key State: ${message.content}`); //鍵の開閉状態をチャンネル名に反映
    }
  }
});

client.login(token);
