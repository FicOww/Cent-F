import dayjs from "dayjs";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useShallow } from "zustand/shallow";
import { StorageAPI } from "@/api/storage";
import CloudLoopIcon from "@/assets/icons/cloud-loop.svg?react";
import AnimatedNumber from "@/components/animated-number";
import { showBookGuide } from "@/components/book/util";
import { HintTooltip } from "@/components/hint";
import BudgetCardWrapper from "@/components/home/cards/budget-card-wrapper";
import CardSection from "@/components/home/cards/card-section";
import PromotionCard from "@/components/home/cards/promotion-card";
import WidgetRail from "@/components/home/cards/widget-rail";
import { PaginationIndicator } from "@/components/indicator";
import type { LedgerRef } from "@/components/ledger";
import Ledger from "@/components/ledger";
import CreatorFilterBar from "@/components/ledger/creator-filter-bar";
import Loading from "@/components/loading";
import MonthPicker from "@/components/month-picker";
import { useBudget } from "@/hooks/use-budget";
import { useSnap } from "@/hooks/use-snap";
import { amountToNumber } from "@/ledger/bill";
import type { Bill } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useAddBillStore } from "@/store/add-bill";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { usePreferenceStore } from "@/store/preference";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";
import { filterOrderedBillListByTimeRange } from "@/utils/filter";
import { denseDate } from "@/utils/time";

let ledgerAnimationShows = false;
const homeFilterChipClassName =
    "h-8 px-3 rounded-full border text-sm whitespace-nowrap transition-colors flex-shrink-0";
const homeFilterChipActiveClassName =
    "bg-foreground text-background border-foreground";
const homeFilterChipInactiveClassName =
    "bg-transparent border-border text-foreground/70 hover:text-foreground";

function sumBillAmount(list: Bill[]) {
    return amountToNumber(
        list.reduce((total, bill) => {
            return total + bill.amount * (bill.type === "income" ? 1 : -1);
        }, 0),
    );
}

