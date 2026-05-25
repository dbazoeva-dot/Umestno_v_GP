// Уместно — Расчёт. Страница ввода данных + страница-извинение.

// ── helpers ──────────────────────────────────────────────────
const NBSP = '\u00A0';

// ── Прогресс-бар ─────────────────────────────────────────────
function ProgressBar({ active = 1 }) {
  const steps = [
  { n: 1, t: 'Параметры' },
  { n: 2, t: 'Что храните' },
  { n: 3, t: 'Решение' }];

  return (
    <nav className="u-calc__progress" aria-label="Этапы расчёта">
      <ol>
        {steps.map((s, i) => {
          const state = s.n < active ? 'done' : s.n === active ? 'active' : 'todo';
          return (
            <li key={s.n} className={`u-calc__progress-step is-${state}`}>
              <span className="u-calc__progress-num" aria-hidden="true" style={{ backgroundColor: "rgb(128, 142, 116)", fontFamily: "\"JetBrains Mono\"" }}>{s.n}</span>
              <span className="u-calc__progress-lbl" style={{ fontFamily: "\"JetBrains Mono\"", fontWeight: "600", fontSize: "21px" }}>{s.n}. {s.t}</span>
              {i < steps.length - 1 && <span className="u-calc__progress-bar" aria-hidden="true"></span>}
            </li>);

        })}
      </ol>
    </nav>);

}

// ── Карточки-выбор (Ящик / Полка / Секция, Одежда / Детское / Текстиль) ──
function ChoiceCards({ label, options, value, onChange }) {
  return (
    <div className="u-calc__group">
      <div className="u-calc__lbl" style={{ fontSize: "16px" }}>{label}</div>
      <div className="u-calc__choices">
        {options.map((o) => {
          const cls = [
          'u-calc__choice',
          value === o.k ? 'is-on' : '',
          o.soon ? 'is-soon' : ''].
          filter(Boolean).join(' ');
          return (
            <button
              key={o.k}
              type="button"
              className={cls}
              onClick={() => !o.soon && onChange(o.k)}
              disabled={o.soon}
              aria-pressed={value === o.k} style={{ height: "118px" }}>
              
              <span className="u-calc__choice-ic" aria-hidden="true"><Icon name={o.ic} size={22} stroke={1.4} /></span>
              <span className="u-calc__choice-t">{o.t}</span>
              {o.soon && <span className="u-calc__choice-soon">скоро</span>}
            </button>);

        })}
      </div>
    </div>);

}

