// @annotation: Full 鍦ㄨ繖閲屽苟鏃犲疄闄呬綔鐢紝鍙槸鐢ㄤ簬鎷撳睍涓€浜涢澶栧唴瀹癸紝鏃犻渶鑰冭檻锛孎ull<T> 鍙涓虹瓑浠蜂簬 T
import type { Widget } from "@/components/widget/type";
import type { Full } from "@/database/stash";
import type {
    AssistantMeta,
    BillFilter,
    BillFilterView,
    BillTagGroup,
    Budget,
    CustomCurrency,
    PersonalMeta,
    Scheduled,
    SettlementConfig,
    SettlementRecord,
} from "./extra-type";

export type {
    AssistantMeta,
    BillFilter,
    BillTagGroup,
    Budget,
    CustomCurrency,
    PersonalMeta,
    Scheduled,
    SettlementConfig,
    SettlementRecord,
};

export type BillType = "income" | "expense";
export type Amount = number;

export type GeoLocation = {
    latitude: number;
    longitude: number;
    accuracy: number;
};

export type Bill = {
    id: string;
    type: BillType;
    categoryId: string;
    creatorId: number | string;
    comment?: string;
    amount: Amount;
    time: number;
    images?: (File | string)[];
    location?: GeoLocation;
    tagIds?: string[];
    currency?: {
        base: string;
        target: string;
        amount: number;
    };
    extra?: {
        scheduledId?: string;
    };
};

export type BillCategory = {
    type: BillType;
    name: string;
    id: string;
    icon: string;
    color: string;
    customName?: boolean;
    parent?: string;
    // 榛樿閫変腑锛屼粎瀵瑰瓙绫荤敓鏁堬紝濡傛灉涓簍rue锛屽垯璇ュ瓙绫荤殑鐖剁被鍦ㄩ娆￠€変腑鏃讹紝棣栧厛浼氶€変腑璇ュ瓙绫伙紝鍐嶆鐐瑰嚮鐖剁被鍙互閫変腑鐖剁被
    defaultSelect?: boolean;
};

export type BillTag = {
    id: string;
    name: string;
    preferCurrency?: string;
};

export type GlobalMeta = {
    customFilters?: BillFilterView[];
    budgets?: Budget[];
    personal?: Record<string, PersonalMeta>;
    categories?: BillCategory[];
    tags: BillTag[];
    tagGroups?: BillTagGroup[];
    settlement?: SettlementConfig;
    settlementRecords?: SettlementRecord[];
    baseCurrency?: string;
    customCurrencies?: CustomCurrency[];
    quickCurrencies?: string[];
    widgets?: Widget[];
    assistant?: AssistantMeta;
    map?: {
        amapKey?: string;
        amapSecurityCode?: string;
    };
};

export type ExportedJSON = {
    items: Full<Bill>[];
    meta: GlobalMeta;
};
