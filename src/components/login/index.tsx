/** biome-ignore-all lint/a11y/noSvgWithoutTitle: decorative provider icon */
import { createPortal } from "react-dom";
import { useShallow } from "zustand/shallow";
import { useIntl } from "@/locale";
import { useIsLogin, useUserStore } from "@/store/user";

const loaded = import("@/api/storage");

const loadStorageAPI = async () => {
    const lib = await loaded;
    return lib.StorageAPI;
};

const primaryButtonStyle = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2`;

const secondaryButtonStyle = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 h-9 px-4 py-2 w-full`;

const betaClassName = `relative after:content-['beta'] after:rounded after:bg-yellow-400 after:px-[2px] after:text-[8px] after:block after:absolute after:top-0 after:right-0 after:translate-x-[calc(50%)]`;
const selfHostedGithubOnly =
    import.meta.env.VITE_SELF_HOST_GITHUB_ONLY === "true";
const disableOAuthLogin =
    selfHostedGithubOnly || import.meta.env.VITE_DISABLE_OAUTH_LOGIN === "true";

export default function Login() {
    const t = useIntl();
    const isLogin = useIsLogin();
    const [loading] = useUserStore(
        useShallow((state) => {
            return [state.loading];
        }),
    );

    if (isLogin) {
        return null;
    }

    return createPortal(
        <div className="fixed z-[1] top-0 right-0 w-screen h-screen overflow-hidden">
            <div className="absolute w-full h-full bg-[rgba(0,0,0,0.5)] z-[-1]"></div>
            <div className="w-full h-full flex justify-center items-center">
                <div className="bg-background w-[350px] min-h-[480px] flex flex-col gap-4 justify-center items-center rounded-lg overflow-hidden">
                    <Guide />
                    <div className="min-h-20 h-fit pb-4 flex flex-col gap-4">
                        {selfHostedGithubOnly && (
                            <div className="w-[302px] rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-950 dark:text-amber-100">
                                <div className="font-medium">
                                    {t("self-host-github-title")}
                                </div>
                                <div>{t("self-host-github-tip")}</div>
                                <div>
                                    {t("self-host-github-collaboration-tip")}
                                </div>
                            </div>
                        )}
                        {loading ? (
                            <div>
                                <i className="icon-[mdi--loading] animate-spin"></i>
                                {t("login")}
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col gap-1">
                                    {!disableOAuthLogin && (
                                        <button
                                            type="button"
                                            className={primaryButtonStyle}
                                            onClick={async () => {
                                                const StorageAPI =
                                                    await loadStorageAPI();
                                                StorageAPI.loginWith("github");
                                            }}
                                        >
                                            <i className="icon-[mdi--github]"></i>
                                            <div className="flex-1">
                                                {t("login-to-github")}
                                            </div>
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className={
                                            disableOAuthLogin
                                                ? primaryButtonStyle
                                                : "underline text-xs cursor-pointer"
                                        }
                                        onClick={async () => {
                                            const StorageAPI =
                                                await loadStorageAPI();
                                            StorageAPI.loginManuallyWith(
                                                "github",
                                            );
                                        }}
                                    >
                                        {disableOAuthLogin
                                            ? t("login-with-github-token")
                                            : t("or-use-an-exist-token")}
                                    </button>
                                    {disableOAuthLogin && (
                                        <div className="max-w-[302px] text-center text-xs text-muted-foreground">
                                            {t("self-host-github-token-tip")}
                                        </div>
                                    )}
                                </div>
                                {!selfHostedGithubOnly && (
                                    <>
                                        <div className="flex flex-col gap-1">
                                            <button
                                                type="button"
                                                className={`${primaryButtonStyle} !bg-[#b7312d] !hover:bg-[#b7312d]/80`}
                                                onClick={async () => {
                                                    const StorageAPI =
                                                        await loadStorageAPI();
                                                    StorageAPI.loginWith(
                                                        "gitee",
                                                    );
                                                }}
                                            >
                                                <svg
                                                    fill="currentColor"
                                                    width="32"
                                                    height="32"
                                                    viewBox="0 0 24 24"
                                                    role="img"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                >
                                                    <path d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.592.593v1.482a.594.594 0 0 1-.593.592H9.777c-.982 0-1.778.796-1.778 1.778v5.63c0 .327.266.592.593.592h5.63c.982 0 1.778-.796 1.778-1.778v-.296a.593.593 0 0 0-.592-.593h-4.15a.592.592 0 0 1-.592-.592v-1.482a.593.593 0 0 1 .593-.592h6.815c.327 0 .593.265.593.592v3.408a4 4 0 0 1-4 4H5.926a.593.593 0 0 1-.593-.593V9.778a4.444 4.444 0 0 1 4.445-4.444h8.296z" />
                                                </svg>
                                                <div className="flex-1">
                                                    {t("login-to-gitee")}
                                                </div>
                                            </button>
                                            <button
                                                type="button"
                                                className="underline text-xs cursor-pointer"
                                                onClick={async () => {
                                                    const StorageAPI =
                                                        await loadStorageAPI();
                                                    StorageAPI.loginManuallyWith(
                                                        "gitee",
                                                    );
                                                }}
                                            >
                                                {t("or-use-an-exist-token")}
                                            </button>
                                        </div>
                                        <div>
                                            <button
                                                type="button"
                                                className={`${secondaryButtonStyle} ${betaClassName}`}
                                                onClick={async () => {
                                                    const StorageAPI =
                                                        await loadStorageAPI();
                                                    StorageAPI.loginWith(
                                                        "webdav",
                                                    );
                                                }}
                                            >
                                                <i className="icon-[mdi--floppy-disk]"></i>
                                                <div className="flex-1">
                                                    Web DAV
                                                </div>
                                            </button>
                                        </div>
                                        <div>
                                            <button
                                                type="button"
                                                className={`${secondaryButtonStyle} ${betaClassName}`}
                                                onClick={async () => {
                                                    const StorageAPI =
                                                        await loadStorageAPI();
                                                    StorageAPI.loginWith("s3");
                                                }}
                                            >
                                                <i className="icon-[mdi--database]"></i>
                                                <div className="flex-1">S3</div>
                                            </button>
                                        </div>
                                        <div>
                                            <button
                                                type="button"
                                                className={`${secondaryButtonStyle} !w-full`}
                                                onClick={async () => {
                                                    const StorageAPI =
                                                        await loadStorageAPI();
                                                    StorageAPI.loginWith(
                                                        "offline",
                                                    );
                                                }}
                                            >
                                                <i className="icon-[mdi--local]"></i>
                                                <div className="flex-1">
                                                    {t("offline-mode")}
                                                </div>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}

function Guide() {
    const t = useIntl();
    return (
        <div
            className={
                "w-full p-4 flex-1 border-b bg-stone-800 text-white flex flex-col items-center justify-center gap-4 relative"
            }
        >
            <h1 className="text-3xl font-bold">{t("APP_NAME")}</h1>
            <p className="text-sm text-center">{t("app-introduce")}</p>
            <div className="text-xs opacity-60">{t("pwa-install-tip")}</div>
            <a
                className="absolute bottom-4 right-4 text-xs opacity-60 underline"
                target="_blank"
                href="https://glink25.github.io/post/Cent---%E4%BD%A0%E5%8F%AF%E8%83%BD%E5%8F%AA%E9%9C%80%E8%A6%81%E4%B8%80%E4%B8%AA%E8%AE%B0%E8%B4%A6%E8%BD%AF%E4%BB%B6/"
                rel="noopener"
            >
                {t("see-introduce")}
            </a>
        </div>
    );
}