// ── Размеры ──────────────────────────────────────────────────
function SizesBlock({ vals, setVals, unknown, setUnknown, preset, setPreset }) {
  const presets = [
  { k: '60×40×15', w: 60, d: 40, h: 15 },
  { k: '80×45×15', w: 80, d: 45, h: 15 },
  { k: '90×50×20', w: 90, d: 50, h: 20 },
  { k: 'Комод IKEA', w: 80, d: 45, h: 18, hint: 'IKEA Malm' }];

  const onPreset = (p) => {
    setPreset(p.k);
    setVals({ w: String(p.w), d: String(p.d), h: String(p.h) });
    setUnknown(false);
  };
  const upd = (key) => (e) => {
    setVals({ ...vals, [key]: e.target.value });
    setPreset('');
  };
  return (
    <div className="u-calc__group">
      <div className="u-calc__lbl" style={{ fontSize: "16px" }}>Размеры пространства, см</div>
      <div className={`u-calc__sizes ${unknown ? 'is-dim' : ''}`}>
        <label className="u-calc__sz">
          <span style={{ fontFamily: "\"JetBrains Mono\"" }}>Ширина</span>
          <input type="text" inputMode="numeric" value={vals.w} onChange={upd('w')} placeholder="80" style={{ width: "279px" }} />
        </label>
        <label className="u-calc__sz">
          <span style={{ fontFamily: "\"JetBrains Mono\"" }}>Глубина</span>
          <input type="text" inputMode="numeric" value={vals.d} onChange={upd('d')} placeholder="45" style={{ width: "279px" }} />
        </label>
        <label className="u-calc__sz">
          <span style={{ fontFamily: "\"JetBrains Mono\"" }}>Высота</span>
          <input type="text" inputMode="numeric" value={vals.h} onChange={upd('h')} placeholder="15" style={{ width: "27px" }} />
        </label>
      </div>

      <div className="u-calc__preset-row">
        <div className="u-calc__preset-label">Популярные размеры</div>
        <div className="u-calc__presets">
          {presets.map((p) =>
          <button
            type="button"
            key={p.k}
            className={`u-calc__preset ${preset === p.k ? 'is-on' : ''}`}
            onClick={() => onPreset(p)} style={{ borderRadius: "12px", borderColor: "rgb(125, 140, 114)", color: "rgb(125, 140, 114)", backgroundColor: "rgb(234, 234, 221)" }}>
            {p.k}</button>
          )}
        </div>
      </div>

      <label className="u-calc__check">
        <input type="checkbox" checked={unknown} onChange={(e) => setUnknown(e.target.checked)} />
        <span className="box" aria-hidden="true">
          {unknown && <Icon name="check" size={12} stroke={2.6} />}
        </span>
        <span>Не знаю точные размеры.
Можно продолжить с примерными размерами, но перед покупкой органайзеров лучше измерить ящик.</span>
      </label>

      <div className="u-calc__helper">
        <Icon name="bulb" size={16} />
        <span style={{ fontFamily: "\"JetBrains Mono\"" }}>Размеры нужны, чтобы все органайзеры точно подошли. Пожалуйста, измеряйте <em style={{ fontFamily: "\"JetBrains Mono\"" }}>внутренние</em>&nbsp;стороны.</span>
      </div>
    </div>);
}

// ── Типы вещей ───────────────────────────────────────────────
function ItemsBlock({ rows, setRows }) {
  const MAX = 4;
  const ITEM_OPTIONS = ['Носки', 'Трусы', 'Майки', 'Футболки', 'Ремни', 'Аксессуары'];
  const QTY_OPTIONS = [
  'Мало (до 8 пар)',
  'Средне (9–16 пар)',
  'Много (17–30 пар)',
  'Очень много (30+)'];

  const setRow = (i, patch) => {
    const next = rows.slice();
    next[i] = { ...next[i], ...patch };
    setRows(next);
  };
  const addRow = () => {
    if (rows.length < MAX) setRows([...rows, { type: '', qty: '' }]);
  };
  const removeRow = (i) => {
    setRows(rows.filter((_, j) => j !== i));
  };
  return (
    <div className="u-calc__group">
      <div className="u-calc__lbl" style={{ fontSize: "16px" }}>Типы вещей <span className="u-calc__lbl-meta">до {MAX} категорий</span></div>
      <div className="u-calc__items">
        {rows.map((r, i) =>
        <div className="u-calc__item-row" key={i}>
            <label className="u-calc__field">
              <span className="u-calc__field-lbl">Что хранить</span>
              <div className="u-calc__select-wrap">
                <select value={r.type} onChange={(e) => setRow(i, { type: e.target.value })}>
                  <option value="">— выбрать —</option>
                  {ITEM_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <Icon name="chevron-right" size={14} />
              </div>
            </label>
            <label className="u-calc__field">
              <span className="u-calc__field-lbl">Объем</span>
              <div className="u-calc__select-wrap">
                <select value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })}>
                  <option value="">— выбрать —</option>
                  {QTY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <Icon name="chevron-right" size={14} />
              </div>
            </label>
            {rows.length > 1 &&
          <button type="button" className="u-calc__item-rm" onClick={() => removeRow(i)} aria-label="Удалить строку">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 7h14M9 7V5h6v2m-8 0v12h10V7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
          }
          </div>
        )}
      </div>
      {rows.length < MAX &&
      <button type="button" className="u-calc__add" onClick={addRow}>
          <Icon name="plus" size={14} stroke={2} />
          <span>Добавить ещё категорию</span>
        </button>
      }
    </div>);

}

