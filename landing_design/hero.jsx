// Уместно — Hero variants (Editorial moodboard is the canonical version)

const HeroSplit = () =>
<section className="u-hero u-hero--editorial2" data-screen-label="01 Hero">
    <div className="u-container">
      <div className="u-hero__layout">
        <div className="u-hero__copy">
          <div className="u-hero__eyebrow">
            <span className="lbl">Конфигуратор хранения · Уместно</span>
          </div>
          <h1>
            Соберём готовую схему хранения под <em>нужные размеры</em>
          </h1>

          <p className="u-hero__lead">
            Введите размеры места хранения и выберите, что хотите хранить.
            Уместно рассчитает конфигурацию, покажет схему раскладки
            и подскажет, какие блоки подойдут.
          </p>

          <ul className="u-hero__bullets">
            <li><span className="bul" aria-hidden>—</span>без долгого поиска</li>
            <li><span className="bul" aria-hidden>—</span>без тестовых раскладок на полу</li>
            <li><span className="bul" aria-hidden>—</span>без случайных покупок и возвратов</li>
          </ul>

          <div className="u-hero__ctas">
            <button className="u-btn u-btn--sage u-btn--lg">
              Начать расчёт
              <Icon name="arrow-right" size={16} />
            </button>
            <button className="u-btn u-btn--ghost u-btn--lg">Посмотреть пример</button>
          </div>

          <div className="u-hero__trust">
            <span><Icon name="check-circle" size={14} />149&nbsp;₽ один раз</span>
            <span><Icon name="check-circle" size={14} />Без подписок</span>
            <span><Icon name="check-circle" size={14} />Файл на почту</span>
          </div>
        </div>

        <div className="u-hero__visual">
          <figure className="u-hero__photo">
            <img src="assets/hero-drawer-v2.png" alt="Аккуратно собранный ящик с органайзерами и схемой раскладки" />
            <figcaption className="u-hero__caption">
              <span className="dot"></span>
              Пример готовой схемы
            </figcaption>
          </figure>

          <aside className="u-hero__price u-hero__price--sage">
            <div className="u-hero__price-row">
              <div className="u-hero__price-lbl">Полная схема расчёта</div>
              <div className="u-hero__price-amt">149&nbsp;₽</div>
            </div>
            <div className="u-hero__price-sub">
              без скрытых платежей и подписок
            </div>
          </aside>
        </div>
      </div>
    </div>
  </section>;


const HeroWizard = () =>
<section className="u-hero u-hero--wizard" data-screen-label="01 Hero · Wizard">
    <div className="u-container">
      <div className="u-hero__steps">
        {[{ n: 1, l: 'Размеры' }, { n: 2, l: 'Что хранить' }, { n: 3, l: 'Получить схему' }].map((s, i) =>
      <div key={s.n} className={`u-step ${i === 0 ? 'active' : ''}`}>
            <div className="dot">{s.n}</div>
            <div className="label">{s.n}. {s.l}</div>
          </div>
      )}
      </div>

      <div className="u-hero__grid">
        <div className="u-card" style={{ padding: 40 }}>
          <div className="u-eyebrow" style={{ marginBottom: 14 }}>Шаг 1 из 3</div>
          <h1 className="u-display">Подберём хранение под ваш ящик за 2–3 минуты</h1>
          <ul className="u-hero__bullets" style={{ margin: '18px 0 22px' }}>
            <li>без долгого поиска</li>
            <li>без тестовых раскладок на полу</li>
            <li>без случайных покупок</li>
          </ul>

          <div style={{ marginBottom: 8, fontSize: 'var(--fs-xs)', color: 'var(--u-ink-3)', fontWeight: 500 }}>Тип пространства</div>
          <div className="u-segmented" style={{ marginBottom: 20 }}>
            {['Ящик', 'Полка', 'Секция'].map((opt, i) =>
          <button key={opt} className={i === 0 ? 'active accent' : ''}>
                <Icon name={opt === 'Ящик' ? 'box' : opt === 'Полка' ? 'grid' : 'home'} size={16} />{opt}
              </button>
          )}
          </div>

          <div className="u-config__row" style={{ marginBottom: 18 }}>
            <div className="u-field"><label>Ширина, см</label><input className="u-input" defaultValue="80" /></div>
            <div className="u-field"><label>Глубина, см</label><input className="u-input" defaultValue="45" /></div>
            <div className="u-field"><label>Высота, см</label><input className="u-input" defaultValue="15" /></div>
          </div>

          <button className="u-btn u-btn--accent u-btn--lg" style={{ width: '100%' }}>
            Продолжить — далее за 149 ₽
            <Icon name="arrow-right" size={16} />
          </button>
        </div>

        <div className="u-hero__right">
          <div className="u-hero__art">
            <img src="assets/drawer-hero.png" alt="Пример аккуратной конфигурации" />
          </div>
          <div className="u-hero__price-banner">
            <div className="price">Полная схема за <em>149 ₽</em></div>
            <div className="sub"><Icon name="check-circle" size={16} />Без подписок</div>
          </div>
        </div>
      </div>
    </div>
  </section>;


