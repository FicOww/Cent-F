import dayjs from "dayjs";
import { Switch } from "radix-ui";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useShallow } from "zustand/shallow";
import { StorageDeferredAPI } from "@/api/storage";
import type { AnalysisResult } from "@/api/storage/analysis";
import { Assistant } from "@/components/assistant";
import {
    BillFilterViewProvider,
    showBillFilterView,
} from "@/components/bill-filter";
import { showBillInfo } from "@/components/bill-info";
import BillItem from "@/components/ledger/item";
import { showSortableList } from "@/components/sortable";
import { AnalysisCloud } from "@/components/stat/analysic-cloud";
import { AnalysisDetail } from "@/components/stat/analysis-detail";
import AnalysisMap from "@/components/stat/analysis-map";
import { useChartPart } from "@/components/stat/chart-part";
import {
    buildDateSlices,
    DateSliced,
    type DateSliceState,
    getDefaultSliceId,
    getViewTypeFromSliceId,
    hasSliceId,
    resolveSliceRange,
} from "@/components/stat/date-slice";
import {
    type FocusType,
    FocusTypeSelector,
    FocusTypes,
} from "@/components/stat/focus-type";
import SettlementPanel from "@/components/stat/settlement-panel";
import { TagItem } from "@/components/stat/static-item";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/hooks/use-currency";
import {
    DefaultFilterViewId,
    useCustomFilters,
} from "@/hooks/use-custom-filters";
import { useTag } from "@/hooks/use-tag";
import type { BillFilter, BillFilterView } from "@/ledger/extra-type";
import type { Bill } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { getStatDateState, setStatDateState } from "@/store/preference";
import { cn } from "@/utils";

type StatDimension = "category" | "user";

function getStatPath(filterViewId: string) {
    return filterViewId === DefaultFilterViewId
        ? "/stat"
        : `/stat/${filterViewId}`;
}

function getDefaultCustomRange(range: [number, number]) {
    const startOfMonth = dayjs(range[1]).startOf("month").valueOf();
    return [Math.max(range[0], startOfMonth), range[1]] as [number, number];
}

function normalizeCustomRange(
    range?: [number | undefined, number | undefined],
) {
    if (!range) {
        return range;
    }
    const [start, end] = range;
    return [
        start === undefined ? undefined : dayjs(start).startOf("day").valueOf(),
        end === undefined ? undefined : dayjs(end).endOf("day").valueOf(),
    ] as [number | undefined, number | undefined];
}

function normalizeDateState(
    state: DateSliceState | undefined,
    viewSlices: ReturnType<typeof buildDateSlices>,
    fullRange: [number, number],
): DateSliceState {
    if (!state) {
        return {
            sliceId: getDefaultSliceId(viewSlices),
            customRange: normalizeCustomRange(getDefaultCustomRange(fullRange)),
        };
    }
    if (!state?.sliceId) {
        return {
            sliceId: undefined,
            customRange: normalizeCustomRange(
                state?.customRange ?? getDefaultCustomRange(fullRange),
            ),
        };
    }
    if (hasSliceId(state.sliceId, viewSlices)) {
        return {
            ...state,
            customRange: normalizeCustomRange(state.customRange),
        };
    }
    return {
        sliceId: getDefaultSliceId(viewSlices),
        customRange: normalizeCustomRange(state.customRange),
    };
}

function getDateStateFromQuery(
    searchParams: URLSearchParams,
    viewSlices: ReturnType<typeof buildDateSlices>,
    fullRange: [number, number],
    fallback: DateSliceState | undefined,
) {
    const view = searchParams.get("view");
    if (view === "custom") {
        const start = searchParams.get("start");
        const end = searchParams.get("end");
        return normalizeDateState(
            {
                sliceId: undefined,
                customRange:
                    start && end
                        ? normalizeCustomRange([Number(start), Number(end)])
                        : fallback?.customRange,
            },
            viewSlices,
            fullRange,
        );
    }
    if (view) {
        const slice = searchParams.get("slice");
        if (slice) {
            return normalizeDateState(
                {
                    sliceId: `${view}|${slice}`,
                    customRange: fallback?.customRange,
                },
                viewSlices,
                fullRange,
            );
        }
    }
    return normalizeDateState(fallback, viewSlices, fullRange);
}