// ── Приоритет ────────────────────────────────────────────────
function PriorityBlock({ value, onChange }) {
  const opts = [
  { k: 'comfort', t: 'Удобно', s: 'видно каждую вещь, легко доставать' },
  { k: 'capacity', t: 'Вместительно', s: 'максимум объёма на каждом см²' },
  { k: 'economy', t: 'Экономично', s: 'минимум органайзеров и трат' }];

  return (
    <div className="u-calc__group">
      <div className="u-calc__lbl" style={{ fontSize: "16px" }}>Что важнее</div>
      <div className="u-calc__priority">
        {opts.map((o) =>
        <button
          key={o.k}
          type="button"
          className={`u-calc__pri-btn ${value === o.k ? 'is-on' : ''}`}
          onClick={() => onChange(o.k)}
          aria-pressed={value === o.k}>
          
            <span className="u-calc__pri-check" aria-hidden="true">
              {value === o.k && <Icon name="check" size={12} stroke={2.6} />}
            </span>
            <span className="u-calc__pri-body">
              <span className="ttl">{o.t}</span>
              <span className="sub">{o.s}</span>
            </span>
          </button>
        )}
      </div>
    </div>);

}

// ── Карусель (правая колонка) ────────────────────────────────
const CAROUSEL_SLIDES = [
{ img: 'assets/hero-drawer-v2.png', cap: 'Пример аккуратной конфигурации', meta: 'комод 80×45×15 · 4 блока' },
{ img: 'assets/review1-aftr.webp', cap: 'Зонирование под бельё и аксессуары', meta: 'Анна, Москва' },
{ img: 'assets/review2-aftr.webp', cap: 'Категории по понятным блокам', meta: 'Елена, Владикавказ' },
{ img: 'assets/sample-scheme.webp', cap: 'Готовая схема: что где хранить', meta: 'результат расчёта' }];


function Carousel() {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % CAROUSEL_SLIDES.length), 4200);
    return () => clearInterval(id);
  }, []);
  const s = CAROUSEL_SLIDES[i];
  return (
    <div className="u-calc__carousel">
      <div className="u-calc__carousel-frame">
        {CAROUSEL_SLIDES.map((sl, j) =>
        <img
          key={sl.img}
          src={sl.img}
          alt={sl.cap}
          className={j === i ? 'is-on' : ''} />

        )}
      </div>
      <div className="u-calc__carousel-meta">
        <div className="u-calc__carousel-cap">{s.cap}</div>
        <div className="u-calc__carousel-sub">{s.meta}</div>
      </div>
      <div className="u-calc__carousel-dots" role="tablist">
        {CAROUSEL_SLIDES.map((_, j) =>
        <button
          key={j}
          type="button"
          className={`dot ${j === i ? 'is-on' : ''}`}
          onClick={() => setI(j)}
          aria-label={`Слайд ${j + 1}`} />

        )}
      </div>
    </div>);

}

// ── Сайдбар: преимущества + tip ──────────────────────────────
function Sidebar() {
  const points = [
  { ic: 'clock', t: 'Подбор за 2–3 минуты', d: 'Простой процесс без лишних шагов.' },
  { ic: 'search', t: 'Без долгого поиска вручную', d: 'Мы делаем сложное — простым.' },
  { ic: 'shield', t: 'Только совместимые решения', d: 'Всё точно подойдёт по размерам.' }];

  return (
    <aside className="u-calc__sidebar">
      <Carousel />
      <div className="u-calc__points">
        {points.map((p, i) =>
        <div className="u-calc__point" key={i}>
            <div className="u-calc__point-ic" aria-hidden="true"><Icon name={p.ic} size={22} stroke={1.5} /></div>
            <div>
              <div className="u-calc__point-t">{p.t}</div>
              <div className="u-calc__point-d">{p.d}</div>
            </div>
          </div>
        )}
      </div>
      <div className="u-calc__tip">
        <div className="u-calc__tip-ic" aria-hidden="true"><Icon name="bulb" size={20} /></div>
        <div className="u-calc__tip-body">
          <strong>Совет: </strong>
          измерьте внутренние размеры ящика. Это размеры, под которые будут подобраны органайзеры.
        </div>
      </div>
    </aside>);

}

