import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { v4 } from "uuid";
import Ledger from "@/components/ledger";
import modal from "@/components/modal";
import Money from "@/components/money";
import MonthPicker from "@/components/month-picker";
import SettlementConfigCard from "@/components/settlement/config-card";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    buildSettlementSearchParams,
    createSettlementRange,
    getSettlementRangeLabel,
    parseSettlementRangeFromSearchParams,
} from "@/features/settlement/period";
import {
    buildSettlementOverview,
    fetchSettlementBills,
    type SettlementOverview,
} from "@/features/settlement/query";
import {
    getSettlementPairKey,
    getSettlementPeriodKey,
} from "@/features/settlement/status";
import { useCreators } from "@/hooks/use-creator";
import { amountToNumber } from "@/ledger/bill";
import { isSettlementConfigComplete } from "@/ledger/settlement";
import type { SettlementRecord } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";
import { getEffectiveSettlementConfig } from "@/utils/tag-config";

const chipClassName =
    "h-8 px-3 rounded-full border text-sm whitespace-nowrap transition-colors";
const chipActiveClassName = "bg-foreground text-background border-foreground";
const chipInactiveClassName =
    "bg-transparent border-border text-foreground/70 hover:text-foreground";
const allFilterValue = "__all__";

export default function SettlementPage() {
    const t = useIntl();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [overview, setOverview] = useState<SettlementOverview>();
    const [loading, setLoading] = useState(true);
    const [showConfig, setShowConfig] = useState(false);
    const [personFilter, setPersonFilter] = useState(allFilterValue);
    const [attributionFilter, setAttributionFilter] = useState(allFilterValue);
    const currentBookId = useBookStore((state) => state.currentBookId);
    const meta = useLedgerStore((state) => state.infos?.meta);
    const userId = useUserStore((state) => state.id);
    const creators = useCreators();
    const range = useMemo(
        () => parseSettlementRangeFromSearchParams(searchParams),
        [searchParams],
    );
    const config = useMemo(
        () => getEffectiveSettlementConfig(meta, userId),
        [meta, userId],
    );
    const records = meta?.settlementRecords;
    const monthPickerYearRange = useMemo(() => {
        const currentYear = dayjs().year();
        return [currentYear - 10, currentYear + 1] as const;
    }, []);

    const loadOverview = useCallback(
        async (isCancelled: () => boolean = () => false) => {
            if (!currentBookId) {
                setOverview(undefined);
                setLoading(false);
                return;
            }

            if (!isSettlementConfigComplete(config)) {
                setOverview(
                    buildSettlementOverview({
                        bills: [],
                        config,
                        range,
                        records,
                    }),
                );
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const bills = await fetchSettlementBills({
                    bookId: currentBookId,
                    range,
                    config,
                });
                if (isCancelled()) {
                    return;
                }
                setOverview(
                    buildSettlementOverview({
                        bills,
                        config,
                        range,
                        records,
                    }),
                );
            } finally {
                if (!isCancelled()) {
                    setLoading(false);
                }
            }
        },
        [config, currentBookId, range, records],
    );

    useEffect(() => {
        let cancelled = false;

        void loadOverview(() => cancelled);
        return () => {
            cancelled = true;
        };
    }, [loadOverview]);

    const creatorNameMap = useMemo(() => {
        return new Map(
            creators.map((creator) => [String(creator.id), creator.name]),
        );
    }, [creators]);
    const tagNameMap = useMemo(() => {
        return new Map((meta?.tags ?? []).map((tag) => [tag.id, tag.name]));
    }, [meta?.tags]);

    const getCreatorName = useCallback(
        (id: string) => {
            return creatorNameMap.get(String(id)) ?? id;
        },
        [creatorNameMap],
    );

    const statusText = useMemo(() => {
        switch (overview?.status) {
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
    }, [overview?.status, t]);

    const summaryText = useMemo(() => {
        if (overview?.status === "missing-config") {
            return t("settlement-config-missing");
        }
        if (!overview || loading) {
            return t("loading");
        }
        if (overview.bills.length === 0) {
            return t("settlement-no-bills");
        }
        if (!overview.summary || overview.summary.kind === "balanced") {
            return t("settlement-summary-balanced");
        }
        return t("settlement-summary-owed", {
            payer: getCreatorName(overview.summary.payerId),
            receiver: getCreatorName(overview.summary.receiverId),
            amount: amountToNumber(overview.summary.amount),
        });
    }, [getCreatorName, loading, overview, t]);

    const returnTo = useMemo(() => {
        return {
            pathname: "/settlement",
            search: `?${buildSettlementSearchParams(range)}`,
        };
    }, [range]);

    const openSearch = (filter: Record<string, unknown>) => {
        navigate("/search", {
            state: {
                filter,
                returnTo,
            },
        });
    };

    const markSettled = async () => {
        if (
            !overview?.summary ||
            overview.summary.kind !== "transfer" ||
            !config ||
            !isSettlementConfigComplete(config)
        ) {
            return;
        }

        let note: string | undefined;
        try {
            note = (await modal.prompt({
                title: t("settlement-note-prompt"),
                input: {
                    type: "text",
                    maxLength: 80,
                    placeholder: t("settlement-note-placeholder"),
                },
            })) as string | undefined;
        } catch {
            return;
        }

        const nextRecord: SettlementRecord = {
            id: v4(),
            periodKey: getSettlementPeriodKey(
                range,
                config.memberAId,
                config.memberBId,
            ),
            start: range.start,
            end: range.end,
            memberAId: String(config.memberAId),
            memberBId: String(config.memberBId),
            payerId: overview.summary.payerId,
            receiverId: overview.summary.receiverId,
            amount: overview.summary.amount,
            settledAt: Date.now(),
            note: note?.trim() ? note.trim() : undefined,
        };

        await useLedgerStore.getState().updateGlobalMeta((prev) => {
            prev.settlementRecords = [
                nextRecord,
                ...(prev.settlementRecords ?? []),
            ];
            return prev;
        });
        toast.success(t("settlement-record-created"));
    };

    const historyRecords = useMemo(() => {
        if (!config || !isSettlementConfigComplete(config)) {
            return [];
        }
        const pairKey = getSettlementPairKey(
            config.memberAId,
            config.memberBId,
        );
        return [...(records ?? [])]
            .filter(
                (record) =>
                    getSettlementPairKey(record.memberAId, record.memberBId) ===
                    pairKey,
            )
            .sort((left, right) => right.settledAt - left.settledAt);
    }, [config, records]);
    const memberIds = useMemo(() => {
        if (!config || !isSettlementConfigComplete(config)) {
            return [];
        }

        return [String(config.memberAId), String(config.memberBId)];
    }, [config]);
    const personFilterOptions = useMemo(() => {
        return memberIds.map((id) => ({
            value: id,
            label: getCreatorName(id),
        }));
    }, [getCreatorName, memberIds]);
    const attributionFilterOptions = useMemo(() => {
        if (!config || !isSettlementConfigComplete(config)) {
            return [];
        }

        return [
            {
                value: config.homeTagId,
                label:
                    tagNameMap.get(config.homeTagId) ??
                    t("settlement-attribution-home"),
            },
            {
                value: config.memberATagId,
                label:
                    tagNameMap.get(config.memberATagId) ??
                    getCreatorName(String(config.memberAId)),
            },
            {
                value: config.memberBTagId,
                label:
                    tagNameMap.get(config.memberBTagId) ??
                    getCreatorName(String(config.memberBId)),
            },
        ];
    }, [config, getCreatorName, t, tagNameMap]);

    useEffect(() => {
        if (
            personFilter !== allFilterValue &&
            !personFilterOptions.some((option) => option.value === personFilter)
        ) {
            setPersonFilter(allFilterValue);
        }

        if (
            attributionFilter !== allFilterValue &&
            !attributionFilterOptions.some(
                (option) => option.value === attributionFilter,
            )
        ) {
            setAttributionFilter(allFilterValue);
        }
    }, [
        attributionFilter,
        attributionFilterOptions,
        personFilter,
        personFilterOptions,
    ]);

    const settlementBills = useMemo(() => {
        return [...(overview?.bills ?? [])]
            .filter((bill) => {
                if (bill.type !== "expense") {
                    return false;
                }

                if (memberIds.length === 0) {
                    return true;
                }

                return memberIds.includes(String(bill.creatorId));
            })
            .sort((left, right) => right.time - left.time);
    }, [memberIds, overview?.bills]);
    const filteredSettlementBills = useMemo(() => {
        return settlementBills.filter((bill) => {
            if (
                personFilter !== allFilterValue &&
                String(bill.creatorId) !== personFilter
            ) {
                return false;
            }

            if (
                attributionFilter !== allFilterValue &&
                !bill.tagIds?.includes(attributionFilter)
            ) {
                return false;
            }

            return true;
        });
    }, [attributionFilter, personFilter, settlementBills]);
    const filteredSettlementAmount = useMemo(() => {
        return filteredSettlementBills.reduce(
            (total, bill) => total + Math.abs(bill.amount),
            0,
        );
    }, [filteredSettlementBills]);
    const hasBillFilter =
        personFilter !== allFilterValue || attributionFilter !== allFilterValue;

    return (
        <div className="w-full h-full overflow-y-auto page-show">
            <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 p-3">
                <div className="rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-xl font-semibold">
                                    {t("settlement-detail-title")}
                                </div>
                                <div className="mt-1 text-sm text-foreground/70">
                                    {getSettlementRangeLabel(range)}
                                </div>
                            </div>
                            <div className="rounded-full border px-3 py-1 text-xs font-medium text-foreground/75">
                                {statusText}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                className={cn(
                                    chipClassName,
                                    range.preset === "this-month"
                                        ? chipActiveClassName
                                        : chipInactiveClassName,
                                )}
                                onClick={() => {
                                    const nextRange =
                                        createSettlementRange("this-month");
                                    setSearchParams(
                                        buildSettlementSearchParams(nextRange),
                                    );
                                }}
                            >
                                {t("settlement-period-this-month")}
                            </button>
                            <button
                                type="button"
                                className={cn(
                                    chipClassName,
                                    range.preset === "last-month"
                                        ? chipActiveClassName
                                        : chipInactiveClassName,
                                )}
                                onClick={() => {
                                    const nextRange =
                                        createSettlementRange("last-month");
                                    setSearchParams(
                                        buildSettlementSearchParams(nextRange),
                                    );
                                }}
                            >
                                {t("settlement-period-last-month")}
                            </button>
                            <MonthPicker
                                value={
                                    range.preset === "custom"
                                        ? dayjs(range.start)
                                        : undefined
                                }
                                yearRange={monthPickerYearRange}
                                allowClear={false}
                                placeholder={t("settlement-period-custom")}
                                triggerClassName={cn(
                                    chipClassName,
                                    range.preset === "custom"
                                        ? chipActiveClassName
                                        : chipInactiveClassName,
                                )}
                                onChange={(value) => {
                                    const target = value ?? dayjs();
                                    const nextRange = createSettlementRange(
                                        "custom",
                                        {
                                            start: target
                                                .startOf("month")
                                                .valueOf(),
                                            end: target
                                                .endOf("month")
                                                .valueOf(),
                                        },
                                    );
                                    setSearchParams(
                                        buildSettlementSearchParams(nextRange),
                                    );
                                }}
                            />
                        </div>

                        <div className="rounded-2xl border bg-background/70 p-4">
                            <div className="flex flex-col gap-2">
                                <div className="text-xs uppercase tracking-[0.18em] text-foreground/45">
                                    {t("settlement-current-summary")}
                                </div>
                                <div className="text-lg font-semibold leading-7">
                                    {summaryText}
                                </div>
                                {overview?.latestRecord && (
                                    <div className="text-xs text-foreground/60">
                                        {t("settlement-last-settled-at", {
                                            time: dayjs(
                                                overview.latestRecord.settledAt,
                                            ).format("YYYY-MM-DD HH:mm"),
                                        })}
                                    </div>
                                )}
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        if (
                                            !config ||
                                            !isSettlementConfigComplete(config)
                                        ) {
                                            setShowConfig(true);
                                            return;
                                        }
                                        openSearch({
                                            start: range.start,
                                            end: range.end,
                                        });
                                    }}
                                >
                                    {t("settlement-view-related-bills")}
                                </Button>
                                {overview &&
                                    overview.issueBillIds.length > 0 && (
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                openSearch({
                                                    ids: overview.issueBillIds,
                                                    start: range.start,
                                                    end: range.end,
                                                });
                                            }}
                                        >
                                            {t("settlement-go-fix-attribution")}
                                        </Button>
                                    )}
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setShowConfig((value) => !value);
                                    }}
                                >
                                    {t("settlement-settings")}
                                </Button>
                                {overview?.summary?.kind === "transfer" &&
                                    overview.status !== "settled" && (
                                        <Button
                                            onClick={() => void markSettled()}
                                        >
                                            {overview.status ===
                                            "changed-since-settled"
                                                ? t("settlement-record-refresh")
                                                : t("settlement-mark-settled")}
                                        </Button>
                                    )}
                            </div>
                        </div>
                    </div>
                </div>

                {showConfig && <SettlementConfigCard />}

                {overview?.settlement && (
                    <div className="grid gap-3 md:grid-cols-2">
                        {overview.settlement.members.map((member) => (
                            <div
                                key={member.memberId}
                                className="rounded-2xl border bg-card p-4 shadow-sm"
                            >
                                <div className="text-base font-medium">
                                    {getCreatorName(member.memberId)}
                                </div>
                                <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                                    <div className="text-foreground/65">
                                        {t("settlement-self-expense")}
                                    </div>
                                    <div className="text-right">
                                        <Money
                                            value={amountToNumber(
                                                member.selfExpense,
                                            )}
                                        />
                                    </div>
                                    <div className="text-foreground/65">
                                        {t("settlement-shared-expense")}
                                    </div>
                                    <div className="text-right">
                                        <Money
                                            value={amountToNumber(
                                                member.sharedExpense,
                                            )}
                                        />
                                    </div>
                                    <div className="text-foreground/65">
                                        {t("settlement-other-expense")}
                                    </div>
                                    <div className="text-right">
                                        <Money
                                            value={amountToNumber(
                                                member.otherExpense,
                                            )}
                                        />
                                    </div>
                                    <div className="text-foreground/65">
                                        {t("settlement-paid")}
                                    </div>
                                    <div className="text-right">
                                        <Money
                                            value={amountToNumber(member.paid)}
                                        />
                                    </div>
                                    <div className="text-foreground/65">
                                        {t("settlement-owed")}
                                    </div>
                                    <div className="text-right">
                                        <Money
                                            value={amountToNumber(member.owed)}
                                        />
                                    </div>
                                    <div className="text-foreground/65">
                                        {t("settlement-net")}
                                    </div>
                                    <div
                                        className={cn(
                                            "text-right font-semibold",
                                            member.net > 0
                                                ? "text-semantic-income"
                                                : member.net < 0
                                                  ? "text-semantic-expense"
                                                  : "",
                                        )}
                                    >
                                        <Money
                                            value={amountToNumber(member.net)}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="text-base font-medium">
                                    {t("settlement-period-bills")}
                                </div>
                                <div className="mt-1 text-sm text-foreground/70">
                                    {hasBillFilter
                                        ? t("settlement-filtered-records", {
                                              filtered:
                                                  filteredSettlementBills.length,
                                              total: settlementBills.length,
                                          })
                                        : t("total-records", {
                                              n: settlementBills.length,
                                          })}
                                </div>
                                {overview?.issueBillIds.length ? (
                                    <div className="mt-1 text-xs text-amber-600 dark:text-amber-300">
                                        {t("settlement-issue-count", {
                                            n: overview.issueBillIds.length,
                                        })}
                                    </div>
                                ) : null}
                            </div>
                            <div className="text-right text-sm">
                                <div className="text-xs text-foreground/55">
                                    {t("settlement-filtered-total")}
                                </div>
                                <div className="font-semibold">
                                    <Money
                                        value={amountToNumber(
                                            filteredSettlementAmount,
                                        )}
                                    />
                                </div>
                            </div>
                            {overview?.issueBillIds.length ? (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        openSearch({
                                            ids: overview.issueBillIds,
                                            start: range.start,
                                            end: range.end,
                                        });
                                    }}
                                >
                                    {t("settlement-go-fix-attribution")}
                                </Button>
                            ) : null}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <div className="flex flex-col gap-1">
                                <div className="text-xs text-foreground/60">
                                    {t("settlement-filter-person")}
                                </div>
                                <Select
                                    value={personFilter}
                                    onValueChange={setPersonFilter}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={allFilterValue}>
                                            {t("settlement-filter-all-people")}
                                        </SelectItem>
                                        {personFilterOptions.map((option) => (
                                            <SelectItem
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="text-xs text-foreground/60">
                                    {t("settlement-filter-attribution")}
                                </div>
                                <Select
                                    value={attributionFilter}
                                    onValueChange={setAttributionFilter}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={allFilterValue}>
                                            {t(
                                                "settlement-filter-all-attributions",
                                            )}
                                        </SelectItem>
                                        {attributionFilterOptions.map(
                                            (option) => (
                                                <SelectItem
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <div className="mt-3 h-[420px] rounded-xl border bg-background/50">
                        {filteredSettlementBills.length > 0 ? (
                            <Ledger
                                bills={filteredSettlementBills}
                                showTime
                                afterEdit={() => {
                                    void loadOverview();
                                }}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center px-4 text-sm text-foreground/60">
                                {hasBillFilter
                                    ? t("settlement-filter-no-bills")
                                    : t("settlement-no-bills")}
                            </div>
                        )}
                    </div>
                    {overview?.status === "changed-since-settled" && (
                        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                            {t("settlement-status-changed-hint")}
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="text-base font-medium">
                        {t("settlement-records-title")}
                    </div>
                    <div className="mt-3 flex flex-col gap-3">
                        {historyRecords.length === 0 ? (
                            <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-center text-foreground/60">
                                {t("settlement-records-empty")}
                            </div>
                        ) : (
                            historyRecords.map((record) => (
                                <div
                                    key={record.id}
                                    className="rounded-xl border px-4 py-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-medium">
                                                {dayjs(record.start).format(
                                                    "YYYY-MM-DD",
                                                )}{" "}
                                                -{" "}
                                                {dayjs(record.end).format(
                                                    "YYYY-MM-DD",
                                                )}
                                            </div>
                                            <div className="mt-1 text-sm text-foreground/70">
                                                {getCreatorName(record.payerId)}{" "}
                                                {t("settlement-record-paid-to")}{" "}
                                                {getCreatorName(
                                                    record.receiverId,
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-semibold">
                                                <Money
                                                    value={amountToNumber(
                                                        record.amount,
                                                    )}
                                                />
                                            </div>
                                            <div className="mt-1 text-xs text-foreground/55">
                                                {dayjs(record.settledAt).format(
                                                    "YYYY-MM-DD HH:mm",
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {record.note && (
                                        <div className="mt-2 text-sm text-foreground/70">
                                            {record.note}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
