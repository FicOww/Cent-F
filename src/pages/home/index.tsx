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
import BudgetCard from "@/components/budget/card";
import { HintTooltip } from "@/components/hint";
import { PaginationIndicator } from "@/components/indicator";
import CreatorFilterBar from "@/components/ledger/creator-filter-bar";
import Ledger from "@/components/ledger";
import Loading from "@/components/loading";
import { Promotion } from "@/components/promotion";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useBudget } from "@/hooks/use-budget";
import { useSnap } from "@/hooks/use-snap";
import { amountToNumber } from "@/ledger/bill";
import type { Bill } from "@/ledger/type";
import { useIntl } from "@/locale";
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
    const [selectedMonth, setSelectedMonth] = useState(() =>
        dayjs().startOf("month"),
    );
    const [selectedCreatorId, setSelectedCreatorId] = useState<
        string | number | undefined
    >();
    const ledgerRef = useRef<any>(null);
    const summaryDate = selectedDate ?? selectedMonth;
    const isDailySummary = selectedDate !== undefined;

    const visibleBills = useMemo(() => {
        if (selectedCreatorId === undefined) {
            return bills;
        }
        return bills.filter(
            (bill) => `${bill.creatorId}` === `${selectedCreatorId}`,
        );
    }, [bills, selectedCreatorId]);

    const monthBills = useMemo(() => {
        return filterOrderedBillListByTimeRange(visibleBills, [
            selectedMonth.startOf("month"),
            selectedMonth.endOf("month"),
        ]);
    }, [selectedMonth, visibleBills]);

    const summaryBills = useMemo(() => {
        if (!isDailySummary) {
            return monthBills;
        }
        return filterOrderedBillListByTimeRange(monthBills, [
            summaryDate.startOf("day"),
            summaryDate.endOf("day"),
        ]);
    }, [isDailySummary, monthBills, summaryDate]);

    const summaryAmount = useMemo(() => {
        return sumBillAmount(summaryBills);
    }, [summaryBills]);
    const monthPickerYearRange = useMemo(() => {
        const currentYear = dayjs().year();
        if (visibleBills.length === 0) {
            return [currentYear - 10, currentYear] as const;
        }
        const newestYear = dayjs.unix(visibleBills[0].time / 1000).year();
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
            const index = monthBills.findIndex((bill) => {
                const billDate = dayjs.unix(bill.time / 1000);
                return billDate.isSame(date, "day");
            });
            if (index >= 0) {
                ledgerRef.current?.scrollToIndex(index);
            }
        },
        [monthBills],
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
        if (!allLoaded.current && !selectedMonth.isSame(dayjs(), "month")) {
            useLedgerStore.getState().refreshBillList();
            allLoaded.current = true;
        }
    }, [selectedMonth]);

    useEffect(() => {
        if (!selectedDate) {
            return;
        }
        if (!selectedDate.isSame(selectedMonth, "month")) {
            setSelectedDate(undefined);
            return;
        }
        const hasSelectedDateBills = monthBills.some((bill) =>
            dayjs.unix(bill.time / 1000).isSame(selectedDate, "day"),
        );
        if (!hasSelectedDateBills) {
            setSelectedDate(undefined);
        }
    }, [monthBills, selectedDate, selectedMonth]);

    return (
        <div className="w-full h-full p-2 flex flex-col overflow-hidden page-show">
            <div className="flex flex-wrap flex-col w-full gap-2">
                <div className="bg-stone-800 text-background dark:bg-foreground/20 dark:text-foreground relative h-20 w-full flex justify-end rounded-lg sm:flex-1 p-4">
                    <div className="absolute top-2 left-4 flex items-center gap-2">
                        <span className="leading-none">
                            {isDailySummary
                                ? denseDate(summaryDate)
                                : summaryDate.format("YYYY-MM")}
                        </span>
                        {isDailySummary && (
                            <button
                                type="button"
                                className="text-xs px-3 py-1 rounded-full bg-foreground/12 hover:bg-foreground/20 transition-colors leading-none"
                                onClick={() => {
                                    setSelectedDate(undefined);
                                }}
                            >
                                {t("back-to-month")}
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
                            selectedMonth.isSame(dayjs(), "month")
                                ? homeFilterChipActiveClassName
                                : homeFilterChipInactiveClassName,
                        )}
                        onClick={() => {
                            setSelectedMonth(dayjs().startOf("month"));
                            setSelectedDate(undefined);
                        }}
                    >
                        {t("this-month")}
                    </button>
                    <button
                        type="button"
                        className={cn(
                            homeFilterChipClassName,
                            selectedMonth.isSame(
                                dayjs().subtract(1, "month"),
                                "month",
                            )
                                ? homeFilterChipActiveClassName
                                : homeFilterChipInactiveClassName,
                        )}
                        onClick={() => {
                            setSelectedMonth(
                                dayjs().subtract(1, "month").startOf("month"),
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
                <Promotion />
                <div className="w-full flex flex-col gap-1">
                    <div
                        ref={budgetContainer}
                        className="w-full flex overflow-x-auto gap-2 scrollbar-hidden snap-mandatory snap-x"
                    >
                        {budgets.map((budget) => {
                            return (
                                <BudgetCard
                                    className="flex-shrink-0 snap-start"
                                    key={budget.id}
                                    budget={budget}
                                />
                            );
                        })}
                    </div>
                </div>
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
                    {monthBills.length > 0 ? (
                        <Ledger
                            ref={ledgerRef}
                            bills={monthBills}
                            className={cn(monthBills.length > 0 && "relative")}
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

function MonthPicker({
    value,
    yearRange,
    onChange,
}: {
    value: dayjs.Dayjs;
    yearRange: readonly [number, number];
    onChange: (value: dayjs.Dayjs) => void;
}) {
    const [open, setOpen] = useState(false);
    const [displayYear, setDisplayYear] = useState(value.year());
    const [selectingYear, setSelectingYear] = useState(false);
    const [minYear, maxYear] = yearRange;
    const yearPageStart = useMemo(() => {
        return Math.floor((displayYear - minYear) / 12) * 12 + minYear;
    }, [displayYear, minYear]);

    useEffect(() => {
        setDisplayYear(value.year());
    }, [value]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        homeFilterChipClassName,
                        homeFilterChipInactiveClassName,
                        "flex-shrink-0 text-sm font-normal",
                    )}
                >
                    <i className="icon-[mdi--calendar-month-outline] size-4 text-foreground/80"></i>
                    {value.format("YYYY-MM")}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="w-[272px] rounded-2xl border-border/70 bg-background/95 p-3 backdrop-blur"
            >
                <div className="flex items-center justify-between gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        className="size-8 rounded-full border-border bg-background text-foreground/70 hover:bg-accent hover:text-accent-foreground"
                        disabled={
                            selectingYear
                                ? yearPageStart <= minYear
                                : displayYear <= minYear
                        }
                        onClick={() => {
                            if (selectingYear) {
                                setDisplayYear((prev) =>
                                    Math.max(minYear, prev - 12),
                                );
                                return;
                            }
                            setDisplayYear((prev) => Math.max(minYear, prev - 1));
                        }}
                    >
                        <i className="icon-[mdi--chevron-left] size-4"></i>
                    </Button>
                    <button
                        type="button"
                        className="text-sm font-medium tabular-nums px-3 py-1 rounded-full hover:bg-accent transition-colors"
                        onClick={() => {
                            setSelectingYear((prev) => !prev);
                        }}
                    >
                        {selectingYear
                            ? `${yearPageStart}-${Math.min(yearPageStart + 11, maxYear)}`
                            : displayYear}
                    </button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="size-8 rounded-full border-border bg-background text-foreground/70 hover:bg-accent hover:text-accent-foreground"
                        disabled={
                            selectingYear
                                ? yearPageStart + 11 >= maxYear
                                : displayYear >= maxYear
                        }
                        onClick={() => {
                            if (selectingYear) {
                                setDisplayYear((prev) =>
                                    Math.min(maxYear, prev + 12),
                                );
                                return;
                            }
                            setDisplayYear((prev) => Math.min(maxYear, prev + 1));
                        }}
                    >
                        <i className="icon-[mdi--chevron-right] size-4"></i>
                    </Button>
                </div>
                {selectingYear ? (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                        {Array.from({ length: 12 }, (_, index) => {
                            const year = yearPageStart + index;
                            if (year > maxYear) {
                                return null;
                            }
                            const checked = year === value.year();
                            return (
                                <button
                                    key={year}
                                    type="button"
                                    className={cn(
                                    "h-10 rounded-xl border text-sm transition-colors tabular-nums",
                                        checked
                                            ? "border-stone-900 bg-stone-900 !text-white dark:bg-stone-100 dark:!text-stone-900 dark:border-stone-100"
                                            : "border-border text-foreground/80 hover:bg-accent hover:text-accent-foreground",
                                    )}
                                    onClick={() => {
                                        setDisplayYear(year);
                                        setSelectingYear(false);
                                    }}
                                >
                                    {year}
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mt-3 grid grid-cols-4 gap-2">
                        {Array.from({ length: 12 }, (_, index) => {
                            const monthValue = dayjs()
                                .year(displayYear)
                                .month(index)
                                .startOf("month");
                            const checked = monthValue.isSame(value, "month");
                            return (
                                <button
                                    key={`${displayYear}-${index + 1}`}
                                    type="button"
                                    className={cn(
                                    "h-10 rounded-xl border text-sm transition-colors",
                                        checked
                                            ? "border-stone-900 bg-stone-900 !text-white dark:bg-stone-100 dark:!text-stone-900 dark:border-stone-100"
                                            : "border-border text-foreground/80 hover:bg-accent hover:text-accent-foreground",
                                    )}
                                    onClick={() => {
                                        onChange(monthValue);
                                        setOpen(false);
                                    }}
                                >
                                    {String(index + 1).padStart(2, "0")}
                                </button>
                            );
                        })}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
