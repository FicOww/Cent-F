import type { RefObject } from "react";
import BudgetCard from "@/components/budget/card";
import type { Budget } from "@/ledger/type";

export default function BudgetCardWrapper({
    budgets,
    containerRef,
}: {
    budgets: Budget[];
    containerRef: RefObject<HTMLDivElement | null>;
}) {
    if (budgets.length === 0) {
        return null;
    }

    return (
        <div className="w-full flex flex-col gap-1">
            <div
                ref={containerRef}
                className="w-full flex overflow-x-auto gap-2 scrollbar-hidden snap-mandatory snap-x"
            >
                {budgets.map((budget) => {
                    return (
                        <BudgetCard
                            className="flex-shrink-0 snap-start"
                            key={budget.id}
                            budget={budget}
                        />
                    );
                })}
            </div>
        </div>
    );
}
