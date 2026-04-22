import { useEffect, useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import type { Bill } from "@/ledger/type";
import { useLedgerStore } from "@/store/ledger";
import { Skeleton } from "../ui/skeleton";
import runWidget from "./core/runner";
import type { DSLNode } from "./type";
import WidgetRenderer from "./widget";

export function WidgetPreviewSkeleton({ className }: { className?: string }) {
    return (
        <div className={`p-4 ${className ?? ""}`}>
            <div className="space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </div>
        </div>
    );
}

export default function WidgetPreviewWrapper({
    code,
    settings = {},
    className,
    bills: externalBills,
}: {
    code: string;
    settings?: Record<string, unknown>;
    className?: string;
    bills?: Bill[];
}) {
    const [dsl, setDsl] = useState<DSLNode | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const storeBills = useLedgerStore((state) => state.bills);
    const bills = externalBills ?? storeBills;
    const budgets = useLedgerStore((state) => state.infos?.meta.budgets);
    const creators = useLedgerStore((state) => state.infos?.creators);
    const categories = useLedgerStore((state) => state.infos?.meta.categories);
    const baseCurrency = useLedgerStore(
        (state) => state.infos?.meta.baseCurrency,
    );
    const customCurrencies = useLedgerStore(
        (state) => state.infos?.meta.customCurrencies,
    );
    const quickCurrencies = useLedgerStore(
        (state) => state.infos?.meta.quickCurrencies,
    );
    const tags = useLedgerStore((state) => state.infos?.meta.tags);
    const { theme } = useTheme();

    useEffect(() => {
        let mounted = true;

        const runPreview = async () => {
            setLoading(true);
            setError(null);

            try {
                const isDark =
                    theme === "dark" ||
                    (theme === "system" &&
                        window.matchMedia("(prefers-color-scheme: dark)")
                            .matches);

                const result = await runWidget(code, {
                    settings,
                    getData: async () => ({
                        bills,
                        budgets,
                        filter: {},
                        creators,
                        categories,
                        baseCurrency,
                        customCurrencies,
                        quickCurrencies,
                        tags,
                    }),
                    env: {
                        theme: isDark ? "dark" : "light",
                        language: "zh-CN",
                    },
                });

                if (!mounted) {
                    return;
                }

                if (result.success && result.result) {
                    const dslNode =
                        (result.result as { _node?: DSLNode })?._node ??
                        (result.result as DSLNode);
                    setDsl(dslNode);
                    setError(null);
                    return;
                }

                setError(
                    "error" in result
                        ? (result.error ?? "Unknown widget error")
                        : "Unknown widget error",
                );
                setDsl(null);
            } catch (innerError) {
                if (!mounted) {
                    return;
                }
                setError(
                    innerError instanceof Error
                        ? innerError.message
                        : String(innerError),
                );
                setDsl(null);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        void runPreview();

        return () => {
            mounted = false;
        };
    }, [
        baseCurrency,
        bills,
        budgets,
        categories,
        code,
        creators,
        customCurrencies,
        quickCurrencies,
        settings,
        tags,
        theme,
    ]);

    if (loading) {
        return <WidgetPreviewSkeleton className={className} />;
    }

    if (error) {
        return (
            <div
                className={`px-4 py-3 text-xs text-red-500 ${className ?? ""}`}
            >
                Error: {error.slice(0, 120)}
            </div>
        );
    }

    return <WidgetRenderer dsl={dsl} className={className} />;
}
