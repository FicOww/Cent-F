import dayjs from "dayjs";
import { Switch } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useCategory from "@/hooks/use-category";
import { useCurrency } from "@/hooks/use-currency";
import { useTag } from "@/hooks/use-tag";
import { useWheelScrollX } from "@/hooks/use-wheel-scroll";
import PopupLayout from "@/layouts/popup-layout";
import { amountToNumber, numberToAmount } from "@/ledger/bill";
import { ExpenseBillCategories, IncomeBillCategories } from "@/ledger/category";
import { SETTLEMENT_GROUP_NAME } from "@/ledger/settlement";
import type { Bill } from "@/ledger/type";
import { categoriesGridClassName } from "@/ledger/utils";
import { useIntl } from "@/locale";
import { useAddBillStore } from "@/store/add-bill";
import { type EditBill, useLedgerStore } from "@/store/ledger";
import { usePreferenceStore } from "@/store/preference";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";
import { getPredictNow } from "@/utils/predict";
import { getEffectiveSettlementConfig } from "@/utils/tag-config";
import { relativeDenseDate } from "@/utils/time";
import { showTagList } from "../bill-tag";
import { showCategoryList } from "../category";
import { CategoryItem } from "../category/item";
import { DatePicker } from "../date-picker";
import Deletable from "../deletable";
import { FORMAT_IMAGE_SUPPORTED, showFilePicker } from "../file-picker";
import SmartImage from "../image";
import IOSUnscrolledInput from "../input";
import Calculator from "../keyboard";
import modal from "../modal";
import CurrentLocation from "../simple-location";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import { goAddBill } from ".";
import { RemarkHint } from "./remark";
import ResizeHandle from "./resize";
import {
    AttributionTagGroupSelector,
    default as TagGroupSelector,
} from "./tag-group";

const ADD_AGAIN_REOPEN_DELAY_MS = 450;

const defaultBill = {
    type: "expense" as Bill["type"],
    comment: "",
    amount: 0,
    categoryId: ExpenseBillCategories[0].id,
};

