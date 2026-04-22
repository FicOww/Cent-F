import { useMemo } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/utils";
import ComplexAddButton from "./add-button";
import { goAddBill } from "./bill-editor";
import { afterAddBillPromotion } from "./promotion";
import { showSettings } from "./settings";

export default function Navigation() {
    const location = useLocation();
    const navigate = useNavigate();
    const { theme, toggle } = useTheme();

    const currentTab = useMemo(() => {
        return ["/stat", "/settlement", "/", "/search"].find(
            (x) => location.pathname === x,
        );
    }, [location.pathname]);

    const switchTab = (value: "/" | "/stat" | "/settlement" | "/search") => {
        navigate(`${value}`);
    };

    const isDarkTheme = (() => {
        if (theme === "dark") {
            return true;
        }
        if (theme === "light") {
            return false;
        }
        return window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    })();

    return createPortal(
        <div
            className="floating-tab fixed w-screen h-18 flex items-center justify-around sm:h-screen
         sm:w-18 sm:flex-col sm:justify-start z-[0] 
         bottom-[calc(.25rem+env(safe-area-inset-bottom))]
         sm:top-[env(safe-area-inset-top)] sm:left-[calc(.25rem+env(safe-area-inset-left))]"
        >
            {/* search */}
            <button
                type="button"
                className={`w-14 h-14 sm:w-10 sm:h-10 cursor-pointer flex items-center justify-center rounded-full shadow-md m-2 transition-all hover:bg-[#9a9ba2] active:bg-[#cdcdd0] dark:hover:bg-[#aba8a5] ${
                    currentTab === "/search"
                        ? "bg-[#cdcdd0] dark:bg-[#918c89]"
                        : "bg-background dark:bg-stone-500"
                }`}
                onClick={() => switchTab("/search")}
            >
                <i className="icon-[mdi--search] size-5"></i>
            </button>

            {/* middle group */}
            <div className="flex items-center rounded-full p-1 bg-background dark:bg-stone-500 w-68 h-14 m-2 shadow-md sm:flex-col sm:w-10 sm:h-64 sm:-order-1">
                <button
                    type="button"
                    className={`flex-1 h-full w-full transition rounded-full flex items-center justify-center cursor-pointer hover:bg-[#9a9ba2] active:bg-[#cdcdd0] ${
                        currentTab === "/" ? "bg-foreground/20" : ""
                    }`}
                    onClick={() => switchTab("/")}
                >
                    <i className="icon-[mdi--format-align-center] size-5"></i>
                </button>

                <ComplexAddButton
                    onClick={() => {
                        void goAddBill()
                            .then(() => {
                                navigate("/");
                            })
                            .catch(() => undefined);
                        afterAddBillPromotion();
                    }}
                />

                <button
                    type="button"
                    className={`flex-1 h-full w-full transition-all rounded-full flex items-center justify-center cursor-pointer hover:bg-[#9a9ba2] active:bg-[#cdcdd0] ${
                        currentTab === "/stat" ? "bg-foreground/20" : ""
                    }`}
                    onClick={() => switchTab("/stat")}
                >
                    <i className="icon-[mdi--chart-box-outline] size-5"></i>
                </button>

                <button
                    type="button"
                    className={`flex-1 h-full w-full transition-all rounded-full flex items-center justify-center cursor-pointer hover:bg-[#9a9ba2] active:bg-[#cdcdd0] ${
                        currentTab === "/settlement" ? "bg-foreground/20" : ""
                    }`}
                    onClick={() => switchTab("/settlement")}
                >
                    <i className="icon-[mdi--scale-balance] size-5"></i>
                </button>
            </div>

            {/* theme */}
            <button
                type="button"
                title="Toggle theme"
                className="w-14 h-14 sm:w-10 sm:h-10 cursor-pointer flex items-center justify-center rounded-full shadow-md m-2 transition-all hover:bg-[#9a9ba2] active:bg-[#cdcdd0] bg-background dark:bg-stone-500 dark:hover:bg-[#aba8a5]"
                onClick={toggle}
            >
                <i
                    className={cn(
                        "size-5",
                        isDarkTheme
                            ? "icon-[mdi--weather-sunny]"
                            : "icon-[mdi--weather-night]",
                    )}
                ></i>
            </button>

            {/* settings */}
            <button
                type="button"
                className="w-14 h-14 sm:w-10 sm:h-10 cursor-pointer flex items-center justify-center rounded-full shadow-md m-2 transition-all hover:bg-[#9a9ba2] active:bg-[#cdcdd0] bg-background dark:bg-stone-500 dark:hover:bg-[#aba8a5]"
                onClick={() => {
                    showSettings();
                }}
            >
                <i className="icon-[mdi--more-horiz] size-5"></i>
            </button>
        </div>,
        document.body,
    );
}
