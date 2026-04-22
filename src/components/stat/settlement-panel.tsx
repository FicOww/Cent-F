import { useMemo } from "react";
import { useNavigate } from "react-router";
import {
    buildSettlementSearchParams,
    createSettlementRange,
} from "@/features/settlement/period";
import { buildSettlementOverview } from "@/features/settlement/query";
import { useCreators } from "@/hooks/use-creator";
import { amountToNumber } from "@/ledger/bill";
import { isSettlementConfigComplete } from "@/ledger/settlement";
import type { Bill } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { getEffectiveSettlementConfig } from "@/utils/tag-config";
import { Button } from "../ui/button";

export default function SettlementPanel({
    bills,
    range,
}: {
    bills: Bill[];
    range: [number, number];
}) {
    const t = useIntl();
    const navigate = useNavigate();
    const meta = useLedgerStore((state) => state.infos?.meta);
    const creators = useCreators();
    const userId = useUserStore((state) => state.id);
    const config = useMemo(
        () => getEffectiveSettlementConfig(meta, userId),
        [meta, userId],
    );
    const settlementRange = useMemo(
        () =>
            createSettlementRange("custom", {
                start: range[0],
                end: range[1],
            }),
        [range],
    );
    const overview = useMemo(
        () =>
            buildSettlementOverview({
                bills,
                config,
                range: settlementRange,
                records: meta?.settlementRecords,
            }),
        [bills, config, meta?.settlementRecords, settlementRange],
    );

    const creatorNameMap = useMemo(() => {
        return new Map(
            creators.map((creator) => [String(creator.id), creator.name]),
        );
    }, [creators]);

    const summaryText = useMemo(() => {
        if (!isSettlementConfigComplete(config)) {
            return t("settlement-config-missing");
        }
        if (overview.bills.length === 0) {
            return t("settlement-no-bills");
        }
        if (!overview.summary || overview.summary.kind === "balanced") {
            return t("settlement-summary-balanced");
        }
        return t("settlement-summary-owed", {
            payer:
                creatorNameMap.get(overview.summary.payerId) ??
                overview.summary.payerId,
            receiver:
                creatorNameMap.get(overview.summary.receiverId) ??
                overview.summary.receiverId,
            amount: amountToNumber(overview.summary.amount),
        });
    }, [config, creatorNameMap, overview, t]);

    const statusText = useMemo(() => {
        switch (overview.status) {
            case "needs-settlement":
                return t("settlement-status-pending");
            case "balanced":
                return t("settlement-status-balanced");
            case "settled":
                return t("settlement-status-settled");
            case "changed-since-settled":
                return t("settlement-status-changed");
            default:
                return t("settlement-status-unconfigured");
        }
    }, [overview.status, t]);

    return (
        <div className="rounded-xl border p-4 w-full flex flex-col gap-3 bg-card shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h2 className="font-medium text-lg">
                        {t("settlement-title")}
                    </h2>
                    <div className="text-xs text-foreground/70">
                        {statusText}
                    </div>
                </div>
                <Button
                    size="sm"
                    onClick={() => {
                        navigate(
                            `/settlement?${buildSettlementSearchParams(
                                settlementRange,
                            )}`,
                        );
                    }}
                >
                    {t("settlement-view-detail")}
                </Button>
            </div>

            <div className="rounded-xl border bg-background/70 px-4 py-3 text-sm font-medium">
                {summaryText}
            </div>

            {overview.issueBillIds.length > 0 && (
                <div className="text-xs text-amber-700 dark:text-amber-300">
                    {t("settlement-issue-count", {
                        n: overview.issueBillIds.length,
                    })}
                </div>
            )}
        </div>
    );
}
