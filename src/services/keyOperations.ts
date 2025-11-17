import { Key, OperKey } from "../types";
import { modeConsole } from "../config";

// 鍵を借りる操作の関数
// 返却済み（RETURN）の状態でのみ借りることができ、閉めた状態（CLOSE）になる
export const borrowKey: OperKey = (status: Key) => {
  return status === "RETURN" ? "CLOSE" : status;
};

// 鍵で部屋を開ける操作の関数
// 閉めている（CLOSE）状態で開けることができる
// 操作卓モードの場合は開けることができない
export const openKey: OperKey = (status: Key) => {
  return status === "CLOSE" && !modeConsole ? "OPEN" : status;
};

// 鍵で部屋を閉める操作の関数
// 開いている（OPEN）状態でのみ閉めることができる
// 操作卓モードの場合は閉めることができない
export const closeKey: OperKey = (status: Key) => {
  return status === "OPEN" && !modeConsole ? "CLOSE" : status;
};

// 鍵を返却する操作の関数
// 閉めている（CLOSE）状態で返却できる
export const returnKey: OperKey = (status: Key) => {
  return status === "CLOSE" ? "RETURN" : status;
};
