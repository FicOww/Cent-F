import { useCallback, useEffect, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import type { BillTag } from "@/components/bill-tag/type";
import type { BillTagGroup } from "@/ledger/type";
import { t } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import {
    getEffectiveTagGroups,
    getLegacyPersonalTagGroups,
} from "@/utils/tag-config";

export function useTag() {
    const userId = useUserStore((state) => state.id);
    const [meta, tags = []] = useLedgerStore(
        useShallow((state) => [state.infos?.meta, state.infos?.meta.tags]),
    );

    const tagGroups = useMemo(
        () => getEffectiveTagGroups(meta, userId),
        [meta, userId],
    );

    useEffect(() => {
        const legacyTagGroups = getLegacyPersonalTagGroups(meta, userId);
        if (meta?.tagGroups !== undefined || !legacyTagGroups?.length) {
            return;
        }

        useLedgerStore
            .getState()
            .updateGlobalMeta((prev) => {
                if (prev.tagGroups !== undefined) {
                    return prev;
                }
                prev.tagGroups = legacyTagGroups;
                return prev;
            })
            .catch((error) => {
                console.error("Failed to migrate tag groups:", error);
            });
    }, [meta, userId]);

    const updateTag = useCallback(
        (
            id: string,
            newTag: (Omit<BillTag, "id"> & { id?: string }) | undefined,
        ) => {
            return useLedgerStore.getState().updateGlobalMeta((prev) => {
                if (newTag === undefined) {
                    prev.tags = prev.tags.filter((v) => v.id !== id);
                    return prev;
                }
                const index = prev.tags?.findIndex((v) => v.id === id) ?? -1;
                if (index === -1) {
                    return {
                        ...prev,
                        tags: [
                            ...(prev.tags ?? []),
                            {
                                ...newTag,
                                id,
                            },
                        ],
                    };
                }
                prev.tags[index] = { ...newTag, id };
                return prev;
            });
        },
        [],
    );

    const grouped = useMemo(() => {
        const group = tagGroups.map((group) => {
            return {
                ...group,
                tags: (
                    group.tagIds?.map((tid) =>
                        tags.find((v) => v.id === tid),
                    ) ?? []
                ).filter((v) => v !== undefined),
            };
        });
        const unGroup = tags.filter((v) =>
            tagGroups.every((g) => !g.tagIds?.includes(v.id)),
        );
        return [
            ...group,
            {
                name: t("un-grouped"),
                id: "un-group",
                tags: unGroup,
                color: "gray",
                tagIds: unGroup.map((v) => v.id),
            },
        ];
    }, [tagGroups, tags]);

    const updateGroup = useCallback(
        (
            id: string,
            newGroup: (Omit<BillTagGroup, "id"> & { id?: string }) | undefined,
        ) => {
            return useLedgerStore.getState().updateGlobalMeta((prev) => {
                if (newGroup === undefined) {
                    prev.tagGroups = prev.tagGroups?.filter((v) => v.id !== id);
                    return prev;
                }
                const index =
                    prev.tagGroups?.findIndex((v) => v.id === id) ?? -1;
                if (index === -1) {
                    return {
                        ...prev,
                        tagGroups: [
                            ...(prev.tagGroups ?? []),
                            {
                                ...newGroup,
                                id,
                            },
                        ],
                    };
                }
                const nextGroups = [...(prev.tagGroups ?? [])];
                nextGroups[index] = { ...newGroup, id };
                return {
                    ...prev,
                    tagGroups: nextGroups,
                };
            });
        },
        [],
    );

    const topUpGroup = useCallback((groupId: string) => {
        return useLedgerStore.getState().updateGlobalMeta((prev) => {
            const target = prev.tagGroups?.find((v) => v.id === groupId);
            if (!target) {
                return prev;
            }
            const nextGroups = [
                target,
                ...(prev.tagGroups?.filter((v) => v.id !== groupId) ?? []),
            ];
            return { ...prev, tagGroups: nextGroups };
        });
    }, []);

    return {
        tags,
        updateTag,
        grouped,
        updateGroup,
        topUpGroup,
    };
}

export type BillTagGroupDetail = BillTagGroup & { tags: BillTag[] };