const HeroEditorial = () =>
<section className="u-hero u-hero--editorial" data-screen-label="01 Hero · Editorial">
    <div className="u-container">
      <div className="u-hero__frame">
        <img src="assets/drawer-hero.png" alt="Аккуратно собранный ящик" />
        <div className="u-hero__overlay">
          <div className="u-hero__copy">
            <div className="u-eyebrow" style={{ marginBottom: 14 }}>Конфигуратор хранения</div>
            <h1 className="u-display">Соберём схему хранения <em>под ваш ящик</em></h1>
            <ul className="u-hero__bullets" style={{ margin: '18px 0 22px' }}>
              <li>без долгого поиска</li>
              <li>без тестовых раскладок на полу</li>
              <li>без случайных покупок и возвратов</li>
            </ul>
            <p style={{ color: 'var(--u-ink-2)', fontSize: 'var(--fs-sm)', margin: '0 0 24px', maxWidth: 420 }}>
              Введите размеры и выберите, что хранить — мы рассчитаем конфигурацию и подскажем блоки.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="u-btn u-btn--accent u-btn--lg">Начать расчёт — 149 ₽<Icon name="arrow-right" size={16} /></button>
              <button className="u-btn u-btn--link">Посмотреть пример</button>
            </div>
          </div>
          <div className="u-hero__quote">
            «Полная схема расчёта за 149 ₽ — без скрытых платежей и подписок.»
          </div>
        </div>
      </div>
    </div>
  </section>;


window.HeroSplit = HeroSplit;
window.HeroWizard = HeroWizard;
window.HeroEditorial = HeroEditorial;

// ── Hero · Poster ─────────────────────────────────────────
// Типографика-доминанта: огромный h1, маленькое фото-карточка в углу
const HeroPoster = () =>
<section className="u-hero u-hero--poster" data-screen-label="01 Hero · Poster">
    <div className="u-container">
      <div className="u-hero__poster">
        <div className="u-hero__poster-meta">
          <span>N° 01</span>
          <span className="rule"></span>
          <span>Конфигуратор хранения</span>
        </div>

        <h1 className="u-hero__poster-title">
          Готовая схема <em>хранения</em><br />
          под нужные <em>размеры</em>
        </h1>

        <div className="u-hero__poster-foot">
          <div className="u-hero__poster-lede">
            Введите размеры пространства и выберите, что хотите хранить — Уместно соберёт конфигурацию и подскажет, какие блоки подойдут.
          </div>

          <div className="u-hero__poster-actions">
            <button className="u-btn u-btn--sage u-btn--lg">
              Начать расчёт
              <Icon name="arrow-right" size={16} />
            </button>
            <div className="u-hero__poster-price">
              <span className="amt">149&nbsp;₽</span>
              <span className="sub">один раз. без подписок.</span>
            </div>
          </div>
        </div>

        <figure className="u-hero__poster-shot">
          <img src="assets/hero-drawer-v2.png" alt="Пример готовой схемы хранения" />
          <figcaption>Fig. 01 — пример готовой схемы</figcaption>
        </figure>
      </div>
    </div>
  </section>;


