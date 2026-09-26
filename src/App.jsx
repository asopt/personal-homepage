import { useEffect, useRef, useState } from "react";
import siteConfig from "../data/site-config.json";

// 首页公开配置、随机一言与访客网络信息的服务端接口地址。
const CONFIG_API = "/api/config";
const HITOKOTO_API = "https://international.v1.hitokoto.cn/?encode=json&max_length=";
const GEO_API = "https://api.ip.sb/geoip";

/** 按当前配置结构规范化首页数据，并约束一言最大长度。 */
function normalize(value) {
    const next = { ...siteConfig, ...(value || {}) };
    next.sites = Array.isArray(value?.sites) ? value.sites : [];
    next.contacts = Array.isArray(value?.contacts) ? value.contacts : [];
    next.showContacts = value?.showContacts !== false;
    next.headerLinks = Array.isArray(value?.headerLinks) ? value.headerLinks : [];
    next.heroImage = value?.heroImage || "/alice.png";
    next.showHeroImage = value?.showHeroImage !== false;
    next.heroLayersEnabled = value?.heroLayersEnabled !== false;
    next.hitokotoMaxLength = Math.min(100, Math.max(10, Number(next.hitokotoMaxLength) || 42));
    return next;
}

/** 请求站点配置，并在 HTTP 错误时给出适合页面展示的中文错误。 */
async function getConfig(password = "") {
    const res = await fetch(CONFIG_API, {
        headers: password ? { "x-admin-password": password } : {},
        cache: "no-store",
    });
    if (!res.ok) throw new Error(res.status === 401 ? "管理密码错误" : "配置读取失败");
    return normalize(await res.json());
}

/** 将配置中的动态页面标题同步到当前文档。 */
function Meta({ config }) {
    useEffect(() => {
        document.title = config.pageTitle || "Kiries";
    }, [config.pageTitle]);

    return null;
}

/** 根据配置绘制首页标识；文字模式显示呼吸点，图标模式显示图标和文字。 */
function Brand({ config, href = "#top" }) {
    return (
        <a className="brand" href={href}>
            {config.brandMode !== "favicon" && <i className="brand-mark" aria-hidden="true" />}
            {config.brandMode === "favicon" ? (
                <img className="brand-icon" src={config.favicon} alt="" />
            ) : null}
            <span className="brand-text">{config.brandMark || config.name}</span>
        </a>
    );
}

/** 加载外部图标，并在图片失败时显示文字标记。 */
function IconImage({ src, fallback }) {
    const [failed, setFailed] = useState(false);

    useEffect(() => setFailed(false), [src]);

    if (failed) return <span className="entry-letter">{fallback || "·"}</span>;
    return <img className="icon-image" src={src} alt="" onError={() => setFailed(true)} />;
}

/** 根据入口的图标模式渲染图片或文字图标。 */
function EntryIcon({ item }) {
    if (item.iconMode === "url" && item.iconUrl)
        return <IconImage src={item.iconUrl} fallback={item.mark} />;
    return <span className="entry-letter">{item.mark || "·"}</span>;
}

/** 按随机一言开关生成加载态或默认文案初始状态；config 为站点配置。 */
function createQuoteState(config) {
    const useHitokoto = config.enableHitokoto;
    return {
        useHitokoto,
        text: useHitokoto ? "" : config.defaultIntro,
        from: useHitokoto ? "" : "— Kiries",
        isDefault: !useHitokoto,
    };
}

/** 获取随机一言；启用时请求失败保持空白，不回退显示默认文案。 */
function Quote({ config }) {
    const [quote, setQuote] = useState(() => createQuoteState(config));

    useEffect(() => {
        if (!quote.useHitokoto) return;

        const controller = new AbortController();

        fetch(`${HITOKOTO_API}${config.hitokotoMaxLength}`, { signal: controller.signal })
            .then((r) => r.json())
            .then((d) => {
                if (d.hitokoto) {
                    setQuote({
                        useHitokoto: false,
                        text: d.hitokoto,
                        from: d.from ? `— ${d.from}` : "",
                        isDefault: false,
                    });
                    return;
                }
                setQuote({
                    useHitokoto: false,
                    text: "",
                    from: "",
                    isDefault: false,
                });
            })
            .catch((error) => {
                if (error.name === "AbortError") return;
                setQuote({
                    useHitokoto: false,
                    text: "",
                    from: "",
                    isDefault: false,
                });
            });

        return () => controller.abort();
    }, [config.enableHitokoto, config.hitokotoMaxLength, config.defaultIntro, quote.useHitokoto]);

    return (
        <div
            className={`quote-slot ${quote.text ? "ready" : "loading"} ${quote.isDefault ? "default" : ""}`}
        >
            {quote.text && (
                <div className="quote-copy">
                    <p>{quote.text}</p>
                    {quote.from && <small>{quote.from}</small>}
                </div>
            )}
        </div>
    );
}

