import { useEffect } from "react";
import WidgetPreview from "@/components/widget/preview";
import { useWidget } from "@/hooks/use-widget";
import { useLedgerStore } from "@/store/ledger";

export default function WidgetRail() {
    const { homeWidgets } = useWidget();

    useEffect(() => {
        if (homeWidgets.length > 0) {
            void useLedgerStore.getState().refreshBillList();
        }
    }, [homeWidgets.length]);

    if (homeWidgets.length === 0) {
        return null;
    }

    return (
        <div className="w-full flex flex-col gap-1">
            <div className="w-full flex overflow-x-auto gap-2 scrollbar-hidden snap-mandatory snap-x">
                {homeWidgets.map((widget) => (
                    <div
                        key={widget.id}
                        className="flex-shrink-0 snap-start w-full min-h-[100px] rounded-2xl border bg-card overflow-hidden shadow-sm"
                    >
                        <WidgetPreview widget={widget} className="p-4" />
                    </div>
                ))}
            </div>
        </div>
    );
}