export default function Page() {
    const t = useIntl();

    const { bills, loading, sync } = useLedgerStore();
    const currentBook = useBookStore(
        useShallow((state) => {
            const { currentBookId, books } = state;
            return books.find((b) => b.id === currentBookId);
        }),
    );
    const showAssets = usePreferenceStore(
        useShallow((state) => state.showAssetsInLedger),
    );
    const { id: userId } = useUserStore();
    const syncIconClassName =
        sync === "wait"
            ? "icon-[mdi--cloud-minus-outline]"
            : sync === "syncing"
              ? "icon-[line-md--cloud-alt-print-loop]"
              : sync === "success"
                ? "icon-[mdi--cloud-check-outline]"
                : "icon-[mdi--cloud-remove-outline] text-red-600";

    const [visibleDate, setVisibleDate] = useState(dayjs());
    const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>();
    const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs>();
    const [selectedCreatorId, setSelectedCreatorId] = useState<
        string | number | undefined
    >();
    const pendingFocusBill = useAddBillStore((state) => state.pendingFocusBill);
    const ledgerRef = useRef<LedgerRef>(null);
    const isDailySummary = selectedDate !== undefined;

    const visibleBills = useMemo(() => {
        if (selectedCreatorId === undefined) {
            return bills;
        }
        return bills.filter(
            (bill) => `${bill.creatorId}` === `${selectedCreatorId}`,
        );
    }, [bills, selectedCreatorId]);

    const displayedBills = useMemo(() => {
        if (!selectedMonth) {
            return visibleBills;
        }
        return filterOrderedBillListByTimeRange(visibleBills, [
            selectedMonth.startOf("month"),
            selectedMonth.endOf("month"),
        ]);
    }, [selectedMonth, visibleBills]);

    const summaryBills = useMemo(() => {
        if (!isDailySummary) {
            return displayedBills;
        }
        return filterOrderedBillListByTimeRange(displayedBills, [
            selectedDate.startOf("day"),
            selectedDate.endOf("day"),
        ]);
    }, [displayedBills, isDailySummary, selectedDate]);

    const summaryAmount = useMemo(() => {
        return sumBillAmount(summaryBills);
    }, [summaryBills]);
    const summaryLabel = selectedDate
        ? denseDate(selectedDate)
        : selectedMonth
          ? selectedMonth.format("YYYY-MM")
          : t("all");
    const monthPickerYearRange = useMemo(() => {
        const currentYear = dayjs().year();
        if (visibleBills.length === 0) {
            return [currentYear - 10, currentYear] as const;
        }
        const oldestYear = dayjs
            .unix(visibleBills[visibleBills.length - 1].time / 1000)
            .year();
        return [
            Math.min(oldestYear - 2, currentYear - 10),
            currentYear,
        ] as const;
    }, [visibleBills]);

    const { budgets: allBudgets } = useBudget();
    const budgets = allBudgets.filter((b) => {
        return b.joiners.includes(userId) && b.start < Date.now();
    });
    const budgetContainer = useRef<HTMLDivElement>(null);
    const { count: budgetCount, index: curBudgetIndex } = useSnap(
        budgetContainer,
        0,
    );

    const allLoaded = useRef(false);
    // 有预算时需要加载全部bills
    useLayoutEffect(() => {
        if (!allLoaded.current && budgets.length > 0) {
            useLedgerStore.getState().refreshBillList();
            allLoaded.current = true;
        }
    }, [budgets.length]);

    // 滚动时需要加载全部bills
    const onDateClick = useCallback(
        (date: dayjs.Dayjs) => {
            setSelectedDate(date);
            setVisibleDate(date);
            const index = displayedBills.findIndex((bill) => {
                const billDate = dayjs.unix(bill.time / 1000);
                return billDate.isSame(date, "day");
            });
            if (index >= 0) {
                ledgerRef.current?.scrollToIndex(index, "start");
            }
        },
        [displayedBills],
    );

    const onItemShow = useCallback((index: number) => {
        if (!allLoaded.current && index >= 120) {
            useLedgerStore.getState().refreshBillList();
            allLoaded.current = true;
        }
    }, []);

    const presence = useMemo(() => {
        if (ledgerAnimationShows) {
            return false;
        }
        return true;
    }, []);

    // safari capable
    useEffect(() => {
        ledgerAnimationShows = true;
    }, []);

    useEffect(() => {
        if (visibleBills.length === 0) {
            return;
        }
        const firstVisibleDate = dayjs.unix(visibleBills[0].time / 1000);
        const hasVisibleDateBills = visibleBills.some((bill) =>
            dayjs.unix(bill.time / 1000).isSame(visibleDate, "day"),
        );
        if (!hasVisibleDateBills) {
            setVisibleDate(firstVisibleDate);
        }
    }, [visibleDate, visibleBills]);

    useEffect(() => {
        if (
            !allLoaded.current &&
            (!selectedMonth || !selectedMonth.isSame(dayjs(), "month"))
        ) {
            useLedgerStore.getState().refreshBillList();
            allLoaded.current = true;
        }
    }, [selectedMonth]);

    useEffect(() => {
        if (!selectedDate) {
            return;
        }
        if (selectedMonth && !selectedDate.isSame(selectedMonth, "month")) {
            setSelectedDate(undefined);
            return;
        }
        const hasSelectedDateBills = displayedBills.some((bill) =>
            dayjs.unix(bill.time / 1000).isSame(selectedDate, "day"),
        );
        if (!hasSelectedDateBills) {
            setSelectedDate(undefined);
        }
    }, [displayedBills, selectedDate, selectedMonth]);

    useEffect(() => {
        if (!pendingFocusBill) {
            return;
        }

        if (!allLoaded.current) {
            void useLedgerStore.getState().refreshBillList();
            allLoaded.current = true;
        }

        setSelectedCreatorId(undefined);
        setSelectedMonth(undefined);
        setSelectedDate(undefined);

        const targetDate = dayjs(pendingFocusBill.time);
        setVisibleDate(targetDate);

        const index = visibleBills.findIndex(
            (bill) => bill.id === pendingFocusBill.id,
        );
        if (index < 0) {
            return;
        }

        ledgerRef.current?.scrollToIndex(index, "start");
        useAddBillStore.getState().clearPendingFocusBill();
    }, [pendingFocusBill, visibleBills]);

    return (
        <div className="w-full h-full p-2 flex flex-col overflow-hidden page-show">
            <div className="flex flex-wrap flex-col w-full gap-2">
                <div className="bg-stone-800 text-background dark:bg-foreground/20 dark:text-foreground relative h-20 w-full flex justify-end rounded-lg sm:flex-1 p-4">
                    <div className="absolute top-2 left-4 flex items-center gap-2">
                        <span className="leading-none">{summaryLabel}</span>
                        {isDailySummary && (
                            <button
                                type="button"
                                className="text-xs px-3 py-1 rounded-full bg-foreground/12 hover:bg-foreground/20 transition-colors leading-none"
                                onClick={() => {
                                    setSelectedDate(undefined);
                                }}
                            >
                                {selectedMonth
                                    ? t("back-to-month")
                                    : t("back-to-all")}
                            </button>
                        )}
                    </div>
                    <AnimatedNumber
                        value={summaryAmount}
                        className="font-bold text-4xl "
                    />
                    {currentBook && (
                        <button
                            type="button"
                            className="absolute bottom-2 left-4 text-xs opacity-60 flex items-center gap-1 cursor-pointer"
                            onClick={() => {
                                showBookGuide();
                            }}
                        >
                            <i className="icon-[mdi--book]"></i>
                            {currentBook.name}
                        </button>
                    )}
                </div>
                <div className="w-full flex items-center gap-2 overflow-x-auto scrollbar-hidden">
                    <button
                        type="button"
                        className={cn(
                            homeFilterChipClassName,
                            selectedMonth === undefined
                                ? homeFilterChipActiveClassName
                                : homeFilterChipInactiveClassName,
                        )}
                        onClick={() => {
                            setSelectedMonth(undefined);
                            setSelectedDate(undefined);
                        }}
                    >
                        {t("all")}
                    </button>
                    <button
                        type="button"
                        className={cn(
                            homeFilterChipClassName,
                            selectedMonth?.isSame(dayjs(), "month")
                                ? homeFilterChipActiveClassName
                                : homeFilterChipInactiveClassName,
                        )}
                        onClick={() => {
                            setSelectedMonth((prev) =>
                                prev?.isSame(dayjs(), "month")
                                    ? undefined
                                    : dayjs().startOf("month"),
                            );
                            setSelectedDate(undefined);
                        }}
                    >
                        {t("this-month")}
                    </button>
                    <button
                        type="button"
                        className={cn(
                            homeFilterChipClassName,
                            selectedMonth?.isSame(
                                dayjs().subtract(1, "month"),
                                "month",
                            )
                                ? homeFilterChipActiveClassName
                                : homeFilterChipInactiveClassName,
                        )}
                        onClick={() => {
                            setSelectedMonth((prev) =>
                                prev?.isSame(
                                    dayjs().subtract(1, "month"),
                                    "month",
                                )
                                    ? undefined
                                    : dayjs()
                                          .subtract(1, "month")
                                          .startOf("month"),
                            );
                            setSelectedDate(undefined);
                        }}
                    >
                        {t("last-month")}
                    </button>
                    <MonthPicker
                        value={selectedMonth}
                        yearRange={monthPickerYearRange}
                        onChange={(nextMonth) => {
                            setSelectedMonth(nextMonth);
                            setSelectedDate(undefined);
                        }}
                    />
                </div>
                <CreatorFilterBar
                    value={selectedCreatorId}
                    onValueChange={setSelectedCreatorId}
                />
                <CardSection>
                    <WidgetRail />
                    <PromotionCard />
                    <BudgetCardWrapper
                        budgets={budgets}
                        containerRef={budgetContainer}
                    />
                </CardSection>
            </div>
            <div className="flex justify-between items-center pl-7 pr-5 py-1 h-8">
                <button
                    className="cursor-pointer flex items-center"
                    type="button"
                    onClick={() => {
                        if (loading) {
                            return;
                        }
                        useLedgerStore.getState().initCurrentBook();
                    }}
                >
                    <div className={cn("opacity-0", loading && "opacity-100")}>
                        <Loading className="[&_i]:size-[18px]" />
                    </div>
                </button>
                <div>
                    {budgetCount > 1 && (
                        <PaginationIndicator
                            count={budgetCount}
                            current={curBudgetIndex}
                        />
                    )}
                </div>
                <HintTooltip
                    persistKey={"cloudSyncHintShows"}
                    content={"等待云同步完成后，其他设备即可获取最新的账单数据"}
                >
                    <button
                        type="button"
                        className="cursor-pointer flex items-center"
                        onClick={() => {
                            StorageAPI.toSync();
                        }}
                    >
                        {sync === "syncing" ? (
                            <CloudLoopIcon width={18} height={18} />
                        ) : (
                            <i
                                className={cn(syncIconClassName, "size-[18px]")}
                            ></i>
                        )}
                    </button>
                </HintTooltip>
            </div>
            <div className="flex-1 translate-0 pb-[10px] overflow-hidden">
                <div className="w-full h-full">
                    {displayedBills.length > 0 ? (
                        <Ledger
                            ref={ledgerRef}
                            bills={displayedBills}
                            className={cn(
                                displayedBills.length > 0 && "relative",
                            )}
                            enableDivideAsOrdered
                            showTime
                            onItemShow={onItemShow}
                            onVisibleDateChange={setVisibleDate}
                            onDateClick={onDateClick}
                            presence={presence}
                            showAssets={showAssets}
                        />
                    ) : (
                        <div className="text-xs p-4 text-center">
                            {t("nothing-here-add-one-bill")}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
