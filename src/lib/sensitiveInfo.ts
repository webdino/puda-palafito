const SensitiveInfoPatterns = {
  email: {
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    name: "email",
    label: "メールアドレス",
  },
  creditCard: {
    regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,
    name: "creditCard",
    label: "クレジットカード番号",
  },
  myNumber: {
    regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,
    name: "myNumber",
    label: "マイナンバー",
  },
  phoneJp: {
    regex: /\b0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4}\b/,
    name: "phoneJp",
    label: "電話番号",
  },
  postalCodeJp: {
    regex: /\b\d{3}-\d{4}\b/,
    name: "postalCodeJp",
    label: "郵便番号",
  },
};

export const ALL_SENSITIVE_INFO_TYPES = Object.keys(SensitiveInfoPatterns) as SensitiveInfoType[];

export function getSensitiveInfoLabel(type: SensitiveInfoType): string {
  return SensitiveInfoPatterns[type].label;
}

export type SensitiveInfoType = keyof typeof SensitiveInfoPatterns;

export function maskSensitiveInfo(text: string, types: SensitiveInfoType[]): string {
  let result = text;
  for (const type of types) {
    const { regex } = SensitiveInfoPatterns[type];
    result = result.replace(new RegExp(regex.source, "g"), "***");
  }
  return result;
}