// ── Преимущества (низ страницы) ──────────────────────────────
function Advantages() {
  const items = [
  { ic: 'clock', t: 'Экономит время', d: 'Не нужно искать и сравнивать десятки органайзеров.' },
  { ic: 'shield', t: 'Меньше ошибок', d: 'Система учитывает размеры и совместимость товаров.' },
  { ic: 'sparkle', t: 'Красивый результат', d: 'На выходе — понятная схема и подобранные товары.' }];

  return (
    <section className="u-calc__advs">
      <div className="u-container">
        <div className="u-calc__advs-grid">
          {items.map((it, i) =>
          <div className="u-calc__adv" key={i}>
              <div className={`u-calc__adv-ic adv-${i + 1}`} aria-hidden="true"><Icon name={it.ic} size={26} stroke={1.4} /></div>
              <div>
                <div className="u-calc__adv-t">{it.t}</div>
                <div className="u-calc__adv-d">{it.d}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>);

}

// ── Главная страница расчёта ─────────────────────────────────
function CalculatorPage() {
  const [where, setWhere] = React.useState('drawer');
  const [what, setWhat] = React.useState('adult');
  const [vals, setVals] = React.useState({ w: '80', d: '45', h: '15' });
  const [unknown, setUnknown] = React.useState(false);
  const [preset, setPreset] = React.useState('80×45×15');
  const [rows, setRows] = React.useState([
  { type: 'Носки', qty: 'Средне (9–16 пар)' },
  { type: 'Трусы', qty: 'Средне (9–16 пар)' }]
  );
  const [priority, setPriority] = React.useState('comfort');

  const whereOpts = [
  { k: 'drawer', t: 'Ящик', ic: 'box' },
  { k: 'shelf', t: 'Полка', ic: 'grid', soon: true },
  { k: 'section', t: 'Секция', ic: 'home', soon: true }];

  const whatOpts = [
  { k: 'adult', t: 'Одежда для взрослых', ic: 'shirt' },
  { k: 'kids', t: 'Детское', ic: 'kids', soon: true },
  { k: 'textile', t: 'Текстиль и постель', ic: 'sparkle', soon: true }];


  return (
    <>
      <Header />
      <main className="u-calc">
        <div className="u-container">
          <ProgressBar active={1} />

          <div className="u-calc__layout">
            <section className="u-calc__form-card">
              <header className="u-calc__head">
                <div className="u-calc__eyebrow">
                  <span className="dot" aria-hidden="true"></span>
                  <span>конфигуратор · шаг 1–2</span>
                </div>
                <h1 className="u-calc__title">
                  Подберём хранение<br />
                  <em>под ваш ящик</em>
                </h1>
                <p className="u-calc__lede">Пожалуйста, введите данные в форме ниже.
Это займёт всего пару минут.
                </p>
              </header>

              <div className="u-calc__divider" aria-hidden="true"></div>

              <ChoiceCards
                label="Тип пространства"
                options={whereOpts}
                value={where}
                onChange={setWhere} />
              

              <ChoiceCards
                label="Что хранить"
                options={whatOpts}
                value={what}
                onChange={setWhat} />
              

              <SizesBlock
                vals={vals} setVals={setVals}
                unknown={unknown} setUnknown={setUnknown}
                preset={preset} setPreset={setPreset} />
              

              <div className="u-calc__divider u-calc__divider--soft" aria-hidden="true"></div>

              <div className="u-calc__step-marker">
                <span className="num">2</span>
                <span>Что вы храните</span>
              </div>

              <ItemsBlock rows={rows} setRows={setRows} />

              <PriorityBlock value={priority} onChange={setPriority} />

              <div className="u-calc__actions">
                <button type="button" className="u-btn u-btn--accent u-btn--lg u-calc__cta">
                  <span style={{ fontSize: "21px" }}>Получить расчёт — 149{NBSP}₽</span>
                  <Icon name="arrow-right" size={16} />
                </button>
                <button type="button" className="u-btn u-btn--ghost u-btn--lg" style={{ borderWidth: "0px 0px 1px", fontSize: "14px", borderRadius: "0px", padding: "10px" }}>Посмотреть пример</button>
              </div>

              <div className="u-calc__fineprint">
                <Icon name="shield" size={14} />
                <span style={{ fontSize: "16px" }}>Оплата производится через сервис ЮKassa. После оплаты Вы будете перенаправлены на страницу с финальным результатом.</span>
              </div>
            </section>

            <Sidebar />
          </div>
        </div>

        <Advantages />
      </main>
      <Footer />
    </>);

}

// ── Страница-извинение (fit_none / fit_partial) ──────────────
function ApologyPage() {
  const [email, setEmail] = React.useState('');
  return (
    <>
      <Header />
      <main className="u-calc u-calc--apology">
        <div className="u-container">
          <ProgressBar active={3} />

          <section className="u-apology">
            <div className="u-apology__art" aria-hidden="true">
              <img src="assets/branch-leaves.png" alt="" />
              <img src="assets/branch-twig.png" alt="" className="twig" />
            </div>

            <div className="u-apology__body">
              <div className="u-apology__eyebrow">
                <span className="dot"></span>
                <span>результат расчёта</span>
              </div>

              <h1 className="u-apology__title">
                К&nbsp;сожалению,<br />
                <em>подобрать конфигурацию не&nbsp;удалось</em>
              </h1>

              <p className="u-apology__lede">По введённым размерам мы не можем собрать надёжную схему. Некоторые блоки не помещаются целиком.
Попробуйте уменьшить объём одной из категорий или проверьте внутренние размеры ящика.
              </p>

              <div className="u-apology__what">
                <div className="u-apology__what-row">
                  <div className="u-apology__what-ic" aria-hidden="true"><Icon name="ruler" size={20} stroke={1.5} /></div>
                  <div>
                    <strong>Проверьте размеры.</strong> Измеряйте внутренние стороны ящика — без учёта стенок.
                  </div>
                </div>
                <div className="u-apology__what-row">
                  <div className="u-apology__what-ic" aria-hidden="true"><Icon name="grid" size={20} stroke={1.5} /></div>
                  <div>
                    <strong>Уменьшите одну категорию.</strong> Часто помогает выбрать «Мало» вместо «Много» в одной позиции.
                  </div>
                </div>
                <div className="u-apology__what-row">
                  <div className="u-apology__what-ic" aria-hidden="true"><Icon name="question" size={20} stroke={1.5} /></div>
                  <div>
                    <strong>Можем подсказать вручную.</strong> Оставьте e-mail, мы попробуем провести подбор вручную и пришлём вариант.
                  </div>
                </div>
              </div>

              <div className="u-apology__email">
                <label>
                  <span>Ваш e-mail</span>
                  <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <button type="button" className="u-btn u-btn--sage u-btn--lg">Прислать&nbsp;вариант</button>
              </div>

              <div className="u-apology__actions">
                <a href="Уместно - Расчёт.html" className="u-apology__back">
                  <Icon name="arrow-right" size={16} />
                  <span style={{ fontSize: "21px", fontFamily: "\"JetBrains Mono\"" }}>Вернуться к&nbsp;расчёту</span>
                </a>
                <span className="u-apology__refund">Оплата не была произведена</span>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>);

}

Object.assign(window, { CalculatorPage, ApologyPage, ProgressBar });