import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { v4 } from "uuid";
import { useShallow } from "zustand/shallow";
import { useCreators } from "@/hooks/use-creator";
import { amountToNumber } from "@/ledger/bill";
import {
    calculateSettlement,
    SETTLEMENT_GROUP_NAME,
    SETTLEMENT_HOME_TAG_NAME,
} from "@/ledger/settlement";
import type { Bill, BillTag, SettlementConfig } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";
import Money from "../money";
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

export default function SettlementPanel({ bills }: { bills: Bill[] }) {
    const t = useIntl();
    const creators = useCreators();
    const userId = useUserStore((state) => state.id);
    const [config, tagGroups = [], tags = []] = useLedgerStore(
        useShallow((state) => {
            const personal = state.infos?.meta.personal?.[`${userId}`];
            return [
                personal?.settlement,
                personal?.tagGroups,
                state.infos?.meta.tags,
            ];
        }),
    );

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

    const resolvedConfig = useMemo(() => {
        if (
            !config?.homeTagId ||
            !config.memberATagId ||
            !config.memberBTagId ||
            !memberAId ||
            !memberBId
        ) {
            return undefined;
        }
        return {
            memberAId,
            memberBId,
            homeTagId: config.homeTagId,
            memberATagId: config.memberATagId,
            memberBTagId: config.memberBTagId,
        };
    }, [config, memberAId, memberBId]);

    const isConfigReady = useMemo(() => {
        if (!config?.tagGroupId || !resolvedConfig) {
            return false;
        }
        const requiredTagIds = [
            resolvedConfig.homeTagId,
            resolvedConfig.memberATagId,
            resolvedConfig.memberBTagId,
        ];
        return (
            requiredTagIds.every((tagId) =>
                tags.some((tag) => tag.id === tagId),
            ) && tagGroups.some((group) => group.id === config.tagGroupId)
        );
    }, [config, resolvedConfig, tagGroups, tags]);

    const settlement = useMemo(() => {
        if (!resolvedConfig || !isConfigReady || memberAId === memberBId) {
            return undefined;
        }
        return calculateSettlement(bills, resolvedConfig);
    }, [bills, isConfigReady, memberAId, memberBId, resolvedConfig]);

    const summaryText = useMemo(() => {
        if (!settlement || !memberA || !memberB) {
            return t("settlement-config-missing");
        }
        const [firstMember, secondMember] = settlement.members;
        if (firstMember.net === 0 && secondMember.net === 0) {
            return t("settlement-summary-balanced");
        }
        const receiver = firstMember.net > 0 ? memberA : memberB;
        const payer = firstMember.net > 0 ? memberB : memberA;
        const amount = Math.abs(
            firstMember.net > 0 ? firstMember.net : secondMember.net,
        );
        return t("settlement-summary-owed", {
            payer: payer.name,
            receiver: receiver.name,
            amount: amountToNumber(amount),
        });
    }, [memberA, memberB, settlement, t]);

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
            const nextTags = [...(prev.tags ?? [])];
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
            return prev;
        });

        await useLedgerStore.getState().updatePersonalMeta((prev) => {
            const nextGroups = [...(prev.tagGroups ?? [])];
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
            const groupIndex = nextGroups.findIndex(
                (group) => group.id === nextConfig.tagGroupId,
            );
            if (groupIndex === -1) {
                nextGroups.unshift(nextGroup);
            } else {
                nextGroups[groupIndex] = nextGroup;
            }
            return {
                ...prev,
                tagGroups: nextGroups,
                settlement: nextConfig,
            };
        });

        toast.success(t("settlement-config-saved"));
    };

    if (creatorOptions.length < 2) {
        return (
            <div className="rounded-md border p-3 w-full flex flex-col gap-2">
                <h2 className="font-medium text-lg">{t("settlement-title")}</h2>
                <div className="text-sm text-foreground/70">
                    {t("settlement-needs-two-creators")}
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-md border p-3 w-full flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h2 className="font-medium text-lg">
                        {t("settlement-title")}
                    </h2>
                    <div className="text-xs text-foreground/70">
                        {t("settlement-description")}
                    </div>
                </div>
                <Button size="sm" onClick={saveConfig}>
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

            <div className="text-xs text-foreground/70">
                {t("settlement-setup-tip")}
            </div>

            {!isConfigReady ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-foreground/70">
                    {t("settlement-config-missing")}
                </div>
            ) : (
                <>
                    {settlement && settlement.unassignedExpenseCount > 0 && (
                        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                            {t("settlement-missing-attribution-tip", {
                                n: settlement.unassignedExpenseCount,
                            })}
                        </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                        {settlement?.members.map((member) => {
                            const creator = creatorOptions.find(
                                (item) => item.id === member.memberId,
                            );
                            return (
                                <div
                                    key={member.memberId}
                                    className="rounded-md border p-3 flex flex-col gap-2"
                                >
                                    <div className="font-medium">
                                        {creator?.name ?? member.memberId}
                                    </div>
                                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                                        <div className="text-foreground/70">
                                            {t("settlement-self-expense")}
                                        </div>
                                        <div className="text-right">
                                            <Money
                                                value={amountToNumber(
                                                    member.selfExpense,
                                                )}
                                            />
                                        </div>

                                        <div className="text-foreground/70">
                                            {t("settlement-shared-expense")}
                                        </div>
                                        <div className="text-right">
                                            <Money
                                                value={amountToNumber(
                                                    member.sharedExpense,
                                                )}
                                            />
                                        </div>

                                        <div className="text-foreground/70">
                                            {t("settlement-other-expense")}
                                        </div>
                                        <div className="text-right">
                                            <Money
                                                value={amountToNumber(
                                                    member.otherExpense,
                                                )}
                                            />
                                        </div>

                                        <div className="text-foreground/70">
                                            {t("settlement-paid")}
                                        </div>
                                        <div className="text-right">
                                            <Money
                                                value={amountToNumber(
                                                    member.paid,
                                                )}
                                            />
                                        </div>

                                        <div className="text-foreground/70">
                                            {t("settlement-owed")}
                                        </div>
                                        <div className="text-right">
                                            <Money
                                                value={amountToNumber(
                                                    member.owed,
                                                )}
                                            />
                                        </div>

                                        <div className="text-foreground/70">
                                            {t("settlement-net")}
                                        </div>
                                        <div
                                            className={cn(
                                                "text-right font-medium",
                                                member.net > 0
                                                    ? "text-semantic-income"
                                                    : member.net < 0
                                                      ? "text-semantic-expense"
                                                      : "",
                                            )}
                                        >
                                            <Money
                                                value={amountToNumber(
                                                    member.net,
                                                )}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="rounded-md bg-accent px-3 py-2 text-sm font-medium">
                        {summaryText}
                    </div>
                </>
            )}
        </div>
    );
}