// ── Hero · Cover ─────────────────────────────────────────
// Full-bleed magazine cover: фото на весь блок, текст поверх
const HeroCover = () =>
<section className="u-hero u-hero--cover" data-screen-label="01 Hero · Cover">
    <div className="u-hero__cover-frame">
      <img src="assets/hero-drawer-v2.png" alt="Аккуратно собранный ящик с органайзерами" className="u-hero__cover-img" />
      <div className="u-hero__cover-overlay"></div>

      <div className="u-hero__cover-meta">
        <span>Конфигуратор хранения</span>
        <span className="dot">·</span>
        <span>Уместно</span>
        <span className="num">N° 01</span>
      </div>

      <div className="u-hero__cover-body">
        <div className="u-hero__cover-eyebrow">— выпуск 2026 —</div>
        <h1 className="u-hero__cover-title">
          Готовая схема<br />
          хранения <em>под ваш ящик</em>
        </h1>
        <p className="u-hero__cover-lede">
          Введите размеры. Выберите, что хранить. Получите схему и подобранные блоки за 2-3 минуты.
        </p>
        <div className="u-hero__cover-actions">
          <button className="u-btn u-btn--accent u-btn--lg">
            Начать расчёт — 149 ₽
            <Icon name="arrow-right" size={16} />
          </button>
          <span className="trust">Без подписок · файл на почту</span>
        </div>
      </div>

      <aside className="u-hero__cover-mark">
        <span className="label">Цена</span>
        <span className="num">149<small>₽</small></span>
      </aside>
    </div>
  </section>;


window.HeroPoster = HeroPoster;
window.HeroCover = HeroCover;

// ── Hero · Annotated ─────────────────────────────────────
// Фото с editorial-аннотациями: тонкие линии указывают на зоны
// хранения, лейблы — как в музейном каталоге / тех.документации.
const HeroAnnotated = () =>
<section className="u-hero u-hero--annot" data-screen-label="01 Hero · Annotated">
    <div className="u-container">
      <div className="u-hero__annot-head">
        <div className="u-hero__annot-eyebrow">
          <span>N° 01</span>
          <span className="rule"></span>
          <span>Конфигуратор хранения</span>
        </div>
        <h1 className="u-hero__annot-title">
          Соберём готовую схему хранения <em>под ваш ящик</em>
        </h1>
      </div>

      <div className="u-hero__annot-stage">
        <figure className="u-hero__annot-figure">
          <img src="assets/hero-drawer-v2.png" alt="Аккуратно собранный ящик с органайзерами и схемой раскладки" />

          <svg className="u-hero__annot-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line x1="28" y1="36" x2="-2" y2="20" />
            <line x1="62" y1="28" x2="98" y2="14" />
            <line x1="78" y1="62" x2="102" y2="76" />
            <line x1="34" y1="74" x2="-2" y2="86" />
          </svg>

          <div className="u-hero__annot-label u-hero__annot-label--tl">
            <div className="num">Fig. 01</div>
            <div className="cap">Повседневные · открытые секции</div>
          </div>
          <div className="u-hero__annot-label u-hero__annot-label--tr">
            <div className="num">Fig. 02</div>
            <div className="cap">Бельё · вертикальные слоты</div>
          </div>
          <div className="u-hero__annot-label u-hero__annot-label--br">
            <div className="num">Fig. 03</div>
            <div className="cap">Аксессуары · ячейки 4×4</div>
          </div>
          <div className="u-hero__annot-label u-hero__annot-label--bl">
            <div className="num">Fig. 04</div>
            <div className="cap">Сезонное · тканевый бокс</div>
          </div>
        </figure>
      </div>

      <div className="u-hero__annot-foot">
        <p className="u-hero__annot-lede">
          Введите размеры пространства и выберите, что хотите хранить. Уместно соберёт конфигурацию и подскажет блоки.
        </p>
        <div className="u-hero__annot-actions">
          <button className="u-btn u-btn--sage u-btn--lg">
            Начать расчёт
            <Icon name="arrow-right" size={16} />
          </button>
          <div className="u-hero__annot-meta">
            <span className="amt">149&nbsp;₽</span>
            <span className="sub">один раз · без подписок · файл на почту</span>
          </div>
        </div>
      </div>
    </div>
  </section>;


window.HeroAnnotated = HeroAnnotated;

