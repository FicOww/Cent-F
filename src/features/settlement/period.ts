import dayjs from "dayjs";

export type SettlementPeriodPreset = "this-month" | "last-month" | "custom";

export type SettlementRange = {
    preset: SettlementPeriodPreset;
    start: number;
    end: number;
};

const isValidTimestamp = (value: number | undefined) => {
    return typeof value === "number" && Number.isFinite(value);
};

export const createSettlementRange = (
    preset: SettlementPeriodPreset,
    options?: {
        start?: number;
        end?: number;
        now?: dayjs.Dayjs;
    },
): SettlementRange => {
    const now = options?.now ?? dayjs();
    if (preset === "last-month") {
        const target = now.subtract(1, "month");
        return {
            preset,
            start: target.startOf("month").valueOf(),
            end: target.endOf("month").valueOf(),
        };
    }
    if (preset === "custom") {
        const start = isValidTimestamp(options?.start)
            ? dayjs(options?.start).startOf("day").valueOf()
            : now.startOf("month").valueOf();
        const end = isValidTimestamp(options?.end)
            ? dayjs(options?.end).endOf("day").valueOf()
            : now.endOf("month").valueOf();
        return {
            preset,
            start: Math.min(start, end),
            end: Math.max(start, end),
        };
    }
    return {
        preset: "this-month",
        start: now.startOf("month").valueOf(),
        end: now.endOf("month").valueOf(),
    };
};

export const parseSettlementRangeFromSearchParams = (
    searchParams: URLSearchParams,
): SettlementRange => {
    const preset = searchParams.get("preset");
    const parsedPreset: SettlementPeriodPreset =
        preset === "last-month" || preset === "custom" ? preset : "this-month";

    const start = Number(searchParams.get("start") ?? "");
    const end = Number(searchParams.get("end") ?? "");

    return createSettlementRange(parsedPreset, {
        start: Number.isFinite(start) ? start : undefined,
        end: Number.isFinite(end) ? end : undefined,
    });
};

export const buildSettlementSearchParams = (range: SettlementRange) => {
    const params = new URLSearchParams();
    params.set("preset", range.preset);
    if (range.preset === "custom") {
        params.set("start", String(range.start));
        params.set("end", String(range.end));
    }
    return params.toString();
};

export const getSettlementRangeLabel = (range: SettlementRange) => {
    const start = dayjs(range.start);
    const end = dayjs(range.end);
    if (
        start.isSame(end, "month") &&
        start.isSame(start.startOf("month")) &&
        end.isSame(end.endOf("month"))
    ) {
        return start.format("YYYY-MM");
    }
    return `${dayjs(range.start).format("YYYY-MM-DD")} - ${dayjs(range.end).format("YYYY-MM-DD")}`;
};