/** 查询并显示当前访问者的公开 IP 与网络区域信息。 */
function Visitor() {
    const [geo, setGeo] = useState({ data: null, loaded: false });

    useEffect(() => {
        const controller = new AbortController();
        let alive = true;

        fetch(GEO_API, { signal: controller.signal })
            .then((r) => {
                if (!r.ok) throw new Error("geo lookup failed");
                return r.json();
            })
            .then((next) => {
                if (alive) setGeo({ data: next, loaded: true });
            })
            .catch((error) => {
                if (alive && error.name !== "AbortError") setGeo({ data: null, loaded: true });
            });

        return () => {
            alive = false;
            controller.abort();
        };
    }, []);

    if (!geo.loaded) return null;

    const { data } = geo;

    const region = data
        ? [data.city, data.region, data.country].filter(Boolean).slice(0, 2).join(", ")
        : "定位中";

    return (
        <div className="visitor-bar">
            <span className="visitor-surface" aria-hidden="true" />
            <div className="visitor-content">
                <span className="visitor-globe">◎</span>
                <span className="visitor-label">Your IP:</span>
                <strong className="visitor-ip">{data?.ip || "…"}</strong>
                <b className="visitor-sep-region">|</b>
                <span className="visitor-region">{region}</span>
                <b className="visitor-sep-asn">|</b>
                <span className="visitor-asn">
                    {data?.asn
                        ? `AS${data.asn} · ${data.asn_organization || data.organization || ""}`
                        : "ASN · …"}
                </span>
                <span className="visitor-country">{data?.country || "定位中"}</span>
            </div>
        </div>
    );
}

/** 将开始时间与当前时间的差值格式化为运行时长。 */
function formatUptime(start, now) {
    const elapsed = Math.max(0, Math.floor((now - new Date(start).getTime()) / 1000));
    const days = Math.floor(elapsed / 86400);
    const hours = Math.floor((elapsed % 86400) / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;

    return `本站已运行${days}天${hours}时${minutes}分${seconds}秒`;
}

/** 按秒刷新并显示网站持续运行时间。 */
function Uptime({ start }) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    return <span className="site-uptime">{formatUptime(start, now)}</span>;
}

/** 按主页配置显示插画与可选彩色层，并绑定平滑视差；config 为当前站点配置。 */
function HeroArtwork({ config }) {
    const artworkRef = useRef(null);
    const targetRef = useRef({ x: 0, y: 0 });
    const positionRef = useRef({ x: 0, y: 0 });
    const lastTimeRef = useRef(0);
    const frameRef = useRef(0);

    useEffect(() => {
        const artwork = artworkRef.current;
        if (!artwork || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const render = (now) => {
            frameRef.current = 0;
            const target = targetRef.current;
            const position = positionRef.current;
            const delta = Math.min(50, lastTimeRef.current ? now - lastTimeRef.current : 16.67);
            const follow = 1 - Math.exp(-delta / 360);
            position.x += (target.x - position.x) * follow;
            position.y += (target.y - position.y) * follow;
            lastTimeRef.current = now;

            const { innerWidth, innerHeight } = window;
            artwork.style.setProperty("--art-main-x", `${-0.03 * position.x * innerWidth}px`);
            artwork.style.setProperty("--art-main-y", `${-0.03 * position.y * innerHeight}px`);
            artwork.style.setProperty("--art-image-x", `${13.5 * position.x}px`);
            artwork.style.setProperty("--art-image-y", `${-0.04 * position.y}px`);
            artwork.style.setProperty("--art-pink-x", `${72 * position.x}px`);
            artwork.style.setProperty("--art-pink-y", `${-36 * position.x}px`);
            artwork.style.setProperty("--art-blue-x", `${36 * position.x}px`);
            artwork.style.setProperty("--art-blue-y", `${-18 * position.x}px`);
            if (Math.abs(target.x - position.x) > 0.0005 || Math.abs(target.y - position.y) > 0.0005) {
                frameRef.current = requestAnimationFrame(render);
            }
        };

        const schedule = () => {
            if (!frameRef.current) frameRef.current = requestAnimationFrame(render);
        };
        const handlePointerMove = (event) => {
            const next = {
                x: (event.clientX - window.innerWidth / 2) / window.innerWidth,
                y: (event.clientY - window.innerHeight / 2) / window.innerHeight,
            };
            targetRef.current = next;
            schedule();
        };
        const reset = () => {
            targetRef.current = { x: 0, y: 0 };
            schedule();
        };

        window.addEventListener("pointermove", handlePointerMove, { passive: true });
        window.addEventListener("blur", reset);
        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("blur", reset);
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
            lastTimeRef.current = 0;
        };
    }, []);

    if (!config.showHeroImage || !config.heroImage) return null;

    return (
        <div
            className="hero-artwork"
            ref={artworkRef}
            style={{ "--art-image": `url(${JSON.stringify(config.heroImage)})` }}
            aria-hidden="true"
        >
            <div className="hero-art-main">
                {config.heroLayersEnabled && (
                    <>
                        <div className="hero-art-layer hero-art-blue" />
                        <div className="hero-art-layer hero-art-pink" />
                    </>
                )}
                <img className="hero-art-layer hero-art-image" src={config.heroImage} alt="" />
            </div>
        </div>
    );
}