// ── Hero · Relief ─────────────────────────────────────────
// Эмоциональный hook: трио «без…» — главный визуальный элемент.
// Заголовок, CTA и фото — служебные. Manifesto-style.
const HeroRelief = () =>
<section className="u-hero u-hero--relief" data-screen-label="01 Hero · Relief">
    <div className="u-container">
      <header className="u-hero__relief-head">
        <div className="u-hero__relief-meta">
          <span>N° 01</span>
          <span className="rule"></span>
          <span>Конфигуратор хранения · Уместно</span>
        </div>
        <p className="u-hero__relief-lede">
          Готовая схема хранения под&nbsp;ваш ящик <span className="dim">— за 2–3 минуты, без таблиц и расчётов на&nbsp;полу.</span>
        </p>
      </header>

      <ul className="u-hero__relief-list" aria-label="Что Уместно снимает">
        <li><span className="dash" aria-hidden="true">—</span>без долгого поиска</li>
        <li><span className="dash" aria-hidden="true">—</span>без тестовых раскладок на&nbsp;полу</li>
        <li><span className="dash" aria-hidden="true">—</span>без случайных покупок и&nbsp;возвратов</li>
      </ul>

      <footer className="u-hero__relief-foot">
        <div className="u-hero__relief-cta">
          <button className="u-btn u-btn--sage u-btn--lg">
            Начать расчёт
            <Icon name="arrow-right" size={16} />
          </button>
          <div className="u-hero__relief-price">
            <span className="amt">149&nbsp;₽</span>
            <span className="sub">один раз · без подписок · файл на&nbsp;почту</span>
          </div>
        </div>

        <figure className="u-hero__relief-shot">
          <img src="assets/hero-drawer-v2.png" alt="Пример готовой схемы хранения в ящике" />
          <figcaption>пример готовой схемы</figcaption>
        </figure>
      </footer>
    </div>
  </section>;


window.HeroRelief = HeroRelief;

// ── Hero · Arch ─────────────────────────────────────────
// Pinterest-mood: вертикальное фото в форме арки доминирует справа,
// editorial-копия слева, лёгкий sage-tag поверх. Аудитория — женщина 25-40.
const HeroArch = () =>
<section className="u-hero u-hero--arch" data-screen-label="01 Hero · Arch">
    <div className="u-container">
      <div className="u-hero__arch-grid">
        <div className="u-hero__arch-copy">
          <div className="u-hero__arch-eyebrow">
            <span>N° 01</span>
            <span className="rule"></span>
            <span>Конфигуратор хранения · Уместно</span>
          </div>

          <h1 className="u-hero__arch-title">
            Готовая схема хранения <em>под ваш ящик</em>
          </h1>

          <p className="u-hero__arch-lede">
            Введите размеры и выберите, что хранить. Уместно соберёт конфигурацию, покажет схему и подскажет блоки.
          </p>

          <ul className="u-hero__arch-list">
            <li><span className="dash" aria-hidden="true">—</span>без долгого поиска</li>
            <li><span className="dash" aria-hidden="true">—</span>без тестовых раскладок на&nbsp;полу</li>
            <li><span className="dash" aria-hidden="true">—</span>без случайных покупок и&nbsp;возвратов</li>
          </ul>

          <div className="u-hero__arch-cta">
            <button className="u-btn u-btn--sage u-btn--lg">
              Начать расчёт
              <Icon name="arrow-right" size={16} />
            </button>
            <div className="u-hero__arch-trust">
              <span>149&nbsp;₽ один&nbsp;раз</span>
              <span className="dot">·</span>
              <span>без подписок</span>
              <span className="dot">·</span>
              <span>файл на&nbsp;почту</span>
            </div>
          </div>
        </div>

        <figure className="u-hero__arch-figure">
          <img src="assets/hero-drawer-vertical.png" alt="Аккуратно собранный ящик с органайзерами и схемой раскладки" />
          <img src="assets/branch-leaves.png" alt="" className="u-hero__arch-leaf" aria-hidden="true" />
          <aside className="u-hero__arch-tag">
            <span className="label">Полная схема расчёта</span>
            <span className="amt">149&nbsp;₽</span>
          </aside>
        </figure>
      </div>
    </div>
  </section>;


window.HeroArch = HeroArch;

