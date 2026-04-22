import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { v4 } from "uuid";
import { useShallow } from "zustand/shallow";
import { useCreators } from "@/hooks/use-creator";
import {
    SETTLEMENT_GROUP_NAME,
    SETTLEMENT_HOME_TAG_NAME,
} from "@/ledger/settlement";
import type { BillTag, SettlementConfig } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import {
    getEffectiveSettlementConfig,
    getEffectiveTagGroups,
    getLegacyPersonalSettlementConfig,
    getLegacyPersonalTagGroups,
} from "@/utils/tag-config";
import { Button } from "../ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";

type CreatorOption = {
    id: string;
    name: string;
};

const buildCreatorOptions = (
    creators: { id: string | number; name: string }[],
): CreatorOption[] =>
    creators.map((creator) => ({
        id: String(creator.id),
        name: creator.name,
    }));

const getDefaultMemberIds = (
    creators: CreatorOption[],
    config?: SettlementConfig,
) => {
    const firstId = config?.memberAId
        ? String(config.memberAId)
        : creators[0]?.id;
    const secondId = config?.memberBId
        ? String(config.memberBId)
        : creators.find((creator) => creator.id !== firstId)?.id;
    return {
        memberAId: firstId,
        memberBId: secondId,
    };
};

const upsertTag = (tags: BillTag[], id: string, name: string): BillTag[] => {
    const index = tags.findIndex((tag) => tag.id === id);
    const nextTag = { ...(tags[index] ?? {}), id, name };
    if (index === -1) {
        return [...tags, nextTag];
    }
    const nextTags = [...tags];
    nextTags[index] = nextTag;
    return nextTags;
};