export default function EditorForm({
    edit,
    onCancel,
    onConfirm,
}: {
    edit?: EditBill;
    onConfirm?: (v: Omit<Bill, "id" | "creatorId">) => void;
    onCancel?: () => void;
}) {
    const t = useIntl();
    const goBack = () => {
        onCancel?.();
    };

    const { baseCurrency, convert, quickCurrencies, allCurrencies } =
        useCurrency();

    const { incomes, expenses, categories: allCategories } = useCategory();

    const isCreate = edit === undefined;
    const lastAddedTime = useAddBillStore((state) => state.lastAddedTime);

    const predictCategory = useMemo(() => {
        // 只有新增账单时才展示预测
        if (!isCreate) {
            return;
        }
        const predict = getPredictNow();
        const pc = predict?.category?.[0];
        if (!pc) {
            return;
        }
        const category = allCategories.find((v) => v.id === pc);
        return category;
    }, [isCreate, allCategories]);

    const predictComments = useMemo(() => {
        // 只有新增账单时才展示预测
        if (!isCreate) {
            return;
        }
        const predict = getPredictNow();
        const pc = predict?.comment;
        return pc;
    }, [isCreate]);

    const getMatchDefaultCategory = useCallback(
        (categoryId: string) => {
            const category = [...incomes, ...expenses].find(
                (item) => item.id === categoryId,
            );
            if (!category) {
                return categoryId;
            }
            const defaultSub = category.children.find(
                (item) => item.defaultSelect,
            );
            if (!defaultSub) {
                return categoryId;
            }
            return defaultSub.id;
        },
        [expenses, incomes],
    );

    const [billState, setBillState] = useState(() => {
        const init = {
            ...defaultBill,
            categoryId:
                edit?.categoryId ??
                getMatchDefaultCategory(
                    predictCategory?.id ?? defaultBill.categoryId,
                ),
            time: lastAddedTime ?? Date.now(),
            ...edit,
        };
        if (edit?.currency?.target === baseCurrency.id) {
            delete init.currency;
        }
        return init;
    });

    const handleParentCategoryClick = useCallback(
        (parentCategoryId: string) => {
            setBillState((prev) => {
                const parentCategory = [...incomes, ...expenses].find(
                    (item) => item.id === parentCategoryId,
                );
                const isPreviousChild = parentCategory?.children.some(
                    (item) => item.id === prev.categoryId,
                );
                if (isPreviousChild) {
                    return {
                        ...prev,
                        categoryId: parentCategoryId,
                    };
                }
                return {
                    ...prev,
                    categoryId: getMatchDefaultCategory(parentCategoryId),
                };
            });
        },
        [expenses, getMatchDefaultCategory, incomes],
    );

    const { grouped } = useTag();
    const userId = useUserStore((state) => state.id);
    const meta = useLedgerStore((state) => state.infos?.meta);

    const categories = billState.type === "expense" ? expenses : incomes;

    const subCategories = useMemo(() => {
        const selected = categories.find(
            (c) =>
                c.id === billState.categoryId ||
                c.children.some((s) => s.id === billState.categoryId),
        );
        if (selected?.children) {
            return selected.children;
        }
        return categories.find((c) => c.id === selected?.parent)?.children;
    }, [billState.categoryId, categories]);

    const settlementConfig = useMemo(
        () => getEffectiveSettlementConfig(meta, userId),
        [meta, userId],
    );

    const attributionGroup = useMemo(() => {
        if (!settlementConfig?.tagGroupId) {
            return undefined;
        }
        return grouped.find(
            (group) => group.id === settlementConfig.tagGroupId,
        );
    }, [grouped, settlementConfig?.tagGroupId]);

    const attributionTagIds = useMemo(() => {
        if (
            !settlementConfig?.homeTagId ||
            !settlementConfig?.memberATagId ||
            !settlementConfig?.memberBTagId ||
            !attributionGroup
        ) {
            return [];
        }

        const candidateIds = [
            settlementConfig.homeTagId,
            settlementConfig.memberATagId,
            settlementConfig.memberBTagId,
        ];

        return candidateIds.filter((tagId) =>
            attributionGroup.tags.some((tag) => tag.id === tagId),
        );
    }, [attributionGroup, settlementConfig]);

    const otherTagGroups = useMemo(() => {
        return grouped.filter((group) => group.id !== attributionGroup?.id);
    }, [attributionGroup?.id, grouped]);

    const applyTimeChange = useCallback(
        (time: number) => {
            setBillState((prev) => {
                if (!prev.currency) {
                    return {
                        ...prev,
                        time,
                    };
                }
                const { predict } = convert(
                    amountToNumber(prev.currency?.amount ?? prev.amount),
                    prev.currency.target,
                    baseCurrency.id,
                    time,
                );
                return {
                    ...prev,
                    time,
                    amount: numberToAmount(predict),
                    currency: {
                        base: baseCurrency.id,
                        target: prev.currency.target,
                        amount: prev.currency?.amount ?? prev.amount,
                    },
                };
            });
        },
        [baseCurrency.id, convert],
    );

    const toConfirm = useCallback(async () => {
        if (billState.type === "expense" && attributionTagIds.length === 3) {
            const selectedAttributionCount =
                billState.tagIds?.filter((tagId) =>
                    attributionTagIds.includes(tagId),
                ).length ?? 0;

            if (selectedAttributionCount !== 1) {
                await modal.prompt({
                    title: t("settlement-attribution-required-tip", {
                        groupName: SETTLEMENT_GROUP_NAME,
                    }),
                    cancellable: false,
                });
                return false;
            }
        }

        if (amountToNumber(billState.amount) === 0) {
            try {
                await modal.prompt({
                    title: t("bill-zero-amount-confirm"),
                });
            } catch {
                return false;
            }
        }

        onConfirm?.({
            ...billState,
        });
        return true;
    }, [attributionTagIds, billState, onConfirm, t]);

    const chooseImage = async () => {
        const [file] = await showFilePicker({ accept: FORMAT_IMAGE_SUPPORTED });
        setBillState((v) => {
            return { ...v, images: [...(v.images ?? []), file] };
        });
    };

    const locationRef = useRef<HTMLButtonElement>(null);
    const isAdd = useRef(!edit);
    useEffect(() => {
        if (
            !isAdd.current ||
            !usePreferenceStore.getState().autoLocateWhenAddBill
        ) {
            return;
        }
        locationRef.current?.click?.();
    }, []);

    const monitorRef = useRef<HTMLButtonElement>(null);
    const [monitorFocused, setMonitorFocused] = useState(false);
    useEffect(() => {
        monitorRef.current?.focus?.();
    }, []);

    useEffect(() => {
        if (monitorFocused) {
            const onPress = (event: KeyboardEvent) => {
                const key = event.key;
                if (key === "Enter") {
                    toConfirm();
                }
            };
            document.addEventListener("keypress", onPress);
            return () => {
                document.removeEventListener("keypress", onPress);
            };
        }
    }, [monitorFocused, toConfirm]);

    const targetCurrency =
        allCurrencies.find(
            (c) => c.id === (billState.currency?.target ?? baseCurrency.id),
        ) ?? baseCurrency;

    const changeCurrency = (newCurrencyId: string) =>
        setBillState((prev) => {
            if (newCurrencyId === baseCurrency.id) {
                return {
                    ...prev,
                    amount: prev.currency?.amount ?? prev.amount,
                    currency: undefined,
                };
            }
            const { predict } = convert(
                amountToNumber(prev.currency?.amount ?? prev.amount),
                newCurrencyId,
                baseCurrency.id,
                prev.time,
            );
            return {
                ...prev,
                amount: numberToAmount(predict),
                currency: {
                    base: baseCurrency.id,
                    target: newCurrencyId,
                    amount: prev.currency?.amount ?? prev.amount,
                },
            };
        });

    const calculatorInitialValue = billState?.currency
        ? amountToNumber(billState.currency.amount)
        : billState?.amount
          ? amountToNumber(billState?.amount)
          : 0;

    const multiplyKey = usePreferenceStore((v) => {
        if (!v.multiplyKey || v.multiplyKey === "off") {
            return undefined;
        }
        if (v.multiplyKey === "double-zero") {
            return "double-zero";
        }
        return "triple-zero";
    });

    const tagSelectorRef = useRef<HTMLDivElement>(null);
    useWheelScrollX(tagSelectorRef);

    return (
        <Calculator.Root
            multiplyKey={multiplyKey}
            initialValue={calculatorInitialValue}
            onValueChange={(n) => {
                setBillState((v) => {
                    if (v.currency) {
                        const { predict } = convert(
                            n,
                            v.currency.target,
                            v.currency.base,
                            v.time,
                        );
                        return {
                            ...v,
                            amount: numberToAmount(predict),
                            currency: {
                                ...v.currency,
                                amount: numberToAmount(n),
                            },
                        };
                    }
                    return {
                        ...v,
                        amount: numberToAmount(n),
                    };
                });
            }}
            input={monitorFocused}
        >
            <PopupLayout
                className="h-full gap-2 pb-0 overflow-y-auto scrollbar-hidden"
                onBack={goBack}
                title={
                    <div className="pl-[54px] w-full min-h-12 rounded-xl flex pt-2 pb-0 overflow-hidden scrollbar-hidden">
                        <div className="text-foreground">
                            <Switch.Root
                                className="w-24 h-12 relative rounded-xl p-1 flex justify-center items-center border border-border bg-card shadow-sm"
                                checked={billState.type === "income"}
                                onCheckedChange={() => {
                                    setBillState((v) => ({
                                        ...v,
                                        type:
                                            v.type === "expense"
                                                ? "income"
                                                : "expense",
                                        categoryId:
                                            v.type === "expense"
                                                ? getMatchDefaultCategory(
                                                      IncomeBillCategories[0]
                                                          .id,
                                                  )
                                                : getMatchDefaultCategory(
                                                      ExpenseBillCategories[0]
                                                          .id,
                                                  ),
                                    }));
                                }}
                            >
                                <Switch.Thumb className="w-1/2 h-full flex justify-center items-center transition-all rounded-lg text-white shadow-sm bg-semantic-expense -translate-x-[22px] data-[state=checked]:bg-semantic-income data-[state=checked]:translate-x-[21px]">
                                    <span className="text-[8px] font-medium">
                                        {billState.type === "expense"
                                            ? t("expense")
                                            : t("income")}
                                    </span>
                                </Switch.Thumb>
                            </Switch.Root>
                        </div>
                        <div className="flex-1 flex rounded-xl ml-2 px-3 relative border border-border bg-muted/70 shadow-sm text-foreground">
                            {quickCurrencies.length > 0 && (
                                <Select
                                    value={targetCurrency?.id}
                                    onValueChange={(newCurrencyId) => {
                                        changeCurrency(newCurrencyId);
                                    }}
                                >
                                    <div className="flex items-center">
                                        <SelectTrigger className="w-fit outline-none ring-none border-none shadow-none p-0 [&_svg]:hidden">
                                            <div className="flex items-center font-semibold text-2xl text-foreground">
                                                {targetCurrency?.symbol}
                                            </div>
                                        </SelectTrigger>
                                    </div>
                                    <SelectContent>
                                        {quickCurrencies.map((currency) => (
                                            <SelectItem
                                                key={currency.id}
                                                value={currency.id}
                                            >
                                                {currency.label}
                                                {`(${currency.symbol})`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <button
                                ref={monitorRef}
                                type="button"
                                onFocus={() => {
                                    setMonitorFocused(true);
                                }}
                                onBlur={() => {
                                    setMonitorFocused(false);
                                }}
                                className="flex-1 min-w-0 flex flex-col justify-center items-end overflow-x-scroll outline-none"
                            >
                                {billState.currency && (
                                    <div className="absolute text-foreground/60 text-[8px] top-0">
                                        ≈ {baseCurrency.symbol}{" "}
                                        {amountToNumber(billState.amount)}{" "}
                                        {baseCurrency.label}
                                    </div>
                                )}
                                <Calculator.Value
                                    className={cn(
                                        "text-foreground text-3xl font-semibold text-right bg-transparent after:inline-block after:content-['|'] after:opacity-0 after:font-thin after:translate-y-[-3px] ",
                                        monitorFocused &&
                                            "after:animate-caret-blink",
                                    )}
                                ></Calculator.Value>
                                {billState.amount < 0 && (
                                    <div className="absolute text-red-700 text-[8px] bottom-0">
                                        {t("bill-negative-tip")}
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>
                }
            >
                {/* categories */}
                <div className="flex-1 flex-shrink-0 overflow-y-auto min-h-[80px] scrollbar-hidden flex flex-col px-2 text-sm font-medium gap-2">
                    <div className="flex flex-col min-h-[80px] grow-[2] shrink overflow-y-auto scrollbar-hidden w-full">
                        <div
                            className={cn(
                                "grid gap-1",
                                categoriesGridClassName(categories),
                            )}
                        >
                            {categories.map((item) => (
                                <CategoryItem
                                    key={item.id}
                                    category={item}
                                    selected={billState.categoryId === item.id}
                                    onMouseDown={() => {
                                        handleParentCategoryClick(item.id);
                                    }}
                                />
                            ))}
                            <button
                                type="button"
                                className={cn(
                                    `rounded-lg border flex-1 py-1 px-2 h-8 flex gap-2 items-center justify-center whitespace-nowrap cursor-pointer`,
                                )}
                                onClick={() => {
                                    showCategoryList(billState.type);
                                }}
                            >
                                <i className="icon-[mdi--settings]"></i>
                                {t("edit")}
                            </button>
                        </div>
                    </div>
                    {(subCategories?.length ?? 0) > 0 && (
                        <div className="flex flex-col min-h-[68px] grow-[1] shrink max-h-fit overflow-y-auto rounded-md border p-2 shadow scrollbar-hidden">
                            <div
                                className={cn(
                                    "grid gap-1",
                                    categoriesGridClassName(subCategories),
                                )}
                            >
                                {subCategories?.map((subCategory) => {
                                    return (
                                        <CategoryItem
                                            key={subCategory.id}
                                            category={subCategory}
                                            selected={
                                                billState.categoryId ===
                                                subCategory.id
                                            }
                                            onMouseDown={() => {
                                                setBillState((v) => ({
                                                    ...v,
                                                    categoryId: subCategory.id,
                                                }));
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
                {/* tags */}
                <div
                    ref={tagSelectorRef}
                    className="w-full h-[40px] flex-shrink-0 flex-grow-0 flex gap-1 py-1 items-center overflow-x-auto px-2 text-sm font-medium scrollbar-hidden"
                >
                    <TagGroupSelector
                        groups={otherTagGroups}
                        selectedTags={billState.tagIds}
                        onSelectChange={(newTagIds, extra) => {
                            setBillState((prev) => ({
                                ...prev,
                                tagIds: newTagIds,
                            }));
                            if (extra?.preferCurrency) {
                                changeCurrency(extra.preferCurrency);
                            }
                        }}
                    />
                    <button
                        type="button"
                        className={cn(
                            `rounded-lg border py-1 px-2 h-8 flex gap-2 items-center justify-center whitespace-nowrap cursor-pointer`,
                        )}
                        onClick={() => {
                            showTagList();
                        }}
                    >
                        <i className="icon-[mdi--tag-text-outline]"></i>
                        {t("edit-tags")}
                    </button>
                </div>

                {/* keyboard area */}
                <div
                    className={cn(
                        "h-[calc(480px+160px*(var(--bekh,0.5)-0.5))] sm:h-[calc(380px+160px*(var(--bekh,0.5)-0.5))] min-h-[264px] max-h-[calc(100%-124px)]",
                        "keyboard-field relative flex gap-2 flex-col justify-start border-t border-border bg-zinc-100/95 text-foreground p-2 pb-[max(env(safe-area-inset-bottom),8px)] sm:rounded-b-md dark:border-white/10 dark:bg-stone-900 dark:text-white",
                    )}
                >
                    <ResizeHandle />
                    {billState.type === "expense" && attributionGroup && (
                        <AttributionTagGroupSelector
                            compact
                            group={attributionGroup}
                            selectedTags={billState.tagIds}
                            onSelectChange={(newTagIds, extra) => {
                                setBillState((prev) => ({
                                    ...prev,
                                    tagIds: newTagIds,
                                }));
                                if (extra?.preferCurrency) {
                                    changeCurrency(extra.preferCurrency);
                                }
                            }}
                        />
                    )}
                    <div className="flex items-center gap-2">
                        <div className="flex shrink-0 gap-1.5 items-center h-10">
                            <div className="flex items-center h-full">
                                {(billState.images?.length ?? 0) > 0 && (
                                    <div className="pr-2 flex gap-[6px] items-center overflow-x-auto max-w-22 h-full scrollbar-hidden">
                                        {billState.images?.map((img, index) => (
                                            <Deletable
                                                // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                                                key={index}
                                                onDelete={() => {
                                                    setBillState((v) => ({
                                                        ...v,
                                                        images: v.images?.filter(
                                                            (m) => m !== img,
                                                        ),
                                                    }));
                                                }}
                                            >
                                                <SmartImage
                                                    source={img}
                                                    alt=""
                                                    className="w-6 h-6 object-cover rounded"
                                                />
                                            </Deletable>
                                        ))}
                                    </div>
                                )}
                                {(billState.images?.length ?? 0) < 3 && (
                                    <button
                                        type="button"
                                        className="px-1 flex justify-center items-center rounded-full transition-all cursor-pointer"
                                        onClick={chooseImage}
                                    >
                                        <i className="icon-xs icon-[mdi--image-plus-outline] text-foreground/80 dark:text-white"></i>
                                    </button>
                                )}
                            </div>
                            <div className="h-full flex items-center">
                                {billState?.location ? (
                                    <Deletable
                                        onDelete={() => {
                                            setBillState((prev) => {
                                                return {
                                                    ...prev,
                                                    location: undefined,
                                                };
                                            });
                                        }}
                                    >
                                        <i className="w-5 icon-[mdi--location-radius]"></i>
                                    </Deletable>
                                ) : (
                                    <CurrentLocation
                                        ref={locationRef}
                                        className="px-1 flex items-center justify-center"
                                        onValueChange={(v) => {
                                            setBillState((prev) => {
                                                return { ...prev, location: v };
                                            });
                                        }}
                                    >
                                        <i className="icon-[mdi--add-location] text-foreground/80 dark:text-white" />
                                    </CurrentLocation>
                                )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1 rounded-xl border border-border/70 bg-background/75 px-1 py-1 shadow-sm dark:border-white/10 dark:bg-white/5">
                                <button
                                    type="button"
                                    className="flex h-8 w-8 justify-center items-center rounded-lg transition-all cursor-pointer text-foreground/80 hover:bg-accent hover:text-accent-foreground active:bg-accent/80 dark:text-white/85 dark:hover:bg-white/10 dark:hover:text-white"
                                    onClick={() => {
                                        applyTimeChange(
                                            dayjs(billState.time)
                                                .subtract(1, "day")
                                                .valueOf(),
                                        );
                                    }}
                                >
                                    <i className="icon-[mdi--chevron-left]" />
                                </button>
                                <DatePicker
                                    fixedTime
                                    closeOnDateSelect
                                    popoverSide="top"
                                    popoverAlign="start"
                                    popoverSideOffset={8}
                                    value={billState.time}
                                    displayFormatter={(time) =>
                                        time ? relativeDenseDate(time) : ""
                                    }
                                    triggerClassName="h-8 w-[120px] shrink-0 justify-center rounded-lg px-2 text-sm font-medium tabular-nums text-foreground/90 hover:bg-accent hover:text-accent-foreground dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
                                    displayClassName="mx-0 truncate"
                                    onChange={applyTimeChange}
                                />
                                <button
                                    type="button"
                                    className="flex h-8 w-8 justify-center items-center rounded-lg transition-all cursor-pointer text-foreground/80 hover:bg-accent hover:text-accent-foreground active:bg-accent/80 dark:text-white/85 dark:hover:bg-white/10 dark:hover:text-white"
                                    onClick={() => {
                                        applyTimeChange(
                                            dayjs(billState.time)
                                                .add(1, "day")
                                                .valueOf(),
                                        );
                                    }}
                                >
                                    <i className="icon-[mdi--chevron-right]" />
                                </button>
                            </div>
                        </div>
                        <RemarkHint
                            recommends={predictComments}
                            onSelect={(v) => {
                                setBillState((prev) => ({
                                    ...prev,
                                    comment: `${prev.comment} ${v}`,
                                }));
                            }}
                        >
                            <div className="flex h-10 min-w-0 flex-1 items-center rounded-xl border border-border/70 bg-background/75 px-3 shadow-sm dark:border-white/10 dark:bg-white/5">
                                <IOSUnscrolledInput
                                    value={billState.comment}
                                    onChange={(e) => {
                                        setBillState((v) => ({
                                            ...v,
                                            comment: e.target.value,
                                        }));
                                    }}
                                    type="text"
                                    className="w-full min-w-0 bg-transparent text-foreground text-right placeholder:text-foreground/45 outline-none dark:text-white dark:placeholder:text-white/45"
                                    placeholder={t("comment")}
                                    enterKeyHint="done"
                                />
                            </div>
                        </RemarkHint>
                    </div>

                    <button
                        type="button"
                        className="flex h-[80px] min-h-[48px] justify-center items-center bg-green-700 text-white rounded-lg font-bold text-lg cursor-pointer shadow-sm hover:bg-green-700/90"
                        onClick={() => {
                            void toConfirm();
                        }}
                    >
                        <i className="icon-[mdi--check] icon-md"></i>
                    </button>
                    <Calculator.Keyboard
                        className={cn("flex-1")}
                        onKey={(v) => {
                            if (v === "r") {
                                void toConfirm().then((confirmed) => {
                                    if (!confirmed) {
                                        return;
                                    }
                                    window.setTimeout(() => {
                                        void goAddBill();
                                    }, ADD_AGAIN_REOPEN_DELAY_MS);
                                });
                            }
                        }}
                    />
                </div>
            </PopupLayout>
        </Calculator.Root>
    );
}
