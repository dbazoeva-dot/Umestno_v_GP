// Уместно — sections (Miro-aligned)

const Header = () =>
<header className="u-header">
    <div className="u-header__inner" style={{ textAlign: "left" }}>
      <a href="#" className="u-logo">у<span className="m">М</span>естно</a>
      <nav className="u-nav">
        <a href="#how">Как это работает</a>
        <a href="#result">Результат</a>
        <a href="#whom">Для кого</a>
        <a href="#reviews">Отзывы</a>
        <a href="#faq">FAQ</a>
      </nav>
      <div className="u-header__cta">
        <button className="u-btn u-btn--accent u-btn--sm" style={{ backgroundColor: "rgb(125, 140, 114)" }}>Начать расчёт — 149 ₽</button>
      </div>
    </div>
  </header>;


// ── 02. Проблема — узнавание ──────────────────────────────
const Problem = () =>
<section className="u-section u-section--linked-bottom" data-screen-label="02 Проблема" data-chapter="01" data-chapter-label="ЗНАКОМО">
    <div className="u-container">
        <div className="u-sec-head" style={{ width: "1300px", maxWidth: "100%" }}>
        <div className="u-sec-head__num" style={{ fontSize: "clamp(11px, 0.85vw, 13px)" }}>N° 01 · знакомо?</div>
        <h2 className="u-sec-head__title" style={{ width: "1200px", maxWidth: "100%" }}>Когда хочется порядок, но&nbsp;приходится<br /><em>собирать сложный пазл</em></h2>
      </div>
      <div className="u-problem-grid">
        {[
      { t: 'На подбор уходит', em: 'слишком много времени', d: 'Нужно искать, сравнивать десятки карточек и держать в голове, что может подойти.', ic: 'pain-time' },
      { t: 'Сложно собрать', em: 'всё вместе', d: 'Отдельные органайзеры выглядят подходяще, но неясно, как они будут работать вместе.', ic: 'pain-mismatch' },
      { t: 'Ящик заполнен, но хранить', em: 'всё равно неудобно', d: 'Органайзеры занимают место, но не подходят под то, что Вы храните.', ic: 'pain-cluttered' }].
      map((p, i) =>
      <div className="u-pain" key={i}>
            <div className="u-pain__icon" aria-hidden="true"><Icon name={p.ic} size={56} stroke={1.5} /></div>
            <h3>{p.t}<br /><em>{p.em}</em></h3>
            <p>{p.d}</p>
          </div>
      )}
      </div>
    </div>
  </section>;


// ── 03. Четыре шага — ответ (более яркий, шалфейный) ──────────
const HowItWorks = () =>
<section className="u-section u-section--linked" id="steps" data-screen-label="03 Четыре шага">
    <div className="u-container">
      <div className="u-sec-head u-sec-head--sage" data-comment-anchor="864f348260-div-51-7">
        <div className="u-sec-head__main">
          <h2 className="u-sec-head__title">С <span className="u-brand-inline">Уместно</span> все становится <em>гораздо проще</em></h2>
        </div>
        <p className="u-sec-head__lede">От размеров ящика до готовой схемы и подходящих органайзеров за несколько минут.</p>
      </div>
      <div className="u-steps u-steps--4">
        {[
      { n: 1, t: 'Введите размеры', d: 'Укажите глубину, ширину и высоту по внутренним размерам.' },
      { n: 2, t: 'Выберите, что хранить', d: 'Отметьте типы вещей, их объём и приоритет хранения: удобно, вместительно или экономично.' },
      { n: 3, t: 'Получите схему и рекомендации', d: 'Уместно соберёт конфигурацию и покажет, что где хранить, как разместить блоки и как сложить вещи внутри.' },
      { n: 4, t: 'Соберите ящик по схеме', d: 'К каждому блоку предложим подходящие органайзеры со ссылками на популярные маркетплейсы. Можно купить их или использовать аналоги по размерам.' }].
      map((s) =>
      <div className="u-step-card" key={s.n}>
            <div className="u-step-card__num">0{s.n}</div>
            <h4>{s.t}</h4>
            <div className="u-step-card__rule" aria-hidden="true"></div>
            <p>{s.d}</p>
          </div>
      )}
      </div>
      <div className="u-result-note u-steps__note" style={{ fontSize: "21px", fontFamily: "\"JetBrains Mono\"" }}>
        <span className="ic" style={{ borderColor: "rgb(125, 140, 114)" }}><Icon name="alert" size={18} /></span>
        Итоговый результат можно сохранить, скачать или отправить себе на почту
      </div>
    </div>
  </section>;


