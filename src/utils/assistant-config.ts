import type { AssistantMeta, GlobalMeta } from "@/ledger/type";

export const getSharedAssistantData = (meta?: GlobalMeta) => {
    return meta?.assistant;
};

export const getLegacyPersonalAssistantData = (
    meta: GlobalMeta | undefined,
    userId: string | number | undefined,
) => {
    if (!meta || userId === undefined) {
        return undefined;
    }
    return meta.personal?.[String(userId)]?.assistant;
};

export const getEffectiveAssistantData = (
    meta: GlobalMeta | undefined,
    userId: string | number | undefined,
): AssistantMeta | undefined => {
    const sharedAssistant = getSharedAssistantData(meta);
    if (sharedAssistant) {
        return sharedAssistant;
    }
    return getLegacyPersonalAssistantData(meta, userId);
};
