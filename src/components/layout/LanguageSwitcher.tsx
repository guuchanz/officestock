"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { clsx } from "clsx";
import { setLocaleAction } from "@/actions/locale.actions";
import type { Locale } from "@/i18n/config";

export default function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const switchTo = (next: Locale) => {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-center gap-0.5 rounded-full bg-white/10 p-0.5 text-[11px] font-semibold">
      {(["th", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => switchTo(code)}
          aria-pressed={locale === code}
          disabled={pending}
          className={clsx(
            "w-9 rounded-full py-1 transition-colors",
            locale === code ? "bg-white text-[#1e3a5f]" : "text-blue-200 hover:text-white",
            pending && "opacity-60"
          )}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
