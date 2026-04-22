import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useIntl } from "@/locale";
import type { FormItem, WidgetSettingsForm } from "./core/compile";

export default function ConfigForm({
    config,
    settings,
    onChange,
}: {
    config: WidgetSettingsForm;
    settings: Record<string, unknown>;
    onChange: (key: string, value: unknown) => void;
}) {
    const t = useIntl();

    if (Object.keys(config).length === 0) {
        return null;
    }

    const renderField = (key: string, item: FormItem) => {
        const value = settings[key] ?? item.default ?? "";

        switch (item.type) {
            case "text":
                return (
                    <Input
                        id={`config-${key}`}
                        type="text"
                        value={String(value)}
                        onChange={(event) => onChange(key, event.target.value)}
                        className="flex-1 h-8 text-xs"
                        placeholder={item.label}
                    />
                );
            case "number":
                return (
                    <Input
                        id={`config-${key}`}
                        type="number"
                        value={String(value)}
                        onChange={(event) =>
                            onChange(
                                key,
                                Number.parseFloat(event.target.value) || 0,
                            )
                        }
                        className="flex-1 h-8 text-xs"
                        placeholder={item.label}
                    />
                );
            case "date":
                return (
                    <Input
                        id={`config-${key}`}
                        type="date"
                        value={String(value)}
                        onChange={(event) => onChange(key, event.target.value)}
                        className="flex-1 h-8 text-xs"
                    />
                );
            case "select":
                return (
                    <Select
                        value={String(value)}
                        onValueChange={(nextValue) => onChange(key, nextValue)}
                    >
                        <SelectTrigger className="flex-1 h-8 text-xs">
                            <SelectValue
                                placeholder={t("select-placeholder")}
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {item.options?.map((option) => (
                                <SelectItem key={option} value={option}>
                                    {option}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            default:
                return null;
        }
    };

    return (
        <div className="px-4 py-2 border-b space-y-2">
            <div className="text-xs font-medium text-muted-foreground mb-2">
                {t("widget-config")}
            </div>
            {Object.entries(config).map(([key, item]) => (
                <div key={key} className="flex items-center gap-2">
                    <Label
                        htmlFor={`config-${key}`}
                        className="text-xs min-w-[80px]"
                    >
                        {item.label}
                    </Label>
                    {renderField(key, item)}
                </div>
            ))}
        </div>
    );
}
