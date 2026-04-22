import { StorageDeferredAPI } from "@/api/storage";
import {
    calculateSettlement,
    isSettlementConfigComplete,
    type SettlementResult,
} from "@/ledger/settlement";
import type { Bill, SettlementConfig, SettlementRecord } from "@/ledger/type";
import type { SettlementRange } from "./period";
import {
    getSettlementCycleStatus,
    getSettlementPeriodKey,
    getSettlementRecordsForPeriod,
    type SettlementCycleStatus,
} from "./status";
import {
    getSettlementTransferSummary,
    type SettlementTransferSummary,
} from "./summary";

export type SettlementOverview = {
    bills: Bill[];
    settlement?: SettlementResult;
    summary?: SettlementTransferSummary;
    issueBillIds: string[];
    status: SettlementCycleStatus;
    periodKey?: string;
    periodRecords: SettlementRecord[];
    latestRecord?: SettlementRecord;
};

export const fetchSettlementBills = async ({
    bookId,
    range,
}: {
    bookId: string;
    range: SettlementRange;
    config?: SettlementConfig;
}) => {
    return StorageDeferredAPI.filter(bookId, {
        start: range.start,
        end: range.end,
    });
};

export const buildSettlementOverview = ({
    bills,
    config,
    range,
    records,
}: {
    bills: Bill[];
    config?: SettlementConfig;
    range: SettlementRange;
    records?: SettlementRecord[];
}): SettlementOverview => {
    if (!isSettlementConfigComplete(config)) {
        return {
            bills,
            issueBillIds: [],
            status: "missing-config",
            periodRecords: [],
        };
    }

    const settlement = calculateSettlement(bills, config);
    const summary = getSettlementTransferSummary(settlement);
    const periodKey = getSettlementPeriodKey(
        range,
        config.memberAId,
        config.memberBId,
    );
    const periodRecords = getSettlementRecordsForPeriod(records, periodKey);
    const latestRecord = periodRecords[0];

    return {
        bills,
        settlement,
        summary,
        issueBillIds: settlement.unassignedExpenseBillIds,
        status: getSettlementCycleStatus({
            hasConfig: true,
            summary,
            issueCount: settlement.unassignedExpenseCount,
            latestRecord,
        }),
        periodKey,
        periodRecords,
        latestRecord,
    };
};
