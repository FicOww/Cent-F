export const Permission = {
    Billing: "billing",
    Filter: "filter",
    Budget: "budget",
    Collaborators: "collaborators",
    Category: "category",
    Currency: "currency",
    Tag: "tag",
} as const;

type FormItemType = "text" | "number" | "date" | "select";

export type FormItem = {
    type: FormItemType;
    label: string;
    default?: string | number;
    options?: string[];
};

export type WidgetSettingsForm = Record<string, FormItem>;

type ParsedMetadata = {
    apiVersion: string;
    name: string;
    permissions: string[];
};

export type CompiledWidget = {
    name: string;
    apiVersion: string;
    permissions: (typeof Permission)[keyof typeof Permission][];
    config: WidgetSettingsForm;
    code: string;
};

function parseMetadata(code: string): ParsedMetadata {
    const metadata: ParsedMetadata = {
        apiVersion: "",
        name: "",
        permissions: [],
    };

    const jsdocMatch = code.match(/\/\*\*[\s\S]*?\*\//);
    if (!jsdocMatch) {
        return metadata;
    }

    const jsdoc = jsdocMatch[0];
    const apiVersionMatch = jsdoc.match(/@widget-api\s+([\d.]+)/);
    if (apiVersionMatch) {
        metadata.apiVersion = apiVersionMatch[1];
    }

    const nameMatch = jsdoc.match(/@name\s+(.+)/);
    if (nameMatch) {
        metadata.name = nameMatch[1].trim();
    }

    const permissionsMatch = jsdoc.match(/@permissions\s+(.+)/);
    if (permissionsMatch) {
        metadata.permissions = permissionsMatch[1]
            .split(",")
            .map((permission) => permission.trim())
            .filter((permission) =>
                Object.values(Permission).includes(permission as never),
            );
    }

    return metadata;
}

function extractConfigExport(code: string): string | null {
    const configMatch = code.match(
        /export\s+const\s+config\s*=\s*(\{[\s\S]*?\});?\s*(?:\n|$)/,
    );
    return configMatch ? configMatch[1] : null;
}

function parseConfigObject(configStr: string): WidgetSettingsForm {
    const config: WidgetSettingsForm = {};
    const fieldRegex = /(\w+)\s*:\s*\{([^}]+)\}/g;
    let match = fieldRegex.exec(configStr);

    while (match !== null) {
        const fieldName = match[1];
        const fieldContent = match[2];

        const typeMatch = fieldContent.match(/type\s*:\s*['"](\w+)['"]/);
        const labelMatch = fieldContent.match(/label\s*:\s*['"]([^'"]+)['"]/);
        const defaultMatch = fieldContent.match(
            /default\s*:\s*(?:['"]([^'"]+)['"]|(\d+))/,
        );
        const optionsMatch = fieldContent.match(/options\s*:\s*\[([\s\S]*?)\]/);

        if (typeMatch && labelMatch) {
            const type = typeMatch[1] as FormItemType;
            const item: FormItem = {
                type,
                label: labelMatch[1],
            };

            if (defaultMatch) {
                item.default = defaultMatch[2]
                    ? Number.parseInt(defaultMatch[2], 10)
                    : defaultMatch[1];
            }

            if (optionsMatch && type === "select") {
                item.options = optionsMatch[1]
                    .split(",")
                    .map((option) => option.trim().replace(/['"]/g, ""))
                    .filter(Boolean);
            }

            config[fieldName] = item;
        }

        match = fieldRegex.exec(configStr);
    }

    return config;
}

export default function compileWidget(widgetCode: string): CompiledWidget {
    const metadata = parseMetadata(widgetCode);
    const configStr = extractConfigExport(widgetCode);
    const config = configStr ? parseConfigObject(configStr) : {};

    return {
        name: metadata.name,
        apiVersion: metadata.apiVersion,
        permissions: metadata.permissions as CompiledWidget["permissions"],
        config,
        code: widgetCode,
    };
}
