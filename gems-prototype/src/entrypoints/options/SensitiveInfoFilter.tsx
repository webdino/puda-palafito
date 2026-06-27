import { storage } from "@wxt-dev/storage";
import { useEffect, useState } from "react";
import {
  ALL_SENSITIVE_INFO_TYPES,
  getEnabledSensitiveInfoTypes,
  getSensitiveInfoLabel,
  type SensitiveInfoType,
} from "@/lib/sensitiveInfo";
import { StorageKeys } from "@/storage";

export function SensitiveInfoFilter() {
  const [enabledTypes, setEnabledTypes] = useState<SensitiveInfoType[]>(ALL_SENSITIVE_INFO_TYPES);

  useEffect(() => {
    getEnabledSensitiveInfoTypes().then(setEnabledTypes);
  }, []);

  async function handleToggle(type: SensitiveInfoType, checked: boolean) {
    const updated = checked
      ? [...new Set([...enabledTypes, type])]
      : enabledTypes.filter((t) => t !== type);
    setEnabledTypes(updated);
    await storage.setItem(StorageKeys.sensitiveInfoTypes, updated);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-800">個人情報マスク</h2>
        <p className="text-xs text-slate-500 mt-1">
          記録するテキストからマスクする個人情報の種別を選択します。
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-slate-100">
        {ALL_SENSITIVE_INFO_TYPES.map((type) => (
          <li key={type} className="flex items-center justify-between px-5 py-3">
            <label
              htmlFor={`sensitive-${type}`}
              className="text-sm text-slate-700 cursor-pointer select-none"
            >
              {getSensitiveInfoLabel(type)}
            </label>
            <input
              id={`sensitive-${type}`}
              type="checkbox"
              checked={enabledTypes.includes(type)}
              onChange={(e) => handleToggle(type, e.target.checked)}
              className="w-4 h-4 accent-indigo-600 cursor-pointer"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
