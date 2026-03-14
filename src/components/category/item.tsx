import type { MouseEventHandler } from "react";
import type { BillCategory } from "@/ledger/type";
import { cn } from "@/utils";
import CategoryIcon from "./icon";

export function CategoryItem({
    category,
    selected,
    onMouseDown,
    onClick,
    className,
}: {
    category: BillCategory;
    selected?: boolean;
    onMouseDown?: MouseEventHandler<HTMLButtonElement>;
    onClick?: MouseEventHandler<HTMLButtonElement>;
    className?: string;
}) {
    return (
        <button
            type="button"
            className={cn(
                `rounded-lg border flex-1 py-1 px-2 h-8 flex items-center justify-center whitespace-nowrap cursor-pointer`,
                selected
                    ? "bg-[#0a84ff] text-white border-[#0a84ff] shadow-[0_0_0_2px_rgba(255,255,255,0.08)] dark:shadow-[0_0_0_2px_rgba(10,132,255,0.45)]"
                    : "bg-stone-200 text-light-900 dark:bg-stone-500 dark:text-stone-100",
                className,
            )}
            onMouseDown={onMouseDown}
            onClick={onClick}
        >
            <CategoryIcon
                icon={category.icon}
                className="w-4 h-4 flex-shrink-0"
            />
            <div className="mx-2 truncate">{category.name}</div>
        </button>
    );
}
