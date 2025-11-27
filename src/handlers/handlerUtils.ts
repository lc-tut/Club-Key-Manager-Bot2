import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { BorrowerInfo } from "../types";
import { config } from "../config";
import { setBorrowerInfo } from "../services/reminderService";

/**
 * インタラクションからユーザー情報を取得するヘルパー関数
 * @param interaction - ボタンまたはコマンドのインタラクション
 * @returns ユーザー名とアイコンURL
 */
export const getUserInfo = (
  interaction: ButtonInteraction | ChatInputCommandInteraction
) => {
  return {
    username: interaction.user.username,
    userIconUrl: interaction.user.avatarURL(),
  };
};

/**
 * リマインダー設定の説明文を生成するヘルパー関数
 * @returns リマインダー設定の説明文
 */
export const getReminderSettingMessage = (): string => {
  if (config.isReminderEnabled) {
    // リマインダーが有効な場合
    const scheduledCheckInfo = config.isScheduledCheckEnabled
      ? `\n・定時チェック: ${config.checkHour}時${config.checkMinute}分`
      : "";
    return `リマインダーが有効です\n・間隔: ${config.reminderTimeMinutes}分ごと${scheduledCheckInfo}`;
  } else {
    // リマインダーが無効な場合
    const scheduledCheckInfo = config.isScheduledCheckEnabled
      ? `${config.checkHour}時${config.checkMinute}分`
      : "無効";
    return `リマインダーは無効です\n・定時チェック: ${scheduledCheckInfo}`;
  }
};

/**
 * リマインダー設定情報を埋め込みメッセージに追加するヘルパー関数
 * @param embed - 埋め込みメッセージ
 * @returns 更新された埋め込みメッセージ
 */
export const addReminderSettingsToEmbed = (
  embed: EmbedBuilder
): EmbedBuilder => {
  embed.addFields({
    name: "⏰ リマインダー設定",
    value: getReminderSettingMessage(),
    inline: false,
  });
  return embed;
};

/**
 * 鍵を借りたユーザーの情報を保存するヘルパー関数
 * @param userId - ユーザーID
 * @param username - ユーザー名
 * @param channelId - チャンネルID
 * @param timerId - リマインダータイマーID（オプション）
 * @returns 保存されたユーザー情報
 */
export const saveBorrowerInfo = (
  userId: string,
  username: string,
  channelId: string,
  timerId?: NodeJS.Timeout
): BorrowerInfo => {
  const borrowerInfo: BorrowerInfo = {
    userId,
    username,
    channelId,
    timerId: timerId ?? null,
    borrowedAt: Date.now(),
    reminderCount: 0,
  };
  setBorrowerInfo(borrowerInfo);
  return borrowerInfo;
};
