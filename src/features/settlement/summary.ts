import type { SettlementResult } from "@/ledger/settlement";

export type SettlementTransferSummary =
    | {
          kind: "balanced";
      }
    | {
          kind: "transfer";
          payerId: string;
          receiverId: string;
          amount: number;
      };

export const getSettlementTransferSummary = (
    settlement?: SettlementResult,
): SettlementTransferSummary | undefined => {
    if (!settlement) {
        return undefined;
    }
    const [firstMember, secondMember] = settlement.members;
    if (firstMember.net === 0 && secondMember.net === 0) {
        return {
            kind: "balanced",
        };
    }
    if (firstMember.net > 0) {
        return {
            kind: "transfer",
            payerId: secondMember.memberId,
            receiverId: firstMember.memberId,
            amount: Math.abs(firstMember.net),
        };
    }
    return {
        kind: "transfer",
        payerId: firstMember.memberId,
        receiverId: secondMember.memberId,
        amount: Math.abs(secondMember.net),
    };
};
