import type { Bill, BillType } from "./type";

/** 鏍囩缁勫彲浠ュ揩鎹锋敹绾虫爣绛撅紝鍙互鐣ヨ繃
 */
export type BillTagGroup = {
    name: string;
    id: string;
    color: string;
    /** 鏄惁鍗曢€夛紝寮€鍚悗璇ユ爣绛剧粍鏈€澶氬彧鑳介€変腑涓€涓?*/
    singleSelect?: boolean;
    /** 鏄惁蹇呴€夛紝寮€鍚悗璇ユ爣绛剧粍蹇呴』閫夋嫨涓€涓紙榛樿閫夋嫨绗竴涓爣绛撅級 */
    required?: boolean;
    tagIds?: string[];
};

/**
 * 棰勭畻锛屼笉闇€瑕佽浆鎹㈤绠楋紝鍙互鐣ヨ繃
 */
export type Budget = {
    id: string;
    title: string;
    start: number;
    end?: number;
    repeat: {
        unit: "week" | "day" | "month" | "year";
        value: number;
    };
    joiners: (string | number)[];
    totalBudget: number;
    categoriesBudget?: {
        id: string;
        budget: number;
    }[];
    onlyTags?: string[];
    excludeTags?: string[];
};

/**
 * 杩囨护鍣紝涓嶉渶瑕佽浆鎹紝鍙互鐣ヨ繃
 */
export type BillFilter = Partial<{
    ids: string[];
    comment: string;
    recent?: {
        value: number;
        unit: "year" | "month" | "week" | "day";
    };
    start: number;
    end: number;
    type: BillType | undefined;
    creators: (string | number)[];
    categories: string[];
    minAmountNumber: number;
    maxAmountNumber: number;
    assets?: boolean;
    scheduled?: boolean;
    tags?: string[];
    excludeTags?: string[];
    baseCurrency: string;
    currencies?: string[];
}>;

export type BillFilterViewModule =
    | "base-analysis" // BaseAnalysis 妯″潡锛岃繖涓ā鍧楀繀椤昏鍖呭惈鍦ㄥ唴
    | "top-words" // AnalysisCloud 楂橀璇嶄簯灞曠ず妯″潡
    | "map" // AnalysisMap 鍦板浘妯″潡
    | "analysis" // AnalysisDetail 绠€鏄撳垎鏋愭ā鍧?
    | "top-expense" // 鏈€楂樻敮鍑烘ā鍧?
    | "top-income" // 鏈€楂樻敹鍏ユā鍧?
    | `widget-${string}`; // Widget 缁勪欢

export type BillFilterView = {
    id: string;
    filter: BillFilter;
    name: string;
    displayCurrency?: string;
    modules?: BillFilterViewModule[];
};

export type SettlementConfig = {
    memberAId?: string | number;
    memberBId?: string | number;
    homeTagId?: string;
    memberATagId?: string;
    memberBTagId?: string;
    tagGroupId?: string;
};

export type SettlementRecord = {
    id: string;
    periodKey: string;
    start: number;
    end: number;
    memberAId: string;
    memberBId: string;
    payerId: string;
    receiverId: string;
    amount: number;
    settledAt: number;
    note?: string;
};

/** 鍛ㄦ湡璁拌处閰嶇疆 */
export type Scheduled = {
    id: string;
    title: string;
    start: number;
    end?: number;
    template: Omit<Bill, "id" | "creatorId">;
    enabled?: boolean;
    repeat: {
        unit: "week" | "day" | "month" | "year";
        value: number;
    };
    // 鏈€鏂颁竴鏉¤嚜鍔ㄨ璐﹁褰曠殑鏃堕棿
    latest?: number;
};

// AI閰嶇疆绫诲瀷
export type AIConfig = {
    id: string;
    name: string;
    apiKey: string; // base64 encoded
    apiUrl: string;
    model: string;
    apiType: "open-ai-compatible" | "google-ai-studio"; // 鏀寔OpenAI鍏煎鍜孏oogle AI Studio涓ょAPI鏍煎紡
};

export type AssistantMeta = {
    bigmodel?: {
        apiKey?: string;
    };
    configs?: AIConfig[];
    defaultConfigId?: string;
};

// 涓汉閰嶇疆锛屼笉闇€瑕佽浆鎹紝鍙互鐣ヨ繃
export type PersonalMeta = {
    names?: Record<string, string>;
    rates?: Record<string, number>;
    tagGroups?: BillTagGroup[];
    settlement?: SettlementConfig;
    homeWidgets?: string[];
    scheduleds?: Scheduled[];
    customCSS?: string;
    assistant?: AssistantMeta;
};

export type CustomCurrency = {
    id: string;
    name: string;
    symbol: string;
    rateToBase: number;
};
