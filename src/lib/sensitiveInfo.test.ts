import { describe, expect, it } from "vitest";
import { maskSensitiveInfo } from "./sensitiveInfo";

describe("maskSensitiveInfo", () => {
  describe("email", () => {
    it("メールアドレスをマスクする", () => {
      expect(maskSensitiveInfo("連絡先は user@example.com です", ["email"])).toBe(
        "連絡先は *** です",
      );
    });

    it("複数のメールアドレスをマスクする", () => {
      expect(maskSensitiveInfo("a@example.com と b@test.co.jp", ["email"])).toBe("*** と ***");
    });
  });

  describe("creditCard", () => {
    it("ハイフン区切りのカード番号をマスクする", () => {
      expect(maskSensitiveInfo("カード番号: 4111-1111-1111-1111", ["creditCard"])).toBe(
        "カード番号: ***",
      );
    });

    it("スペース区切りのカード番号をマスクする", () => {
      expect(maskSensitiveInfo("4111 1111 1111 1111", ["creditCard"])).toBe("***");
    });

    it("区切りなしのカード番号をマスクする", () => {
      expect(maskSensitiveInfo("4111111111111111", ["creditCard"])).toBe("***");
    });
  });

  describe("myNumber", () => {
    it("ハイフン区切りのマイナンバーをマスクする", () => {
      expect(maskSensitiveInfo("マイナンバー: 1234-5678-9012", ["myNumber"])).toBe(
        "マイナンバー: ***",
      );
    });

    it("区切りなしのマイナンバーをマスクする", () => {
      expect(maskSensitiveInfo("123456789012", ["myNumber"])).toBe("***");
    });
  });

  describe("phoneJp", () => {
    it("携帯電話番号をマスクする", () => {
      expect(maskSensitiveInfo("電話: 090-1234-5678", ["phoneJp"])).toBe("電話: ***");
    });

    it("東京の固定電話番号をマスクする", () => {
      expect(maskSensitiveInfo("03-1234-5678", ["phoneJp"])).toBe("***");
    });

    it("横浜の固定電話番号をマスクする", () => {
      expect(maskSensitiveInfo("045-123-4567", ["phoneJp"])).toBe("***");
    });
  });

  describe("postalCodeJp", () => {
    it("郵便番号をマスクする", () => {
      expect(maskSensitiveInfo("〒123-4567", ["postalCodeJp"])).toBe("〒***");
    });
  });

  describe("複数種別", () => {
    it("指定した種別をすべてマスクする", () => {
      expect(
        maskSensitiveInfo("メール: user@example.com 電話: 090-1234-5678", ["email", "phoneJp"]),
      ).toBe("メール: *** 電話: ***");
    });

    it("指定していない種別はマスクしない", () => {
      const text = "メール: user@example.com 電話: 090-1234-5678";
      expect(maskSensitiveInfo(text, ["email"])).toBe(
        "メール: *** 電話: 090-1234-5678",
      );
    });
  });

  describe("マッチなし", () => {
    it("該当がなければ元の文字列を返す", () => {
      expect(maskSensitiveInfo("個人情報なし", ["email"])).toBe("個人情報なし");
    });

    it("空配列を渡すとマスクしない", () => {
      expect(maskSensitiveInfo("user@example.com", [])).toBe("user@example.com");
    });
  });
});
