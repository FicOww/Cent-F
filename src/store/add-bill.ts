import { create } from "zustand";

type PendingFocusBill = {
    id: string;
    time: number;
};

type AddBillState = {
    lastAddedTime?: number;
    pendingFocusBill?: PendingFocusBill;
    setLastAddedTime: (time?: number) => void;
    setPendingFocusBill: (bill?: PendingFocusBill) => void;
    clearPendingFocusBill: () => void;
};

export const useAddBillStore = create<AddBillState>()((set) => ({
    lastAddedTime: undefined,
    pendingFocusBill: undefined,
    setLastAddedTime: (time) => {
        set({ lastAddedTime: time });
    },
    setPendingFocusBill: (bill) => {
        set({ pendingFocusBill: bill });
    },
    clearPendingFocusBill: () => {
        set({ pendingFocusBill: undefined });
    },
}));
