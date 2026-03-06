import { resolve } from "node:path";
import { defineWebExtConfig } from "wxt";

export default defineWebExtConfig({
  // Chrome://flags の設定を永続化するためプロファイルを固定する
  // Windows ではパスを絶対パスにする必要がある
  chromiumProfile: resolve(".wxt/chrome-dev"),
  keepProfileChanges: true,
});
