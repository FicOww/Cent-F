import { useAddBillStore } from "@/store/add-bill";
import { useLedgerStore } from "@/store/ledger";
import createConfirmProvider from "../confirm";
import EditorForm from "./form";

const confirms = createConfirmProvider(EditorForm, {
    dialogTitle: "Edit Bill",
    contentClassName:
        "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[85vh] sm:w-[90vw] sm:max-w-[600px]",
});

const [BillEditorProvider, showBillEditor] = confirms;

export { BillEditorProvider, showBillEditor };

export const goAddBill = async () => {
    const newBill = await showBillEditor();
    const billId = await useLedgerStore.getState().addBill(newBill);
    useAddBillStore.getState().setLastAddedTime(newBill.time);
    useAddBillStore.getState().setPendingFocusBill({
        id: billId,
        time: newBill.time,
    });
    return {
        id: billId,
        time: newBill.time,
    };
};