// ── 04. Как это работает — конфигуратор: слева форма, справа результат ──
const Configurator = () => {
  const [w, setW] = React.useState('80');
  const [d, setD] = React.useState('45');
  const [h, setH] = React.useState('15');
  const [pri, setPri] = React.useState('Удобно');

  const products = [
  { n: 'Органайзер со слотами', sub: '11 слотов · полужёсткий', b: '01', img: 'assets/product-slots-white.png' },
  { n: 'Тканевый контейнер с разделителями', sub: 'плотный лён · 5 отделений', b: '02', img: 'assets/product-fabric-beige.png' },
  { n: 'Контейнер с ячейками', sub: 'плотная ткань · 16 ячеек', b: '03', img: 'assets/product-cells-beige.png' },
  { n: 'Деревянный органайзер', sub: 'дерево · 9 ячеек', b: '04', img: 'assets/product-cells-wood-brown.png' }];


  const priorities = [
  { k: 'Удобно', s: 'Проще видеть и доставать' },
  { k: 'Вместительно', s: 'Максимально плотно' },
  { k: 'Экономично', s: 'Простые варианты' }];


  return (
    <section className="u-section u-section--linked-bottom" id="how" data-screen-label="04 Как это работает" data-chapter="02" data-chapter-label="КОНФИГУРАТОР">
      <div className="u-container">
        <div className="u-sec-head u-sec-head--split">
          <div className="u-sec-head__num">N° 02 · как это работает</div>
          <h2 className="u-sec-head__title">Как выглядит <em className="nowrap">расчет в Уместно</em></h2>
          <p className="u-sec-head__lede">Вы вводите размеры пространства и категорию вещей. Уместно сразу анализирует данные и выводит схему раскладки, размеры блоков, рекомендации по складыванию вещей и подберает товары с популярных маркетплейсов под каждый блок.</p>
        </div>

        <div className="u-config2__colheads" aria-hidden="true">
          <div className="u-config2__colhead">
            <span className="u-config2__colhead-num">I.</span>
            <span className="u-config2__colhead-lbl" style={{ color: "rgb(208, 138, 114)" }}>Вы вводите данные</span>
          </div>
          <div className="u-config2__colhead u-config2__colhead--accent">
            <span className="u-config2__colhead-num" style={{ color: "rgb(159, 149, 118)" }}>II.</span>
            <span className="u-config2__colhead-lbl"><em style={{ color: "rgb(154, 144, 115)" }}>Уместно собирает результат</em></span>
          </div>
        </div>

        <div className="u-config2">
          <div className="u-config2__body">
            {/* LEFT — form */}
            <div className="u-config2__form" data-comment-anchor="d6d998f446-div-122-13">
              <div className="u-config2__head-row">
                <div className="u-config2__demo-tag">
                  <span className="dot" aria-hidden="true"></span>
                  <span>Пример заполнения формы</span>
                </div>
                <div className="u-config2__timer" style={{ backgroundColor: "rgb(244, 227, 210)" }}>
                  <Icon name="hourglass" size={20} />
                  <span>~ 2–3 минуты</span>
                </div>
              </div>

              <div className="u-config2__group">
                <div className="u-config2__lbl">Размеры пространства, см</div>
                <div className="u-config2__sizes" data-comment-anchor="3a8636796b-div-117-19">
                  <div className="u-config2__sz"><label>Ширина</label><input value={w} onChange={(e) => setW(e.target.value)} /></div>
                  <div className="u-config2__sz"><label>Глубина</label><input value={d} onChange={(e) => setD(e.target.value)} /></div>
                  <div className="u-config2__sz"><label>Высота</label><input value={h} onChange={(e) => setH(e.target.value)} /></div>
                </div>
              </div>

              <div className="u-config2__group">
                <div className="u-config2__lbl">Что хранить</div>
                <div className="u-config2__cat">Трусы, носки, майки, ремни</div>
              </div>

              <div className="u-config2__group">
                <div className="u-config2__lbl">Что важнее</div>
                <div className="u-config2__pri-list">
                  {priorities.map((opt) =>
                  <button
                    key={opt.k}
                    className={`u-config2__pri ${pri === opt.k ? 'on' : ''}`}
                    onClick={() => setPri(opt.k)}
                    type="button">
                    
                      <span className="u-config2__check">
                        {pri === opt.k && <Icon name="check" size={12} stroke={2.4} />}
                      </span>
                      <span className="u-config2__pri-body">
                        <span className="ttl">{opt.k}</span>
                        <span className="sub">{opt.s}</span>
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <div className="u-config2__cta-area">
                <button className="u-btn u-btn--accent u-btn--lg u-config2__cta-btn" data-comment-anchor="13fc196314-button-151-17">
                  Перейти к форме расчёта - 149 ₽
                  <Icon name="arrow-right" size={16} />
                </button>
                <div className="u-config2__fineprint" style={{ fontFamily: "\"JetBrains Mono\"" }}>
                  Один раз. Без подписок. Файл со схемой остаётся у&nbsp;вас навсегда.
                </div>
              </div>
            </div>

            <div className="u-config2__divider"></div>

            {/* RIGHT — result */}
            <div className="u-config2__result" data-comment-anchor="09ae783a50-div-164-13">
              <div className="u-config2__group">
                <div className="u-config2__lbl">
                  <span>Рекомендуемая конфигурация</span>
                  <span className="u-config2__rmeta">{w}×{d}×{h} см · 4 блока</span>
                </div>
                <div className="u-config2__schema">
                  <img src="assets/sample-scheme.webp" alt="Пример схемы хранения: четыре блока в одном лотке" />
                </div>
              </div>

              <div className="u-config2__group u-config2__group--products">
                <div className="u-config2__lbl">Рекомендуемые товары</div>
                <div className="u-config2__products">
                  {products.map((p) =>
                  <div className="u-config2__pr-card" key={p.n}>
                      <div className="u-config2__pr-img">
                        <img src={p.img} alt={p.n} />
                      </div>
                      <div className="u-config2__pr-info">
                        <div className="u-config2__pr-b">блок {p.b}</div>
                        <div className="u-config2__pr-n">{p.n}</div>
                        <div className="u-config2__pr-sub">{p.sub}</div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="u-config2__compat-note">
                  <Icon name="check-circle" size={14} />
                  Все органайзеры совместимы со схемой по размеру и высоте
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>);

};

// ── 05. «Как будет выглядеть результат» — оригинальная копия ──────
const Result = () =>
<section className="u-section u-section--linked" id="result" data-screen-label="05 Как выглядит результат" data-chapter="03">
    <div className="u-container">
      <div className="u-sec-head">
        <div className="u-sec-head__num">N° 03 · результат</div>
        <h2 className="u-sec-head__title">Что включено в результат</h2>
        <p className="u-sec-head__lede">Уместно покажет не просто типовую схему, а готовую конфигурацию хранения под размеры Вашего пространства
и необходимые вещи.</p>
      </div>
      <div className="u-result-cards">
        {[{ t: 'Схема хранения', d: 'Наглядный план с размерами зон для каждой группы вещей.' },
      { t: 'Назначение ячеек', d: 'Для каждого блока будет понятно назначение с учётом частоты использования.' },
      { t: 'Памятка по хранению', d: 'Короткие подсказки, как складывать и распределять вещи внутри блоков, чтобы схема работала эффективно.' },
      { t: 'Рекомендации по органайзерам', d: 'Подберём товары не общей выдачей, а под каждый блок схемы отдельно — точно подходящие под размеры.' }].
      map((c, i) =>
      <div className="u-result-card" key={i} style={{ borderColor: "rgb(125, 140, 114)" }}>
            <h5>{c.t}</h5>
            <p>{c.d}</p>
          </div>
      )}
      </div>
      <div className="u-result-note" style={{ fontSize: "21px", fontFamily: "\"JetBrains Mono\"" }}>
        <span className="ic"><Icon name="check-circle" size={18} /></span>
        Итоговый результат можно сохранить, скачать или отправить себе на почту единым файлом.
      </div>
    </div>
  </section>;


// ── 06. «Не просто красиво. Логично.» — editorial-эссе, не карточки и не списки ──────
const Logic = () => {
  const principles = [
  { t: 'Группировка вещей', p1: 'Система держит связанные категории рядом, чтобы хранение не распадалось на случайные зоны.', p2: 'Вы не получите схему, где носки внезапно стоят между бельевыми блоками.' },
  { t: 'Удобный доступ', p1: 'Система учитывает частоту использования вещей и помогает расположить их в более доступных зонах.', p2: 'Повседневные вещи не уедут в самый дальний или неудобный край.' },
  { t: 'Профессиональные подходы к хранению', p1: 'Используются проверенные принципы организации пространства, чтобы подобрать лучший формат хранения под каждый тип вещей.', p2: 'Не универсальная «коробка для всего», а ячейки, слоты, открытые секции под конкретную задачу.' },
  { t: 'Размеры вещей', p1: 'Система учитывает размеры каждого типа вещей, чтобы секции не были слишком мелкими, тесными или лишне крупными.', p2: 'Вы не получите схему, где носки занимают столько же места, что и джинсы.' }];

  return (
    <section className="u-section u-section--warm" data-screen-label="06 Не просто красиво. Логично" data-chapter="04" data-chapter-label="ЛОГИКА">
      <div className="u-container">
        <div className="u-sec-head">
          <div className="u-sec-head__num">N° 04 · логика</div>
          <h2 className="u-sec-head__title">Не просто красиво. <em>Логично.</em></h2>
          <p className="u-sec-head__lede">Уместно — конфигуратор хранения на базе ИИ. Он не раскладывает вещи на глаз. Внутри — правила профессиональной организации пространства: группировка, доступность, подходящий формат хранения, размеры вещей и сравнение вариантов.</p>
        </div>

        <article className="u-logic-essay">
          {principles.map((c, i) =>
          <p key={i}>
              <strong className="u-logic-essay__lead">{c.t}.</strong>
              {' '}{c.p1}{' '}<span className="u-logic-essay__sub">{c.p2}</span>
            </p>
          )}
        </article>

        <aside className="u-logic-finale">
          <div className="u-logic-finale__label">И ещё одно</div>
          <h4 className="u-logic-finale__title">ИИ сравнивает варианты и собирает рабочую схему</h4>
          <p>Мы не подставляем первый подходящий органайзер. Система анализирует разные сочетания блоков, форматов хранения и товаров, чтобы собрать решение, которое лучше использует пространство и подходит под выбранные вещи.</p>
          <p className="u-logic-finale__pull">В результате вы получаете не одну случайную раскладку, а выбранную конфигурацию: с понятными зонами, подходящими форматами хранения и товарами под каждый блок.</p>
        </aside>
      </div>
    </section>);

};


// ── 07. Для кого ──────────────────────────────────────────
const SEGMENTS = {
  'Семьям': {
    icon: 'family',
    art: 'assets/drawer-hero.png',
    art_label: 'Реальный пример: семейный комод',
    bullets: [
    { ic: 'clock', t: 'Меньше времени на быт', d: 'Уместно собирает решение целиком без сравнения десятков карточек.' },
    { ic: 'kids', t: 'Дети находят свои вещи сами', d: 'Каждая зона ящика подписана и понятна даже самым младшим.' },
    { ic: 'shield', t: 'Никаких лишних покупок', d: 'Только совместимые между собой товары без возвратов.' },
    { ic: 'leaf', t: 'Спокойный, тёплый интерьер', d: 'Натуральные материалы и сдержанные оттенки.' }]

  },
  'Парам в малой квартире': {
    icon: 'home',
    art: 'assets/drawer-hero.png',
    art_label: 'Реальный пример: общий комод 80×45',
    bullets: [
    { ic: 'grid', t: 'Максимум пользы на см²', d: 'Уместно учитывает каждый сантиметр — без пустот и нерасчёта.' },
    { ic: 'sparkle', t: 'Общие вещи не путаются', d: 'Чёткое зонирование по категориям и владельцам.' },
    { ic: 'box', t: 'Готовый «комод-инструкция»', d: 'Один файл со схемой и подобранными товарами.' },
    { ic: 'check-circle', t: 'Без долгих споров', d: 'Берёте схему — и сразу всё на местах.' }]

  },
  'Любителям эстетики': {
    icon: 'sparkle',
    art: 'assets/drawer-hero.png',
    art_label: 'Реальный пример: эстетичная сборка',
    bullets: [
    { ic: 'leaf', t: 'Pinterest-уровень в реальности', d: 'Только товары в спокойной палитре, без визуального шума.' },
    { ic: 'heart', t: 'Красиво в интерьере', d: 'Лён, войлок, дерево — материалы, которые приятно видеть каждый день.' },
    { ic: 'grid', t: 'Чёткие линии и зоны', d: 'Сетка, в которой каждой вещи отведено своё место.' },
    { ic: 'sparkle', t: 'Готово к фото', d: 'После сборки можно фотографировать — и так останется надолго.' }]

  },
  'Тем, кто переезжает': {
    icon: 'box',
    art: 'assets/drawer-hero.png',
    art_label: 'Реальный пример: первое заселение',
    bullets: [
    { ic: 'sparkle', t: 'Сразу понятно, что покупать', d: 'Не нужно угадывать, что пригодится — Уместно подскажет.' },
    { ic: 'arrow-loop', t: 'Можно собрать заранее', d: 'Заказать комплект и распаковать уже в новом доме — за час.' },
    { ic: 'shield', t: 'Без двойных покупок', d: 'Уместно учитывает существующую мебель и стандартные размеры.' },
    { ic: 'check-circle', t: 'Понятный финальный список', d: 'Скачайте PDF со схемой и купите всё одним заходом.' }]

  }
};

const Benefits = () => {
  const [seg, setSeg] = React.useState('Семьям');
  const s = SEGMENTS[seg];
  return (
    <section className="u-section" id="whom" data-screen-label="07 Для кого" data-chapter="05">
      <div className="u-container">
        <div className="u-sec-head">
        <div className="u-sec-head__main">
          <div className="u-sec-head__num">N° 05</div>
          <h2 className="u-sec-head__title">Подходит тем, кто ценит <em>спокойный порядок</em></h2>
        </div>
          <p className="u-sec-head__lede">Четыре сценария — каждый со своими акцентами.</p>
        </div>
        <div className="u-tabs">
          {Object.keys(SEGMENTS).map((k) =>
          <button key={k} className={seg === k ? 'active' : ''} onClick={() => setSeg(k)}>
              <Icon name={SEGMENTS[k].icon} size={16} />{k}
            </button>
          )}
        </div>
        <div className="u-benefits">
          <div className="u-benefits__list">
            {s.bullets.map((b, i) =>
            <div className="u-benefit" key={i}>
                <div className="u-benefit__icon"><Icon name={b.ic} size={20} /></div>
                <div>
                  <h5>{b.t}</h5>
                  <p>{b.d}</p>
                </div>
              </div>
            )}
          </div>
          <div className="u-benefits__art">
            <img src={s.art} alt={s.art_label} />
            <div className="u-benefits__tag">{s.art_label}</div>
          </div>
        </div>
      </div>
    </section>);

};

// ── 08. Отзывы с фото До/После ─────────────────────────────
const REVIEWS = [
{
  name: 'Анна', city: 'Москва',
  quote: 'Я бы сама очень долго собирала это по частям. Здесь сразу стало понятно, что покупать и как это должно встать внутри.',
  bfr: 'assets/review1-bfr.webp', aftr: 'assets/review1-aftr.webp',
  bfr_cap: 'Вещи лежат вместе, зоны хранения не выделены.',
  aftr_cap: 'Пространство разделено на отдельные зоны — для белья и аксессуаров.'
},
{
  name: 'Елена', city: 'Владикавказ',
  quote: 'Мне понравилось, что сервис показал не просто товары, а саму логику хранения. Наконец, стало удобно пользоваться ящиком — не уходит по 10 минут на поиск нужной вещи.',
  bfr: 'assets/review2-bfr.webp', aftr: 'assets/review2-aftr.webp',
  bfr_cap: 'Вещи лежали обычными стопками и быстро смешивались.',
  aftr_cap: 'Каждая категория разделена по понятным блокам с удобным доступом.'
},
{
  name: 'Максим', city: 'Санкт-Петербург',
  quote: 'Я не хотел тратить время на поиски нужных органайзеров и прикидывать размеры вручную. Как же это удобно, что можно сразу получил понятную схему, ещё и рекомендации, что купить.',
  bfr: 'assets/review3-bfr.webp', aftr: 'assets/review3-aftr.webp',
  bfr_cap: 'Вещи помещаются, но пользоваться ящиком неудобно.',
  aftr_cap: 'У каждой категории появляется своё место под частоту использования.'
},
{
  name: 'Ирина', city: 'Москва',
  quote: 'Самое полезное, что схема собирается не на глаз. Я бы сама точно не додумалась, как разложить всё именно так. Оказалось, что так удобнее, и порядок поддерживается как будто сам собой.',
  bfr: 'assets/review4-bfr.webp', aftr: 'assets/review4-aftr.webp',
  bfr_cap: 'Все вещи лежали вперемешку, деликатные вещи могли деформироваться.',
  aftr_cap: 'Бельевые категории собраны рядом, а для каждой зоны есть своё назначение.'
},
{
  name: 'Давид', city: 'Екатеринбург',
  quote: 'Ящик большой, но именно поэтому в нём постоянно был беспорядок. Джинсы, шорты, футболки в хаосе, ремни всё время оказывались где-то сбоку. Разложил, как предложил Уместно — вещи наконец перестали мешать друг другу.',
  bfr: 'assets/review5-bfr.webp', aftr: 'assets/review5-aftr.webp',
  bfr_cap: 'Крупные вещи и аксессуары лежат вместе и перемешиваются в большом ящике.',
  aftr_cap: 'Джинсы, шорты, футболки и ремни разложены по отдельным зонам.'
}];


const Reviews = () => {
  const [i, setI] = React.useState(0);
  const r = REVIEWS[i];
  return (
    <section className="u-section u-section--warm" id="reviews" data-screen-label="08 Отзывы" data-chapter="06">
      <div className="u-container">
        <div className="u-sec-head">
        <div className="u-sec-head__main">
          <div className="u-sec-head__num">N° 06 · ОТЗЫВЫ</div>
          <h2 className="u-sec-head__title" data-comment-anchor="73a6eaef80-h2-407-11">Спокойствие, к которому <em className="nowrap">легко привыкаешь</em></h2>
        </div>
        </div>

        <div className="u-review-slide">
          <div className="u-review-slide__copy">
            <div className="u-review-slide__num">История 0{i + 1} / {REVIEWS.length}</div>
            <p className="u-review-slide__quote" style={{ fontSize: "clamp(22px, 2vw, 30px)" }}>{r.quote}</p>
            <div className="u-review-slide__author">
              <div className="av">{r.name[0]}</div>
              <div className="meta"><b>{r.name}</b>{r.city}</div>
            </div>

            <div className="u-review-nav">
              <button className="nav" onClick={() => setI((i - 1 + REVIEWS.length) % REVIEWS.length)} aria-label="Назад" data-comment-anchor="5b4799a359-button-440-11">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
              </button>
              <div className="dots">
                {REVIEWS.map((_, idx) =>
                <button key={idx} className={idx === i ? 'active' : ''} onClick={() => setI(idx)} aria-label={`Отзыв ${idx + 1}`} />
                )}
              </div>
              <button className="nav" onClick={() => setI((i + 1) % REVIEWS.length)} aria-label="Вперёд">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
              </button>
            </div>
          </div>
          <div className="u-review-slide__compare">
            <div className="u-review-slide__col">
              <div className="u-review-slide__img">
                <img src={r.bfr} alt="До" />
                <span className="pill">До</span>
              </div>
              <div className="u-review-slide__caption">{r.bfr_cap}</div>
            </div>
            <div className="u-review-slide__col">
              <div className="u-review-slide__img">
                <img src={r.aftr} alt="После" />
                <span className="pill after">После</span>
              </div>
              <div className="u-review-slide__caption">{r.aftr_cap}</div>
            </div>
          </div>
        </div>
      </div>
    </section>);

};

// ── 09. FAQ ────────────────────────────────────────────────
const FAQS = [
{ q: 'Что я получу после расчёта?', a: 'Вы получите готовую схему хранения под ваши размеры и выбранные вещи. В результате будут показаны зоны хранения, назначение и точные размеры каждого блока, рекомендации по складыванию вещей и подходящие товары под каждый блок схемы. Это не просто список органайзеров, а конфигурация, которую можно использовать при покупке и организации пространства.' },
{ q: 'Это просто подборка органайзеров?', a: 'Нет. Рекомендуемые товары — только часть результата. Сначала Уместно собирает схему: какие зоны нужны, что где хранить и какой формат подходит для каждой категории вещей. И уже после этого показывает товары под конкретные блоки схемы.' },
{ q: 'Можно ли сохранить результат?', a: 'Да. Итоговую схему можно скачать или отправить себе на почту, чтобы вернуться к ней перед покупкой органайзеров или при организации хранения.' },
{ q: 'Нужно ли точно считать все вещи?', a: 'Нет, пересчитывать каждую вещь до штуки не нужно. В калькуляторе для каждого типа вещей будут свои понятные диапазоны: мало / средне / много с указанием количества. Например, для носков это будет количество пар, для белья — количество штук, для маек — примерное количество сложенных вещей. Вы выбираете ближайший вариант, а система использует его для расчёта зоны, формата хранения и вместимости.' },
{ q: 'Нужно ли знать точные размеры ящика?', a: 'Да, лучше указать внутренние размеры пространства: ширину, глубину и полезную высоту. Важно измерять именно внутреннюю часть, а не внешние размеры мебели. Особенно важна высота: если её не учесть, органайзер может мешать закрытию. Если точных размеров пока нет, можно сделать расчёт на базе примерных размеров, но перед покупкой товаров лучше сверить их с реальными замерами.' },
{ q: 'В чём разница между режимами расчёта?', a: '«Удобно» направлен на то, чтобы вещи было проще видеть и доставать. «Вместительно» — чтобы использовать пространство максимально плотно. «Экономично» — чтобы собрать рекомендации из более простых и доступных вариантов. Режим влияет на то, как система расставляет приоритеты при подборе схемы и товаров.' },
{ q: 'Почему типы вещей и места хранения ограничены?', a: 'Потому что Уместно не делает абстрактных советов «для всего дома сразу». Мы стараемся расширять места применения и типы вещей, но на эффективное тестирование системы уходит определённое время, чтобы результат был гарантированно удачным. Поэтому на первом этапе сервис работает с теми сценариями, в которых мы точно уверены. Так схема получается не общей рекомендацией, а рабочей конфигурацией.' },
{ q: 'Какую систему организации пространства вы используете?', a: 'Перед проектированием конфигуратора мы изучили подходы профессиональных организаторов пространства и известные методики домашнего хранения, включая принципы Мари Кондо, вертикального складывания, группировки вещей и хранения по частоте использования. Уместно не копирует одну систему целиком. Мы переводим лучшие практики в расчётную логику: какие вещи держать рядом, какой формат хранения выбрать, какие зоны сделать доступнее и как собрать всё в одну конфигурацию.' },
{ q: 'Можно ли использовать свои органайзеры?', a: 'Да. Рекомендованные товары помогают быстрее собрать решение, но вы можете использовать похожие органайзеры, если они подходят по размеру, высоте и формату хранения. Главное — сохранить логику схемы: какие блоки нужны, что в них хранить и как они должны работать вместе.' },
{ q: 'Что делать, если схема не подходит?', a: 'Напишите нам на help@umestno-home.ru и расскажите, что именно не сработало: схема выглядит неверно, товар не подходит под блок или результат не совпал с вашими размерами. Мы проверим расчёт вручную. Если ошибка была на стороне Уместно, пересоберём схему или вернём деньги. Чтобы быстрее разобраться, можно приложить фото пространства или скрин результата.' }];


const FAQItem = ({ q, a, open, onClick, idx }) => {
  const ref = React.useRef(null);
  const [h, setH] = React.useState(0);
  React.useEffect(() => {if (ref.current) setH(ref.current.scrollHeight);}, [open, a]);
  return (
    <div className={`u-faq__item ${open ? 'open' : ''}`}>
      <div className="u-faq__q" onClick={onClick}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
          <span style={{ fontFamily: 'var(--f-display)', fontSize: 'var(--fs-md)', color: 'var(--u-accent)', minWidth: 24 }}>0{idx + 1}</span>
          <span>{q}</span>
        </div>
        <span className="ic"><Icon name="plus" size={18} /></span>
      </div>
      <div className="u-faq__a" style={{ maxHeight: open ? h : 0 }}>
        <div className="u-faq__a__inner" ref={ref}>{a}</div>
      </div>
    </div>);

};

const FAQ = () => {
  const [open, setOpen] = React.useState(0);
  return (
    <section className="u-section" id="faq" data-screen-label="09 FAQ" data-chapter="07">
      <div className="u-container" data-comment-anchor="ba6db99ba1-div-500-7">
        <div className="u-sec-head">
        <div className="u-sec-head__main">
          <div className="u-sec-head__num">N° 07 · ЧАСТО ЗАДАВАЕМЫЕ ВОПРОСЫ</div>
          <h2 className="u-sec-head__title">Коротко о том, как <em>устроено Уместно</em></h2>
        </div>
          <p className="u-sec-head__lede">Если остался вопрос, пишите на help@umestno-home.ru.</p>
        </div>
        <div className="u-faq">
          {FAQS.map((f, i) =>
          <FAQItem key={i} idx={i} {...f} open={open === i} onClick={() => setOpen(open === i ? -1 : i)} />
          )}
        </div>
      </div>
    </section>);

};

// ── 10. Финальный CTA ──────────────────────────────────────
const FinalCTA = () =>
<section className="u-section u-section--tight" data-screen-label="10 Финальный CTA">
    <div className="u-container">
      <div className="u-finalcta--fade">
        <div className="u-finalcta__inner">
          <div className="u-finalcta__art">
            <img src="assets/final-cta.webp" alt="Готовое решение по хранению" />
          </div>
          <div className="u-finalcta__copy">
            <h3 style={{ fontFamily: 'var(--f-display)', fontWeight: 'var(--fw-display)', fontSize: 'var(--fs-h3)', lineHeight: 'var(--lh-tight)', margin: 0 }}>
              Получите долгосрочный <em style={{ color: 'var(--u-accent)', fontStyle: 'normal' }}>порядок</em> <span style={{ whiteSpace: 'nowrap' }}>и удобное</span> хранение в своём ящике
            </h3>
            <p style={{ margin: '16px 0 24px', color: 'var(--u-ink-2)', fontSize: 'var(--fs-md)', maxWidth: '52ch' }}>Начните с любого сценария, чтобы понять, насколько это быстро. Полная схема расчёта за 149 ₽, без подписок.

          </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="u-btn u-btn--accent u-btn--lg">Начать подбор<Icon name="arrow-right" size={16} /></button>
              <div style={{ display: 'flex', gap: 18, color: 'var(--u-ink-3)', fontSize: 'var(--fs-xs)', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="check" size={14} />149 ₽ один раз</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="check" size={14} />Без подписок</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="check" size={14} />Файл на почту</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>;


const Footer = () =>
<footer className="u-footer">
    <div className="u-container">
      <div className="u-footer__grid">
        <div className="u-footer__brand">
          <a href="#" className="u-logo">у<span className="m">М</span>естно</a>
          <p>Красивый порядок начинается с удобного решения.</p>
        </div>
        <div className="u-footer__col">
          <h6>Продукт</h6>
          <a href="#how">Как это работает</a>
          <a href="#result">Результат</a>
          <a href="#whom">Для кого</a>
          <a href="#reviews">Отзывы</a>
        </div>
        <div className="u-footer__col">
          <h6>Помощь</h6>
          <a href="#faq">FAQ</a>
          <a href="mailto:help@umestno-home.ru">help@umestno-home.ru</a>
        </div>
        <div className="u-footer__col">
          <h6>Документы</h6>
          <a href="#">Политика конфиденциальности</a>
          <a href="#">Условия использования</a>
        </div>
        <div className="u-footer__col">
          <h6>Соцсети</h6>
          <div className="u-footer__socials">
            <a href="#" aria-label="Pinterest"><Icon name="pinterest" size={18} /></a>
            <a href="#" aria-label="Telegram"><Icon name="tg" size={18} /></a>
            <a href="#" aria-label="VK"><Icon name="vk" size={18} /></a>
          </div>
        </div>
      </div>
      <div className="u-footer__bottom">
        <div>© Уместно, 2026</div>
        <div>Сделано с заботой о порядке и пространстве.</div>
      </div>
    </div>
  </footer>;


Object.assign(window, { Header, Problem, HowItWorks, Configurator, Result, Logic, Benefits, Reviews, FAQ, FinalCTA, Footer, Interlude, StatsStrip });

// ── Interlude ─────────────────────────────────────────
function Interlude() {
  return (
    <section className="u-interlude" data-screen-label="— Интерлюдия">
      <img src="assets/branch-leaves.png" alt="" className="u-decor u-decor--interlude-l" aria-hidden="true" />
      <img src="assets/branch-twig.png" alt="" className="u-decor u-decor--interlude-r" aria-hidden="true" />
      <div className="u-interlude__inner">
        <p className="u-interlude__text" style={{ fontSize: "60px", width: "1200px", maxWidth: "100%" }}>Порядок начинается <em style={{ letterSpacing: "-1.5px", fontSize: "60px" }}>не с покупки органайзеров</em>,<br />а с удобной системы, которую легко поддерживать каждый день.</p>
        <div className="u-interlude__source">принцип Уместно</div>
      </div>
    </section>);

}

// ── Stats strip ─────────────────────────────────────────
function StatsStrip() {
  return (
    <section className="u-section u-section--tight" data-screen-label="— Цифры">
      <div className="u-container">
        <div className="u-stats">
          <div className="u-stats__cell" data-comment-anchor="152e5f55e1-div-613-11">
            <div className="u-stats__lbl">ОПЛАТА</div>
            <div className="u-stats__num"><em>149</em> <small>₽</small></div>
            <div className="u-stats__sub">один раз за полную схему — без подписок</div>
          </div>
          <div className="u-stats__cell">
            <div className="u-stats__lbl">ВРЕМЯ</div>
            <div className="u-stats__num">2–<em>3</em><small>мин</small></div>
            <div className="u-stats__sub">от ввода размеров до готовой конфигурации</div>
          </div>
          <div className="u-stats__cell">
            <div className="u-stats__lbl">ДОСТУП</div>
            <div className="u-stats__num"><em>∂</em></div>
            <div className="u-stats__sub">файл со схемой остаётся у вас навсегда</div>
          </div>
        </div>
      </div>
    </section>);

}