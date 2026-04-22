import type { SettlementRecord } from "@/ledger/type";
import type { SettlementRange } from "./period";
import type { SettlementTransferSummary } from "./summary";

export type SettlementCycleStatus =
    | "missing-config"
    | "needs-settlement"
    | "balanced"
    | "settled"
    | "changed-since-settled";

export const getSettlementPairKey = (
    memberAId: string | number,
    memberBId: string | number,
) => {
    return [String(memberAId), String(memberBId)].sort().join(":");
};

export const getSettlementPeriodKey = (
    range: SettlementRange,
    memberAId: string | number,
    memberBId: string | number,
) => {
    return `${getSettlementPairKey(memberAId, memberBId)}:${range.start}:${range.end}`;
};

export const getSettlementRecordsForPeriod = (
    records: SettlementRecord[] | undefined,
    periodKey: string,
) => {
    return (records ?? [])
        .filter((record) => record.periodKey === periodKey)
        .sort((left, right) => right.settledAt - left.settledAt);
};

export const doesSettlementRecordMatchSummary = (
    record: SettlementRecord | undefined,
    summary: SettlementTransferSummary | undefined,
) => {
    if (!record || !summary || summary.kind !== "transfer") {
        return false;
    }
    return (
        record.payerId === summary.payerId &&
        record.receiverId === summary.receiverId &&
        record.amount === summary.amount
    );
};

export const getSettlementCycleStatus = ({
    hasConfig,
    summary,
    issueCount,
    latestRecord,
}: {
    hasConfig: boolean;
    summary: SettlementTransferSummary | undefined;
    issueCount: number;
    latestRecord?: SettlementRecord;
}): SettlementCycleStatus => {
    if (!hasConfig) {
        return "missing-config";
    }
    if (!summary || summary.kind === "balanced") {
        return latestRecord ? "changed-since-settled" : "balanced";
    }
    if (!latestRecord) {
        return "needs-settlement";
    }
    if (
        issueCount > 0 ||
        !doesSettlementRecordMatchSummary(latestRecord, summary)
    ) {
        return "changed-since-settled";
    }
    return "settled";
};
