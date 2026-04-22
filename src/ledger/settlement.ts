import type { Bill } from "./type";

export const SETTLEMENT_GROUP_NAME = "归属";
export const SETTLEMENT_HOME_TAG_NAME = "家";

export type SettlementParams = {
    memberAId: string | number;
    memberBId: string | number;
    homeTagId: string;
    memberATagId: string;
    memberBTagId: string;
};

export type SettlementMemberSummary = {
    memberId: string;
    selfExpense: number;
    sharedExpense: number;
    otherExpense: number;
    paid: number;
    owed: number;
    net: number;
};

export type SettlementResult = {
    members: [SettlementMemberSummary, SettlementMemberSummary];
    sharedExpense: number;
    unassignedExpenseCount: number;
    unassignedExpenseBillIds: string[];
};

const createMemberSummary = (memberId: string): SettlementMemberSummary => ({
    memberId,
    selfExpense: 0,
    sharedExpense: 0,
    otherExpense: 0,
    paid: 0,
    owed: 0,
    net: 0,
});

export const calculateSettlement = (
    bills: Bill[],
    params: SettlementParams,
): SettlementResult => {
    const memberAId = String(params.memberAId);
    const memberBId = String(params.memberBId);
    const allowedTagIds = new Set([
        params.homeTagId,
        params.memberATagId,
        params.memberBTagId,
    ]);

    const memberA = createMemberSummary(memberAId);
    const memberB = createMemberSummary(memberBId);
    let sharedExpense = 0;
    let memberAOwned = 0;
    let memberBOwned = 0;
    let unassignedExpenseCount = 0;
    const unassignedExpenseBillIds: string[] = [];

    for (const bill of bills) {
        if (bill.type !== "expense") {
            continue;
        }

        const creatorId = String(bill.creatorId);
        if (creatorId !== memberAId && creatorId !== memberBId) {
            continue;
        }

        const matchedTagIds =
            bill.tagIds?.filter((tagId) => allowedTagIds.has(tagId)) ?? [];
        if (matchedTagIds.length !== 1) {
            unassignedExpenseCount += 1;
            unassignedExpenseBillIds.push(bill.id);
            continue;
        }

        const amount = Math.abs(bill.amount);
        const matchedTagId = matchedTagIds[0];
        const summary = creatorId === memberAId ? memberA : memberB;

        summary.paid += amount;

        if (matchedTagId === params.homeTagId) {
            summary.sharedExpense += amount;
            sharedExpense += amount;
            continue;
        }

        if (matchedTagId === params.memberATagId) {
            if (creatorId === memberAId) {
                summary.selfExpense += amount;
            } else {
                summary.otherExpense += amount;
            }
            memberAOwned += amount;
            continue;
        }

        if (creatorId === memberBId) {
            summary.selfExpense += amount;
        } else {
            summary.otherExpense += amount;
        }
        memberBOwned += amount;
    }

    memberA.owed = memberAOwned + sharedExpense / 2;
    memberB.owed = memberBOwned + sharedExpense / 2;
    memberA.net = memberA.paid - memberA.owed;
    memberB.net = memberB.paid - memberB.owed;

    return {
        members: [memberA, memberB],
        sharedExpense,
        unassignedExpenseCount,
        unassignedExpenseBillIds,
    };
};

export const isSettlementConfigComplete = (
    config?: Partial<SettlementParams>,
): config is SettlementParams => {
    return Boolean(
        config?.memberAId &&
            config?.memberBId &&
            config?.homeTagId &&
            config?.memberATagId &&
            config?.memberBTagId,
    );
};
