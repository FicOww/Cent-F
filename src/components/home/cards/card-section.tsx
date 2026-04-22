import type { ReactNode } from "react";

export default function CardSection({ children }: { children?: ReactNode }) {
    return <div className="w-full flex flex-col gap-2">{children}</div>;
}
