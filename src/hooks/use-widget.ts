import { v4 } from "uuid";
import { useShallow } from "zustand/shallow";
import type { Widget } from "@/components/widget/type";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";

export function useWidget() {
    const widgets = useLedgerStore(
        useShallow((state) => state.infos?.meta.widgets ?? []),
    );

    const add = async (
        widget: Omit<Widget, "id" | "createdAt" | "updatedAt">,
    ) => {
        const nextWidget: Widget = {
            ...widget,
            id: v4(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        await useLedgerStore.getState().updateGlobalMeta((prev) => ({
            ...prev,
            widgets: [...(prev.widgets ?? []), nextWidget],
        }));

        return nextWidget;
    };

    const update = async (
        id: string,
        updates: Partial<Omit<Widget, "id" | "createdAt">>,
    ) => {
        await useLedgerStore.getState().updateGlobalMeta((prev) => ({
            ...prev,
            widgets: (prev.widgets ?? []).map((widget) =>
                widget.id === id
                    ? { ...widget, ...updates, updatedAt: Date.now() }
                    : widget,
            ),
        }));
    };

    const remove = async (id: string) => {
        await useLedgerStore.getState().updateGlobalMeta((prev) => ({
            ...prev,
            widgets: (prev.widgets ?? []).filter((widget) => widget.id !== id),
        }));
    };

    const reorder = async (orderedIds: string[]) => {
        await useLedgerStore.getState().updateGlobalMeta((prev) => {
            const widgetMap = new Map(
                (prev.widgets ?? []).map((widget) => [widget.id, widget]),
            );
            return {
                ...prev,
                widgets: orderedIds
                    .map((id) => widgetMap.get(id))
                    .filter((widget): widget is Widget => widget !== undefined),
            };
        });
    };

    const get = (id: string) => widgets.find((widget) => widget.id === id);

    const { id: userId } = useUserStore();
    const homeWidgets = useLedgerStore(
        useShallow((state) => {
            const personal = state.infos?.meta.personal?.[String(userId)];
            return (
                widgets.filter((widget) =>
                    personal?.homeWidgets?.includes(widget.id),
                ) ?? []
            );
        }),
    );

    const toggleHomeWidget = async (widgetId: string) => {
        await useLedgerStore.getState().updatePersonalMeta((prev) => ({
            ...prev,
            homeWidgets: prev.homeWidgets?.includes(widgetId)
                ? prev.homeWidgets.filter((id) => id !== widgetId)
                : [...(prev.homeWidgets ?? []), widgetId],
        }));
    };

    return {
        widgets,
        add,
        update,
        remove,
        reorder,
        get,
        homeWidgets,
        toggleHomeWidget,
    };
}
