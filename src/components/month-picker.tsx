import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { HIGH_CONTRAST_SELECTED_CLASS } from "@/utils/selected-style";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export default function MonthPicker({
    value,
    yearRange,
    onChange,
    allowClear = true,
    placeholder,
    triggerClassName,
}: {
    value?: dayjs.Dayjs;
    yearRange: readonly [number, number];
    onChange: (value?: dayjs.Dayjs) => void;
    allowClear?: boolean;
    placeholder?: string;
    triggerClassName?: string;
}) {
    const t = useIntl();
    const [open, setOpen] = useState(false);
    const [displayYear, setDisplayYear] = useState(
        () => value?.year() ?? dayjs().year(),
    );
    const [selectingYear, setSelectingYear] = useState(false);
    const [minYear, maxYear] = yearRange;
    const yearPageStart = useMemo(() => {
        return Math.floor((displayYear - minYear) / 12) * 12 + minYear;
    }, [displayYear, minYear]);

    useEffect(() => {
        setDisplayYear(value?.year() ?? dayjs().year());
    }, [value]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "h-8 px-3 rounded-full border text-sm whitespace-nowrap transition-colors flex-shrink-0 bg-transparent border-border text-foreground/70 hover:text-foreground font-normal",
                        triggerClassName,
                    )}
                >
                    <i className="icon-[mdi--calendar-month-outline] size-4 text-foreground/80"></i>
                    {value
                        ? value.format("YYYY-MM")
                        : (placeholder ?? t("all"))}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="w-[272px] rounded-2xl border-border/70 bg-background/95 p-3 backdrop-blur"
            >
                {allowClear && (
                    <button
                        type="button"
                        className={cn(
                            "mb-3 flex h-10 w-full items-center justify-center rounded-xl border text-sm transition-colors",
                            value === undefined
                                ? HIGH_CONTRAST_SELECTED_CLASS
                                : "border-border text-foreground/80 hover:bg-accent hover:text-accent-foreground",
                        )}
                        onClick={() => {
                            onChange(undefined);
                            setOpen(false);
                        }}
                    >
                        {t("all")}
                    </button>
                )}
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
                            setDisplayYear((prev) =>
                                Math.max(minYear, prev - 1),
                            );
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
                            setDisplayYear((prev) =>
                                Math.min(maxYear, prev + 1),
                            );
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
                            const checked = year === value?.year();
                            return (
                                <button
                                    key={year}
                                    type="button"
                                    className={cn(
                                        "h-10 rounded-xl border text-sm transition-colors tabular-nums",
                                        checked
                                            ? HIGH_CONTRAST_SELECTED_CLASS
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
                            const checked = value
                                ? monthValue.isSame(value, "month")
                                : false;
                            return (
                                <button
                                    key={`${displayYear}-${index + 1}`}
                                    type="button"
                                    className={cn(
                                        "h-10 rounded-xl border text-sm transition-colors",
                                        checked
                                            ? HIGH_CONTRAST_SELECTED_CLASS
                                            : "border-border text-foreground/80 hover:bg-accent hover:text-accent-foreground",
                                    )}
                                    onClick={() => {
                                        onChange(
                                            checked && allowClear
                                                ? undefined
                                                : monthValue,
                                        );
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