/** 根据站点 JSON 配置渲染首页logo、快捷入口和页脚。 */
function Home({ config }) {
    const bg = config.enableBackgroundImage && config.backgroundImage;

    return (
        <main
            className={bg ? "custom-bg" : ""}
            style={{
                "--bg-image": bg ? `url(${JSON.stringify(bg)})` : "none",
            }}
        >
            <Meta config={config} />
            <header className="site-header">
                <Brand config={config} />
                <div className="header-actions">
                    <nav className="header-links" aria-label="快捷站点">
                        {config.headerLinks
                            .filter((link) => link.enabled !== false && link.href)
                            .map((link) => (
                                <a
                                    href={link.href}
                                    key={`${link.label}-${link.href}`}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {link.label}
                                </a>
                            ))}
                    </nav>
                    <a className="admin-link" href="/admin" aria-label="管理后台" title="管理后台">
                        ✦
                    </a>
                </div>
            </header>

            <section className="hero">
                <HeroArtwork config={config} />
                <div className="hero-content">
                    <div className="profile-avatar">
                        <img src={config.avatar} alt="" />
                    </div>
                    <p className="eyebrow">{config.eyebrow}</p>
                    <h1>
                        {config.name}
                        <span>{config.Alias}</span>
                    </h1>
                    <Quote
                        key={`${config.enableHitokoto}-${config.hitokotoMaxLength}-${config.defaultIntro}`}
                        config={config}
                    />
                    <div className="status">
                        <i />
                        {config.status}
                    </div>
                    {config.showContacts && (
                        <div className="social-links">
                            {config.contacts
                                .filter((x) => x.enabled !== false && x.url)
                                .map((x) => (
                                    <a className="social-link" href={x.url} key={x.url}>
                                        <EntryIcon item={x} />
                                    </a>
                                ))}
                        </div>
                    )}
                </div>
            </section>

            {config.showSites && (
                <section className="links-section" id="links">
                    <p className="section-kicker">{config.siteKicker}</p>
                    <h2>{config.siteTitle}</h2>
                    <p>{config.siteDescription}</p>
                    <div className="site-grid">
                        {config.sites
                            .filter((x) => x.enabled !== false && x.href)
                            .map((x) => (
                                <a
                                    className={`site-card ${x.tone}`}
                                    href={x.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    key={x.href}
                                >
                                    <span className="site-mark">
                                        <EntryIcon item={x} />
                                    </span>
                                    <span>
                                        <strong>{x.name}</strong>
                                        <small>{x.description}</small>
                                    </span>
                                </a>
                            ))}
                    </div>
                </section>
            )}

            <footer className="site-footer">
                <span className="site-copyright">
                    © {new Date().getFullYear()}{" "}
                    <strong>
                        <a href={config.footerUrl} className="copyright-link" target="_blank" rel="noreferrer">
                            {config.footerName}
                        </a>
                    </strong>
                </span>
                <Uptime start={config.siteStartedAt} />
            </footer>

            <Visitor />
        </main>
    );
}

/** 读取公开配置并挂载首页应用的根组件。 */
export function App() {
    const [config, setConfig] = useState(null);

    useEffect(() => {
        getConfig()
            .then(setConfig)
            .catch(() => setConfig(normalize(siteConfig)));
    }, []);

    return config ? <Home config={config} /> : <main className="config-loading" aria-busy="true" />;
}
