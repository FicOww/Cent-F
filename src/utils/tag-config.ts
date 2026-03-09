import type { BillTagGroup, GlobalMeta, SettlementConfig } from "@/ledger/type";

export const getSharedTagGroups = (
    meta?: GlobalMeta,
): BillTagGroup[] | undefined => meta?.tagGroups;

export const getLegacyPersonalTagGroups = (
    meta: GlobalMeta | undefined,
    userId: string | number | undefined,
): BillTagGroup[] | undefined => {
    if (!meta || userId === undefined) {
        return undefined;
    }
    return meta.personal?.[String(userId)]?.tagGroups;
};

export const getEffectiveTagGroups = (
    meta: GlobalMeta | undefined,
    userId: string | number | undefined,
): BillTagGroup[] => {
    const sharedTagGroups = getSharedTagGroups(meta);
    if (sharedTagGroups !== undefined) {
        return sharedTagGroups;
    }
    return getLegacyPersonalTagGroups(meta, userId) ?? [];
};

export const getSharedSettlementConfig = (
    meta?: GlobalMeta,
): SettlementConfig | undefined => meta?.settlement;

export const getLegacyPersonalSettlementConfig = (
    meta: GlobalMeta | undefined,
    userId: string | number | undefined,
): SettlementConfig | undefined => {
    if (!meta || userId === undefined) {
        return undefined;
    }
    return meta.personal?.[String(userId)]?.settlement;
};

export const getEffectiveSettlementConfig = (
    meta: GlobalMeta | undefined,
    userId: string | number | undefined,
): SettlementConfig | undefined => {
    const sharedSettlement = getSharedSettlementConfig(meta);
    if (sharedSettlement !== undefined) {
        return sharedSettlement;
    }
    return getLegacyPersonalSettlementConfig(meta, userId);
};