function buildStatSearchParams({
    dateState,
    focusType,
    dimension,
}: {
    dateState: DateSliceState;
    focusType: FocusType;
    dimension: StatDimension;
}) {
    const params = new URLSearchParams();
    const viewType = getViewTypeFromSliceId(dateState.sliceId);
    params.set("view", viewType);
    if (dateState.sliceId && viewType !== "custom") {
        params.set("slice", dateState.sliceId.split("|")[1] ?? "");
    } else {
        if (dateState.customRange?.[0]) {
            params.set("start", String(dateState.customRange[0]));
        }
        if (dateState.customRange?.[1]) {
            params.set("end", String(dateState.customRange[1]));
        }
    }
    params.set("focus", focusType);
    params.set("dimension", dimension);
    return params.toString();
}

export default function Page() {
    const t = useIntl();
    const { id } = useParams();
    const [searchParams] = useSearchParams();

    const { bills } = useLedgerStore();
    const endTime = useMemo(() => Date.now(), []); //bills[0]?.time ?? dayjs();
    const startTime = bills[bills.length - 1]?.time ?? dayjs();

    const customFilters = useLedgerStore(
        useShallow((state) => state.infos?.meta.customFilters),
    );

    const allFilterViews = useMemo(() => {
        if (customFilters?.some((f) => f.id === DefaultFilterViewId)) {
            return customFilters;
        }
        return [
            {
                id: DefaultFilterViewId,
                filter: {},
                name: t("default-filter-name"),
            } as BillFilterView,
            ...(customFilters ?? []),
        ];
    }, [t, customFilters]);

    const filterViewId =
        allFilterViews.find((v) => v.id === id)?.id ?? allFilterViews[0].id;
    const selectedFilterView = allFilterViews.find(
        (v) => v.id === filterViewId,
    );
    const selectedFilter = selectedFilterView?.filter;

    const fullRange = [
        selectedFilter?.start ?? startTime,
        selectedFilter?.end ?? endTime,
    ] as [number, number];

    const viewSlices = useMemo(
        () => buildDateSlices(fullRange, t),
        [fullRange, t],
    );
    const cachedDateState = useMemo(
        () => getStatDateState(filterViewId),
        [filterViewId],
    );
    const dateState = useMemo(
        () =>
            getDateStateFromQuery(
                searchParams,
                viewSlices,
                fullRange,
                cachedDateState,
            ),
        [cachedDateState, fullRange, searchParams, viewSlices],
    );
    const sliceRange = useMemo(
        () => resolveSliceRange(dateState, viewSlices),
        [dateState, viewSlices],
    );
    const viewType = getViewTypeFromSliceId(dateState.sliceId);
    const realRange = useMemo(
        () => [
            sliceRange?.[0] ?? selectedFilter?.start ?? startTime,
            sliceRange?.[1] ?? selectedFilter?.end ?? endTime,
        ],
        [
            sliceRange,
            selectedFilter?.start,
            selectedFilter?.end,
            startTime,
            endTime,
        ],
    );

    const navigate = useNavigate();
    const focusType = (searchParams.get("focus") ?? "expense") as FocusType;
    const dimension = (searchParams.get("dimension") ??
        "category") as StatDimension;
    const updateStatRoute = ({
        nextFilterViewId = filterViewId,
        nextDateState = dateState,
        nextFocusType = focusType,
        nextDimension = dimension,
        replace = false,
    }: {
        nextFilterViewId?: string;
        nextDateState?: DateSliceState;
        nextFocusType?: FocusType;
        nextDimension?: StatDimension;
        replace?: boolean;
    }) => {
        navigate(
            `${getStatPath(nextFilterViewId)}?${buildStatSearchParams({
                dateState: nextDateState,
                focusType: nextFocusType,
                dimension: nextDimension,
            })}`,
            { replace },
        );
    };

    useEffect(() => {
        setStatDateState(filterViewId, dateState);
    }, [dateState, filterViewId]);

    useEffect(() => {
        const nextSearch = buildStatSearchParams({
            dateState,
            focusType,
            dimension,
        });
        if (searchParams.toString() === nextSearch) {
            return;
        }
        navigate(`${getStatPath(filterViewId)}?${nextSearch}`, {
            replace: true,
        });
    }, [dateState, dimension, filterViewId, focusType, navigate, searchParams]);

    const seeDetails = (append?: Partial<BillFilter>) => {
        navigate("/search", {
            state: {
                filter: {
                    ...selectedFilter,
                    start: realRange[0],
                    end: realRange[1],
                    ...append,
                },
                returnTo: {
                    pathname: getStatPath(filterViewId),
                    search: `?${buildStatSearchParams({
                        dateState,
                        focusType,
                        dimension,
                    })}`,
                },
            },
        });
    };

    const [filtered, setFiltered] = useState<Bill[]>([]);

    useEffect(() => {
        const book = useBookStore.getState().currentBookId;
        if (!book) {
            return;
        }
        if (!selectedFilter) {
            return;
        }
        StorageDeferredAPI.filter(book, {
            ...selectedFilter,
            start: realRange[0],
            end: realRange[1],
        }).then((result) => {
            setFiltered(result);
        });
    }, [selectedFilter, realRange[0], realRange[1]]);

    const { dataSources, Part, setSelectedCategoryId } = useChartPart({
        viewType,
        seeDetails,
        focusType,
        filtered,
        dimension,
        displayCurrency: selectedFilterView?.displayCurrency,
    });

    const totalMoneys = FocusTypes.map((t) => dataSources.total[t]);

    const { tags } = useTag();
    const tagStructure = useMemo(
        () =>
            Array.from(dataSources.tagStructure.entries())
                .map(([tagId, struct]) => {
                    const tag = tags.find((t) => t.id === tagId);
                    if (!tag) {
                        return undefined;
                    }
                    return {
                        ...tag,
                        ...struct,
                    };
                })
                .filter((v) => v !== undefined),
        [dataSources.tagStructure, tags],
    );

    const { incomes: filteredIncomeBills, expenses: filteredExpenseBills } =
        useMemo(() => {
            const incomes: Bill[] = [];
            const expenses: Bill[] = [];
            filtered.forEach((v) => {
                if (v.type === "expense") {
                    expenses.push(v);
                } else {
                    incomes.push(v);
                }
            });
            return {
                incomes,
                expenses,
            };
        }, [filtered]);
    const [analysis, setAnalysis] = useState<AnalysisResult>();
    const analysisUnit =
        viewType === "yearly"
            ? "year"
            : viewType === "monthly"
              ? "month"
              : viewType === "weekly"
                ? "week"
                : "day";
    useEffect(() => {
        const book = useBookStore.getState().currentBookId;
        if (!book || !realRange[0] || !realRange[1]) {
            setAnalysis(undefined);
            return;
        }
        if (!analysisUnit) {
            setAnalysis(undefined);
            return;
        }
        StorageDeferredAPI.analysis(
            book,
            [realRange[0], realRange[1]],
            analysisUnit,
            focusType,
        ).then((v) => {
            setAnalysis(v);
        });
    }, [analysisUnit, focusType, realRange[0], realRange[1]]);

    const { updateFilter, addFilter } = useCustomFilters();
    const toChangeFilter = async () => {
        if (!selectedFilterView) {
            return;
        }
        const id = selectedFilterView.id;
        const action = await showBillFilterView({
            ...selectedFilterView,
            // hideDelete: id === DefaultFilterViewId,
        });
        if (action === "delete") {
            await updateFilter(id);
            updateStatRoute({
                nextFilterViewId: allFilterViews[0].id,
                nextDateState: normalizeDateState(
                    getStatDateState(allFilterViews[0].id),
                    buildDateSlices(
                        [
                            allFilterViews[0].filter?.start ?? startTime,
                            allFilterViews[0].filter?.end ?? endTime,
                        ],
                        t,
                    ),
                    [
                        allFilterViews[0].filter?.start ?? startTime,
                        allFilterViews[0].filter?.end ?? endTime,
                    ],
                ),
            });
            return;
        }
        await updateFilter(id, {
            ...action,
            name: action.name ?? selectedFilterView.name,
        });
    };
    const toReOrder = async () => {
        if ((customFilters?.length ?? 0) === 0) {
            return;
        }
        const ordered = await showSortableList(customFilters);
        useLedgerStore.getState().updateGlobalMeta((prev) => {
            prev.customFilters = ordered
                .map((v) => prev.customFilters?.find((c) => c.id === v.id))
                .filter((v) => v !== undefined);
            return prev;
        });
    };
    const toAddFilter = async () => {
        const newFilter = await showBillFilterView({
            name: t("new-filter-name"),
            filter: {},
            hideDelete: true,
        });
        if (newFilter === "delete" || !newFilter.name) {
            return;
        }
        const id = await addFilter(newFilter.name, newFilter);
        if (!id) {
            return;
        }
        const nextFullRange = [startTime, endTime] as [number, number];
        const nextViewSlices = buildDateSlices(nextFullRange, t);
        updateStatRoute({
            nextFilterViewId: id,
            nextDateState: normalizeDateState(
                getStatDateState(id),
                nextViewSlices,
                nextFullRange,
            ),
        });
    };

    const { allCurrencies, baseCurrency } = useCurrency();

    const envArg = useMemo(
        () => ({
            filterView: selectedFilterView,
            focusType,
            viewType,
            range: realRange,
        }),
        [selectedFilterView, focusType, viewType, realRange],
    );
    return (
        <div className="w-full h-full p-2 flex flex-col items-center justify-center gap-4 overflow-hidden page-show">
            <div className="w-full mx-2 max-w-[600px] flex flex-col gap-2">
                <div className="w-full flex flex-col gap-2">
                    <div className="w-full flex">
                        <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-hidden">
                            {allFilterViews.map((filter) => {
                                const displayCurrency =
                                    filter.displayCurrency === baseCurrency.id
                                        ? undefined
                                        : allCurrencies.find(
                                              (v) =>
                                                  v.id ===
                                                  filter.displayCurrency,
                                          );
                                return (
                                    <Button
                                        key={filter.id}
                                        size={"sm"}
                                        className={cn(
                                            filterViewId !== filter.id
                                                ? "text-primary/50"
                                                : "relative after:absolute after:bottom-[2px] after:left-3 after:w-[calc(100%-24px)] after:h-[2px] after:rounded-full after:bg-primary/20",
                                        )}
                                        variant="ghost"
                                        onClick={() => {
                                            const nextFullRange = [
                                                filter.filter?.start ??
                                                    startTime,
                                                filter.filter?.end ?? endTime,
                                            ] as [number, number];
                                            const nextViewSlices =
                                                buildDateSlices(
                                                    nextFullRange,
                                                    t,
                                                );
                                            updateStatRoute({
                                                nextFilterViewId: filter.id,
                                                nextDateState:
                                                    normalizeDateState(
                                                        getStatDateState(
                                                            filter.id,
                                                        ),
                                                        nextViewSlices,
                                                        nextFullRange,
                                                    ),
                                            });
                                        }}
                                    >
                                        {displayCurrency?.symbol}
                                        {filter.name}
                                    </Button>
                                );
                            })}
                        </div>
                        <div className="">
                            <Button
                                variant="ghost"
                                onClick={toAddFilter}
                                size="sm"
                            >
                                <i className="icon-[mdi--plus] size-4"></i>
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={toReOrder}
                                size="sm"
                            >
                                <i className="icon-[mdi--menu] size-4"></i>
                            </Button>
                        </div>
                    </div>
                </div>
                <DateSliced
                    viewSlices={viewSlices}
                    value={dateState.sliceId}
                    custom={dateState.customRange}
                    onValueChange={(value) => {
                        updateStatRoute({
                            nextDateState: normalizeDateState(
                                {
                                    sliceId: value,
                                    customRange:
                                        dateState.customRange ??
                                        getDefaultCustomRange(fullRange),
                                },
                                viewSlices,
                                fullRange,
                            ),
                        });
                    }}
                    onCustomValueChange={(value) => {
                        updateStatRoute({
                            nextDateState: {
                                sliceId: undefined,
                                customRange: value,
                            },
                        });
                    }}
                    onClickSettings={toChangeFilter}
                >
                    <div className="flex items-center pr-2 relative">
                        <Switch.Root
                            checked={dimension === "user"}
                            onCheckedChange={() => {
                                updateStatRoute({
                                    nextDimension:
                                        dimension === "category"
                                            ? "user"
                                            : "category",
                                });
                            }}
                            className="relative z-[0] h-[29px] w-[54px] cursor-pointer rounded-sm bg-blackA6 outline-none bg-stone-300 group"
                        >
                            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center gap-2 z-[1]">
                                <i className="icon-[mdi--view-grid-outline] group-[data-[state=checked]]:text-white"></i>
                                <i className="icon-[mdi--account-outline]"></i>
                            </div>
                            <Switch.Thumb className="block size-[22px] translate-x-[4px] rounded-sm bg-background transition-transform duration-100 will-change-transform data-[state=checked]:translate-x-[28px]" />
                        </Switch.Root>
                    </div>
                </DateSliced>
            </div>
            <FocusTypeSelector
                value={focusType}
                onValueChange={(v) => {
                    updateStatRoute({
                        nextFocusType: v,
                    });
                    setSelectedCategoryId(undefined);
                }}
                money={totalMoneys}
            />
            <div className="w-full px-2 flex-1 flex justify-center overflow-y-auto">
                <div className="w-full max-w-[600px] flex flex-col items-center gap-4 relative">
                    <Assistant env={envArg} />
                    {Part}
                    {tagStructure.length > 0 && (
                        <div className="rounded-md border p-2 w-full flex flex-col">
                            <h2 className="font-medium text-lg my-3 text-center">
                                {t("tag-details")}
                            </h2>
                            <div className="table w-full border-collapse">
                                <div className="table-row-group divide-y">
                                    {tagStructure.map((struct) => {
                                        const index =
                                            FocusTypes.indexOf(focusType);
                                        const money = [
                                            struct.income,
                                            struct.expense,
                                            struct.income - struct.expense,
                                        ][index];
                                        const total = totalMoneys[index];
                                        return (
                                            <TagItem
                                                key={struct.id}
                                                name={struct.name}
                                                money={money}
                                                total={total}
                                                type={focusType}
                                                onClick={() => {
                                                    seeDetails({
                                                        tags: [struct.id],
                                                    });
                                                }}
                                            ></TagItem>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                    <SettlementPanel
                        bills={filtered}
                        range={realRange as [number, number]}
                    />
                    <AnalysisCloud
                        bills={
                            focusType === "expense"
                                ? filteredExpenseBills
                                : focusType === "income"
                                  ? filteredIncomeBills
                                  : filtered
                        }
                    />
                    <AnalysisMap
                        bills={
                            focusType === "expense"
                                ? filteredExpenseBills
                                : focusType === "income"
                                  ? filteredIncomeBills
                                  : filtered
                        }
                    />
                    {analysis && (
                        <div className="rounded-md border p-2 w-full flex flex-col">
                            <h2 className="font-medium text-lg my-3 text-center">
                                {t("analysis")}
                            </h2>
                            <AnalysisDetail
                                analysis={analysis}
                                type={focusType}
                                unit={analysisUnit}
                            />
                        </div>
                    )}
                    <div className="w-full flex flex-col gap-4">
                        {dataSources.highestExpenseBill && (
                            <div className="rounded-md border p-2">
                                {t("highest-expense")}:
                                <BillItem
                                    className="w-full"
                                    bill={dataSources.highestExpenseBill}
                                    showTime
                                    onClick={() =>
                                        showBillInfo(
                                            dataSources.highestExpenseBill!,
                                        )
                                    }
                                />
                            </div>
                        )}
                        {dataSources.highestIncomeBill && (
                            <div className="rounded-md border p-2">
                                {t("highest-income")}:
                                <BillItem
                                    className="w-full"
                                    bill={dataSources.highestIncomeBill}
                                    showTime
                                    onClick={() =>
                                        showBillInfo(
                                            dataSources.highestIncomeBill!,
                                        )
                                    }
                                />
                            </div>
                        )}
                    </div>
                    <div>
                        <Button variant="ghost" onClick={() => seeDetails()}>
                            {t("see-all-ledgers")}
                            <i className="icon-[mdi--arrow-up-right]"></i>
                        </Button>
                    </div>
                    <div className="w-full h-20 flex-shrink-0"></div>
                </div>
            </div>
            <BillFilterViewProvider />
        </div>
    );
}
