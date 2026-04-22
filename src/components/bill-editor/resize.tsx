import type { PointerEventHandler } from "react";
import { useRef } from "react";
import { useIsDesktop } from "@/hooks/use-media-query";
import { usePreferenceStore } from "@/store/preference";

export default function ResizeHandle() {
    const startRef = useRef<
        | {
              keyboardBound: DOMRect;
          }
        | undefined
    >(undefined);
    const isDesktop = useIsDesktop();

    const onPointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
        const parent = event.currentTarget.parentElement;
        if (!parent) {
            return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        startRef.current = {
            keyboardBound: parent.getBoundingClientRect(),
        };
    };

    const onPointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
        if (startRef.current === undefined) {
            return;
        }
        const { keyboardBound } = startRef.current;
        const newKeyboardHeight = keyboardBound.bottom - event.clientY;
        const newBekh = isDesktop
            ? (newKeyboardHeight - 380) / 160 + 0.5
            : (newKeyboardHeight - 480) / 160 + 0.5;

        const nextBekh = Math.min(1, Math.max(0.01, newBekh));
        usePreferenceStore.setState((prev) => ({
            ...prev,
            keyboardHeight: nextBekh * 100,
        }));
    };

    const onPointerUp: PointerEventHandler<HTMLDivElement> = (event) => {
        if (startRef.current === undefined) {
            return;
        }
        event.currentTarget.releasePointerCapture(event.pointerId);
        startRef.current = undefined;
    };

    return (
        <div
            className="touch-none absolute z-[2] left-0 top-[-10px] w-full h-[20px] cursor-ns-resize flex justify-center items-center"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        >
            <div className="pointer-events-none h-[6px] w-14 rounded-full bg-background border" />
        </div>
    );
}