export default function SettlementConfigCard({
    className = "",
}: {
    className?: string;
}) {
    const t = useIntl();
    const creators = useCreators();
    const userId = useUserStore((state) => state.id);
    const [meta] = useLedgerStore(useShallow((state) => [state.infos?.meta]));

    const config = useMemo(
        () => getEffectiveSettlementConfig(meta, userId),
        [meta, userId],
    );
    const tagGroups = useMemo(
        () => getEffectiveTagGroups(meta, userId),
        [meta, userId],
    );

    useEffect(() => {
        const legacyConfig = getLegacyPersonalSettlementConfig(meta, userId);
        const legacyTagGroups = getLegacyPersonalTagGroups(meta, userId);

        if (
            (meta?.settlement !== undefined || !legacyConfig) &&
            (meta?.tagGroups !== undefined || !legacyTagGroups?.length)
        ) {
            return;
        }

        useLedgerStore
            .getState()
            .updateGlobalMeta((prev) => {
                if (prev.settlement === undefined && legacyConfig) {
                    prev.settlement = legacyConfig;
                }
                if (prev.tagGroups === undefined && legacyTagGroups?.length) {
                    prev.tagGroups = legacyTagGroups;
                }
                return prev;
            })
            .catch((error) => {
                console.error("Failed to migrate settlement config:", error);
            });
    }, [meta, userId]);

    const creatorOptions = useMemo(
        () => buildCreatorOptions(creators),
        [creators],
    );
    const defaults = useMemo(
        () => getDefaultMemberIds(creatorOptions, config),
        [creatorOptions, config],
    );

    const [memberAId, setMemberAId] = useState(defaults.memberAId);
    const [memberBId, setMemberBId] = useState(defaults.memberBId);

    useEffect(() => {
        setMemberAId(defaults.memberAId);
        setMemberBId(defaults.memberBId);
    }, [defaults.memberAId, defaults.memberBId]);

    const memberA = creatorOptions.find((creator) => creator.id === memberAId);
    const memberB = creatorOptions.find((creator) => creator.id === memberBId);

    const saveConfig = async () => {
        if (!memberA || !memberB) {
            toast.error(t("settlement-config-member-missing"));
            return;
        }
        if (memberA.id === memberB.id) {
            toast.error(t("settlement-config-member-conflict"));
            return;
        }

        const nextConfig = {
            memberAId: memberA.id,
            memberBId: memberB.id,
            homeTagId: config?.homeTagId ?? v4(),
            memberATagId: config?.memberATagId ?? v4(),
            memberBTagId: config?.memberBTagId ?? v4(),
            tagGroupId: config?.tagGroupId ?? v4(),
        };

        await useLedgerStore.getState().updateGlobalMeta((prev) => {
            const nextGroup = {
                id: nextConfig.tagGroupId,
                name: SETTLEMENT_GROUP_NAME,
                color: "blue",
                singleSelect: true,
                required: true,
                tagIds: [
                    nextConfig.homeTagId,
                    nextConfig.memberATagId,
                    nextConfig.memberBTagId,
                ],
            };
            const nextTags = [...(prev.tags ?? [])];
            const nextGroups = [...(prev.tagGroups ?? [])];
            const groupIndex = nextGroups.findIndex(
                (group) => group.id === nextConfig.tagGroupId,
            );

            prev.tags = upsertTag(
                nextTags,
                nextConfig.homeTagId,
                SETTLEMENT_HOME_TAG_NAME,
            );
            prev.tags = upsertTag(
                prev.tags,
                nextConfig.memberATagId,
                memberA.name,
            );
            prev.tags = upsertTag(
                prev.tags,
                nextConfig.memberBTagId,
                memberB.name,
            );

            if (groupIndex === -1) {
                nextGroups.unshift(nextGroup);
            } else {
                nextGroups[groupIndex] = nextGroup;
            }

            prev.tagGroups = nextGroups;
            prev.settlement = nextConfig;
            return prev;
        });

        toast.success(t("settlement-config-saved"));
    };

    if (creatorOptions.length < 2) {
        return (
            <div
                className={`rounded-xl border p-4 w-full flex flex-col gap-2 bg-card ${className}`}
            >
                <div className="font-medium text-base">
                    {t("settlement-title")}
                </div>
                <div className="text-sm text-foreground/70">
                    {t("settlement-needs-two-creators")}
                </div>
            </div>
        );
    }

    const isConfigReady = Boolean(
        config?.tagGroupId &&
            config.homeTagId &&
            config.memberATagId &&
            config.memberBTagId &&
            tagGroups.some((group) => group.id === config.tagGroupId),
    );

    return (
        <div
            className={`rounded-xl border p-4 w-full flex flex-col gap-3 bg-card shadow-sm ${className}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <div className="font-medium text-base">
                        {t("settlement-settings")}
                    </div>
                    <div className="text-xs text-foreground/70">
                        {t("settlement-setup-tip")}
                    </div>
                </div>
                <Button size="sm" onClick={() => void saveConfig()}>
                    {t("settlement-save-config")}
                </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                    <div className="text-xs text-foreground/70">
                        {t("settlement-member-a")}
                    </div>
                    <Select value={memberAId} onValueChange={setMemberAId}>
                        <SelectTrigger>
                            <SelectValue placeholder={t("select-a-user")} />
                        </SelectTrigger>
                        <SelectContent>
                            {creatorOptions.map((creator) => (
                                <SelectItem key={creator.id} value={creator.id}>
                                    {creator.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-1">
                    <div className="text-xs text-foreground/70">
                        {t("settlement-member-b")}
                    </div>
                    <Select value={memberBId} onValueChange={setMemberBId}>
                        <SelectTrigger>
                            <SelectValue placeholder={t("select-a-user")} />
                        </SelectTrigger>
                        <SelectContent>
                            {creatorOptions.map((creator) => (
                                <SelectItem key={creator.id} value={creator.id}>
                                    {creator.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            {!isConfigReady && (
                <div className="rounded-md border border-dashed p-3 text-sm text-foreground/70">
                    {t("settlement-config-missing")}
                </div>
            )}
        </div>
    );
}
