import { useMemo } from "react";
import { useCreators } from "@/hooks/use-creator";
import { useIntl } from "@/locale";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";

type Props = {
    value?: string | number;
    onValueChange?: (value?: string | number) => void;
};

export default function CreatorFilterBar({ value, onValueChange }: Props) {
    const t = useIntl();
    const creators = useCreators();
    const selfId = useUserStore((state) => state.id);

    const options = useMemo(() => {
        return creators
            .map((creator) => ({
                id: creator.id,
                label:
                    `${creator.id}` === `${selfId}`
                        ? t("me")
                        : creator.name || t("unknown-user"),
            }))
            .sort((a, b) => {
                if (`${a.id}` === `${selfId}`) {
                    return -1;
                }
                if (`${b.id}` === `${selfId}`) {
                    return 1;
                }
                return a.label.localeCompare(b.label);
            });
    }, [creators, selfId, t]);

    if (options.length <= 1) {
        return null;
    }

    return (
        <div className="w-full flex items-center gap-2 overflow-x-auto scrollbar-hidden">
            <button
                type="button"
                className={cn(
                    "h-8 px-3 rounded-full border text-xs font-medium whitespace-nowrap transition-colors",
                    value === undefined
                        ? "bg-stone-900 text-white border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100"
                        : "bg-background border-border text-foreground/70 hover:text-foreground",
                )}
                onClick={() => {
                    onValueChange?.(undefined);
                }}
            >
                {t("all")}
            </button>
            {options.map((option) => (
                <button
                    key={`${option.id}`}
                    type="button"
                    className={cn(
                        "h-8 px-3 rounded-full border text-xs font-medium whitespace-nowrap transition-colors",
                        `${value}` === `${option.id}`
                            ? "bg-stone-900 text-white border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100"
                            : "bg-background border-border text-foreground/70 hover:text-foreground",
                    )}
                    onClick={() => {
                        onValueChange?.(option.id);
                    }}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
