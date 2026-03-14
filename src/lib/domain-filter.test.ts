import { describe, expect, it } from "vitest";

import { isAllowedByDomainFilter } from "./domain-filter";

describe("isAllowedByDomainFilter", () => {
  describe("domains が空の場合", () => {
    it("すべてのURLを許可する", () => {
      expect(isAllowedByDomainFilter("https://example.com", [])).toBe(true);
    });
  });

  describe("完全一致", () => {
    it("登録済みドメインと一致するURLを拒否する", () => {
      expect(isAllowedByDomainFilter("https://example.com/path", ["example.com"])).toBe(false);
    });

    it("登録されていないドメインのURLを許可する", () => {
      expect(isAllowedByDomainFilter("https://other.com", ["example.com"])).toBe(true);
    });
  });

  describe("サブドメイン", () => {
    it("サブドメインのURLを拒否する", () => {
      expect(isAllowedByDomainFilter("https://www.example.com", ["example.com"])).toBe(false);
    });

    it("深いサブドメインのURLを拒否する", () => {
      expect(isAllowedByDomainFilter("https://a.b.example.com", ["example.com"])).toBe(false);
    });

    it("ドメインが末尾に含まれるだけのURLは拒否しない", () => {
      // notexample.com は example.com のサブドメインではない
      expect(isAllowedByDomainFilter("https://notexample.com", ["example.com"])).toBe(true);
    });
  });

  describe("複数ドメイン", () => {
    it("いずれかのドメインに一致するURLを拒否する", () => {
      expect(isAllowedByDomainFilter("https://foo.com", ["bar.com", "foo.com"])).toBe(false);
    });

    it("どのドメインにも一致しないURLを許可する", () => {
      expect(isAllowedByDomainFilter("https://other.com", ["bar.com", "foo.com"])).toBe(true);
    });
  });

  describe("不正なURL", () => {
    it("パースできないURLは拒否する", () => {
      expect(isAllowedByDomainFilter("not a url", ["example.com"])).toBe(false);
    });
  });
});
