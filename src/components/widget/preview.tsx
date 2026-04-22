import type { Bill } from "@/ledger/type";
import WidgetPreviewWrapper from "./preview-wrapper";
import type { Widget } from "./type";

export default function WidgetPreview({
    widget,
    className,
    bills,
}: {
    widget: Widget;
    className?: string;
    bills?: Bill[];
}) {
    return (
        <WidgetPreviewWrapper
            code={widget.code}
            settings={widget.settings}
            className={className}
            bills={bills}
        />
    );
}
