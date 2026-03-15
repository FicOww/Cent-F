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
import { useBudget } from "@/hooks/use-budget";
import { useSnap } from "@/hooks/use-snap";
import { amountToNumber } from "@/ledger/bill";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { usePreferenceStore } from "@/store/preference";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";
import { filterOrderedBillListByTimeRange } from "@/utils/filter";
import { denseDate } from "@/utils/time";

let ledgerAnimationShows = false;

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

    const [currentDate, setCurrentDate] = useState(dayjs());
    const [selectedCreatorId, setSelectedCreatorId] = useState<
        string | number | undefined
    >();
    const ledgerRef = useRef<any>(null);

    const visibleBills = useMemo(() => {
        if (selectedCreatorId === undefined) {
            return bills;
        }
        return bills.filter(
            (bill) => `${bill.creatorId}` === `${selectedCreatorId}`,
        );
    }, [bills, selectedCreatorId]);

    const currentDateBills = useMemo(() => {
        const today = filterOrderedBillListByTimeRange(visibleBills, [
            currentDate.startOf("day"),
            currentDate.endOf("day"),
        ]);
        return today;
    }, [visibleBills, currentDate]);

    const currentDateAmount = useMemo(() => {
        return amountToNumber(
            currentDateBills.reduce((p, c) => {
                return p + c.amount * (c.type === "income" ? 1 : -1);
            }, 0),
        );
    }, [currentDateBills]);

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
            setCurrentDate(date);
            const index = visibleBills.findIndex((bill) => {
                const billDate = dayjs.unix(bill.time / 1000);
                return billDate.isSame(date, "day");
            });
            if (index >= 0) {
                ledgerRef.current?.scrollToIndex(index);
            }
        },
        [visibleBills],
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
        const hasCurrentDateBills = visibleBills.some((bill) =>
            dayjs.unix(bill.time / 1000).isSame(currentDate, "day"),
        );
        if (!hasCurrentDateBills) {
            setCurrentDate(dayjs.unix(visibleBills[0].time / 1000));
        }
    }, [currentDate, visibleBills]);

    return (
        <div className="w-full h-full p-2 flex flex-col overflow-hidden page-show">
            <div className="flex flex-wrap flex-col w-full gap-2">
                <div className="bg-stone-800 text-background dark:bg-foreground/20 dark:text-foreground relative h-20 w-full flex justify-end rounded-lg sm:flex-1 p-4">
                    <span className="absolute top-2 left-4">
                        {denseDate(currentDate)}
                    </span>
                    <AnimatedNumber
                        value={currentDateAmount}
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
                    {visibleBills.length > 0 ? (
                        <Ledger
                            ref={ledgerRef}
                            bills={visibleBills}
                            className={cn(visibleBills.length > 0 && "relative")}
                            enableDivideAsOrdered
                            showTime
                            onItemShow={onItemShow}
                            onVisibleDateChange={setCurrentDate}
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