// ── Hero · Magazine ─────────────────────────────────────
// Референсы: House of Honey, Symbol, Solace.
// HUGE display-заголовок на всю ширину + большое атмосферное фото.
// Warm-настроение, типографика как главный визуал.
const HeroMagazine = () =>
<section className="u-hero u-hero--mag" data-screen-label="01 Hero · Magazine">
    <div className="u-hero__mag-shell">
      <div className="u-hero__mag-topbar">
        <div className="u-hero__mag-tag">
          <span className="bullet" style={{ backgroundColor: "rgb(125, 140, 114)", color: "rgb(255, 255, 255)" }}></span>
          <span style={{ fontSize: "clamp(11px, 0.85vw, 13px)" }}>Конфигуратор хранения · Уместно</span>
        </div>
        <a className="u-hero__mag-link" href="#how">
          Начать расчёт <span aria-hidden="true">→</span>
        </a>
      </div>

      <div className="u-hero__mag-banner">
        <h1 className="u-hero__mag-title">
          <span className="row row-1" style={{ fontWeight: "500" }}>Готовая <em style={{ fontWeight: "500", fontSize: "1.06em", color: "rgb(125, 140, 114)" }}>схема хранения</em></span>
          <span className="row row-2" style={{ fontWeight: "500" }}>под ваш ящик</span>
        </h1>

        <div className="u-hero__mag-meta">
          <ul className="u-hero__mag-meta-list">
            <li style={{ fontFamily: "\"JetBrains Mono\"", fontSize: "clamp(16px, 1.5vw, 22px)" }}><span className="dash" aria-hidden="true" style={{ color: "rgb(125, 140, 114)", fontSize: "clamp(14px, 1.2vw, 18px)", fontWeight: "700" }}>—</span>без долгого поиска</li>
            <li style={{ fontFamily: "\"JetBrains Mono\"", fontSize: "clamp(16px, 1.5vw, 22px)" }}><span className="dash" aria-hidden="true" style={{ color: "rgb(125, 140, 114)", fontWeight: "700" }}>—</span>без тестовых раскладок на&nbsp;полу</li>
            <li style={{ fontFamily: "\"JetBrains Mono\"", fontSize: "clamp(16px, 1.5vw, 22px)" }}><span className="dash" aria-hidden="true" style={{ fontWeight: "700", color: "rgb(125, 140, 114)" }}>—</span>без ошибочных покупок и возвратов</li>
          </ul>
          <p className="u-hero__mag-meta-note" style={{ fontFamily: "\"JetBrains Mono\"", fontSize: "clamp(15px, 1.4vw, 21px)", lineHeight: "1.2" }}>Введите размеры и то, что хотите хранить.<br />Уместно соберет схему хранения вещей и подберет подходящие товары.</p>
        </div>
      </div>

      <figure className="u-hero__mag-photo">
        <img src="assets/hero-drawer-v2.png" alt="Аккуратно собранный ящик с органайзерами и схемой раскладки" />
        <div className="u-hero__mag-price">
          <div className="u-hero__mag-price-row">
            <span className="label" style={{ fontFamily: "\"JetBrains Mono\"", fontWeight: "400" }}>Полная схема расчёта</span>
            <span className="amt" style={{ fontFamily: "\"JetBrains Mono\"" }}>149&nbsp;₽</span>
          </div>
          <span className="sub" style={{ fontFamily: "\"JetBrains Mono\"", fontSize: "16px" }}>без скрытых платежей и подписок</span>
        </div>
      </figure>

      <div className="u-hero__mag-foot">
        <a className="u-hero__mag-cta" href="#how">
          <span className="label">Начать расчет</span>
          <span className="arrow" aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  </section>;


window.HeroMagazine = HeroMagazine;

// ── Hero · Fold ─────────────────────────────────────────
// Above-the-fold editorial: всё в одном экране, 2 шрифта (Garamond + Inter),
// фото справа доминирует, типографика слева, без mono-меток.
const HeroFold = () =>
<section className="u-hero u-hero--fold" data-screen-label="01 Hero · Fold">
    <div className="u-hero__fold-frame">
      <img src="assets/hero-drawer-v2.png" alt="Аккуратно собранный ящик с органайзерами и схемой раскладки" className="u-hero__fold-photo" />

      <article className="u-hero__fold-card">
        <p className="u-hero__fold-tag">Конфигуратор хранения</p>

        <h1 className="u-hero__fold-title">
          Готовая схема<br />
          хранения <em>под ваш ящик</em>
        </h1>

        <ul className="u-hero__fold-list">
          <li><span className="dash" aria-hidden="true">—</span>без долгого поиска</li>
          <li><span className="dash" aria-hidden="true">—</span>без тестовых раскладок на полу</li>
          <li><span className="dash" aria-hidden="true">—</span>без случайных покупок и возвратов</li>
        </ul>

        <footer className="u-hero__fold-foot">
          <button className="u-btn u-btn--sage u-btn--lg">
            Начать расчёт
            <Icon name="arrow-right" size={16} />
          </button>
          <div className="u-hero__fold-price">
            <span className="amt">149&nbsp;₽</span>
            <span className="sub">один раз, без подписок</span>
          </div>
        </footer>
      </article>
    </div>
  </section>;


window.HeroFold = HeroFold;