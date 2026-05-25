// V1 — Warm SaaS: Manrope, no italics, product-feeling, terracotta accent

const V1Saas = () => (
  <div className="dir-v1">
    <header className="top">
      <a href="#" className="top__logo"><span className="mk">у</span>Уместно</a>
      <nav className="top__nav">
        <a href="#">Как работает</a>
        <a href="#">Принципы</a>
        <a href="#">Отзывы</a>
        <a href="#">Цена</a>
        <a href="#">FAQ</a>
      </nav>
      <div className="top__cta">
        <span className="top__pill"><span className="d"></span>178 расчётов сегодня</span>
        <button className="btn btn--primary">Начать <Icon name="arrow-right" size={14}/></button>
      </div>
    </header>

    <section className="hero">
      <div className="hero__grid">
        <div>
          <span className="hero__pre"><span className="dot"></span>v1 · конфигуратор хранения<span className="v">для одного ящика</span></span>
          <h1>Готовая <mark>схема ящика</mark> — за пару минут, без таблиц и десятка карточек.</h1>
          <p className="hero__lead">Введите размеры и категорию вещей. Уместно соберёт раскладку, подпишет каждую зону и подберёт совместимые между собой органайзеры.</p>
          <div className="hero__ctas">
            <button className="btn btn--accent btn--lg">Собрать схему — 149&nbsp;₽ <Icon name="arrow-right" size={14}/></button>
            <button className="btn btn--ghost btn--lg">Посмотреть пример</button>
          </div>
          <div className="hero__trust">
            <div><b>149&nbsp;₽</b>один раз, без подписки</div>
            <div><b>2–3 мин</b>от размеров до схемы</div>
            <div><b>∞</b>файл остаётся у вас</div>
          </div>
        </div>

        <div className="app">
          <div className="app__bar">
            <span className="app__dots"><span></span><span></span><span></span></span>
            <span className="app__title">umestno.ru/расчёт · черновик</span>
            <span className="app__crumb">шаг 2/3</span>
          </div>
          <div className="app__body">
            <div className="app__row" style={{margin: '0 0 12px'}}>
              <span style={{fontWeight: 600, color: 'var(--ink)'}}>Размеры пространства</span>
              <div className="seg">
                <button className="on">Ящик</button>
                <button>Полка</button>
                <button>Секция</button>
              </div>
            </div>
            <div className="field-grid">
              <div className="field"><label>Ширина</label><div className="inp">80<span className="u">см</span></div></div>
              <div className="field"><label>Глубина</label><div className="inp">45<span className="u">см</span></div></div>
              <div className="field"><label>Высота</label><div className="inp">15<span className="u">см</span></div></div>
            </div>
            <div className="app__row">
              <span>Что хранить?</span>
              <span style={{fontWeight: 600, color: 'var(--ink)'}}>Бельё и носки <Icon name="chevron-right" size={12}/></span>
            </div>
            <div className="app__row" style={{marginBottom: 4}}>
              <span style={{color: 'var(--ink-3)', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '.04em'}}>предпросмотр схемы</span>
              <span style={{color: 'var(--ink-3)', fontSize: 11, fontFamily: '"JetBrains Mono", monospace'}}>4 блока · 11 ячеек</span>
            </div>
            <div className="schema">
              <div className="schema__b schema__b--a"><span className="nm">01 · Трусы</span><span className="sz">26 × 22 см</span></div>
              <div className="schema__b schema__b--b"><span className="nm">02 · Носки</span><span className="sz">20 × 22 см</span></div>
              <div className="schema__b schema__b--c"><span className="nm">03 · Майки</span><span className="sz">22 × 45 см</span></div>
              <div className="schema__b schema__b--d"><span className="nm">04 · Аксессуары</span><span className="sz">46 × 22 см</span></div>
            </div>
            <div className="app__summary">
              <div>
                <div style={{fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.04em', marginBottom: 2}}>ИТОГО ЗА СХЕМУ</div>
                <div><b>149&nbsp;₽</b> · один раз · без подписок</div>
              </div>
              <button className="btn btn--accent">Получить схему <Icon name="arrow-right" size={14}/></button>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* PROBLEM */}
    <section className="sec sec--alt">
      <div className="sec__head">
        <span className="sec__num"><span className="d"></span>01 · Проблема</span>
        <h2>Когда хочется порядок, но приходится <b>собирать сложный пазл</b></h2>
        <span className="sec__sub">Знакомо? Тогда читай дальше →</span>
      </div>
      <div className="pains">
        <div className="pain">
          <span className="pain__lbl">— 01 ВРЕМЯ</span>
          <h3>На подбор уходит слишком много времени</h3>
          <p>Сравнивать десятки карточек органайзеров, держать в голове размеры и сочетания — задача на полдня.</p>
          <span className="pain__tag">3–6 часов в среднем</span>
        </div>
        <div className="pain">
          <span className="pain__lbl">— 02 СОЧЕТАЕМОСТЬ</span>
          <h3>Отдельные органайзеры не работают вместе</h3>
          <p>Каждый выглядит подходяще, а в ящике получается зоопарк. Что-то болтается, что-то не закрывает крышку.</p>
          <span className="pain__tag">23% возврата</span>
        </div>
        <div className="pain">
          <span className="pain__lbl">— 03 ПОЛЬЗА</span>
          <h3>Ящик заполнен, но пользоваться неудобно</h3>
          <p>Органайзеры есть, а вещи всё равно сваливаются. Категории смешиваются, частые вещи лежат под редкими.</p>
          <span className="pain__tag">проверено на себе</span>
        </div>
      </div>
    </section>

    {/* STEPS */}
    <section className="sec">
      <div className="sec__head">
        <span className="sec__num"><span className="d" style={{background: 'var(--sage)'}}></span>02 · Решение</span>
        <h2>Три шага — и схема собрана</h2>
        <span className="sec__sub">~2 минуты от первого клика до файла</span>
      </div>
      <div className="steps">
        <div className="step">
          <div className="step__n"><b>Шаг 01</b>  /  ВВОД РАЗМЕРОВ</div>
          <h3>Укажите глубину, ширину и высоту</h3>
          <p>По внутренним размерам пространства. Замеряете один раз — данные сохраняются.</p>
          <div className="step__art dir-ph">ruler · drawer outline</div>
        </div>
        <div className="step">
          <div className="step__n"><b>Шаг 02</b>  /  ВЫБОР КАТЕГОРИИ</div>
          <h3>Что и сколько будете хранить</h3>
          <p>Отмечаете тип вещей и примерный объём. Не пересчитывая каждую штуку — мало / средне / много.</p>
          <div className="step__art dir-ph">checkbox list · categories</div>
        </div>
        <div className="step">
          <div className="step__n"><b>Шаг 03</b>  /  СХЕМА + ТОВАРЫ</div>
          <h3>Получите файл и подбор товаров</h3>
          <p>Схема раскладки, подписи блоков, совместимые между собой органайзеры — единым файлом на почту.</p>
          <div className="step__art dir-ph">file · 4 blocks · checklist</div>
        </div>
      </div>
    </section>

    {/* RESULT */}
    <section className="sec sec--alt">
      <div className="sec__head">
        <span className="sec__num"><span className="d"></span>03 · Результат</span>
        <h2>Что вы получаете — <b>четыре части</b> одного решения</h2>
        <span className="sec__sub">не сухой список, а конфигурация</span>
      </div>
      <div className="result">
        <div className="rcard rcard--a">
          <span className="tag">// СХЕМА · ОСНОВА</span>
          <h4 style={{fontSize: 26}}>Схема хранения с зонами и размерами каждого блока</h4>
          <p style={{maxWidth: 400}}>Наглядный план: ширина и глубина каждого блока, что в нём лежит и почему.</p>
          <div className="preview"><span></span><span></span><span></span><span></span></div>
        </div>
        <div className="rcard rcard--b">
          <span className="tag">// НАЗНАЧЕНИЕ</span>
          <h4>Подписан каждый блок</h4>
          <p>Не просто «куда-то». Для каждой зоны указано, что и почему лежит именно здесь — с учётом частоты использования.</p>
        </div>
        <div className="rcard rcard--c">
          <span className="tag">// ПАМЯТКА</span>
          <h4>Как складывать и распределять</h4>
          <p>Подсказки по складыванию и слотам — чтобы порядок поддерживался сам.</p>
        </div>
        <div className="rcard rcard--d">
          <span className="tag">// ТОВАРЫ</span>
          <h4>Подбор под каждый блок</h4>
          <p>Не общая выдача — конкретные органайзеры по размерам и формату ваших зон.</p>
        </div>
        <div className="rcard rcard--e">
          <h4>1 файл, остаётся у вас навсегда</h4>
          <p>Можно открыть перед покупкой, переслать партнёру или вернуться через год.</p>
        </div>
      </div>
    </section>

    {/* REVIEW */}
    <section className="sec">
      <div className="sec__head">
        <span className="sec__num"><span className="d"></span>04 · Отзывы</span>
        <h2>«Я бы сама очень долго собирала это <b>по частям</b>»</h2>
        <span className="sec__sub">5 историй с фото до/после</span>
      </div>
      <div className="rev">
        <div>
          <q>Я бы сама очень долго собирала это по частям. Здесь сразу стало понятно, что покупать и как это должно встать внутри.</q>
          <div className="who">
            <span className="av">А</span>
            <div><b>Анна</b><span>Москва · комод 80×45</span></div>
          </div>
        </div>
        <div className="rev__compare">
          <div className="rev__img">
            <img src="assets/review1-bfr.webp" alt="До" />
            <span className="pill">До</span>
          </div>
          <div className="rev__img">
            <img src="assets/review1-aftr.webp" alt="После" />
            <span className="pill after">После</span>
          </div>
        </div>
      </div>
    </section>

    {/* FAQ */}
    <section className="sec sec--alt">
      <div className="sec__head">
        <span className="sec__num"><span className="d"></span>05 · Частые вопросы</span>
        <h2>Коротко о том, как <b>устроено Уместно</b></h2>
        <span className="sec__sub">help@umestno-home.ru</span>
      </div>
      <div className="faq">
        <div className="faq__item">
          <span className="faq__n">01</span>
          <div>
            <div className="faq__q">Что я получу после расчёта?</div>
            <div className="faq__a">Схему хранения под ваши размеры: зоны, размеры блоков, рекомендации по складыванию и список совместимых органайзеров под каждый блок. Единым файлом.</div>
          </div>
          <span className="faq__plus"><Icon name="plus" size={16}/></span>
        </div>
        <div className="faq__item">
          <span className="faq__n">02</span>
          <div>
            <div className="faq__q">Это просто подборка органайзеров?</div>
            <div className="faq__a">Нет. Товары — только часть результата. Сначала собирается схема: какие зоны, что где хранить, какой формат подходит. Потом — товары под конкретные блоки.</div>
          </div>
          <span className="faq__plus"><Icon name="plus" size={16}/></span>
        </div>
        <div className="faq__item">
          <span className="faq__n">03</span>
          <div>
            <div className="faq__q">Нужно ли точно считать все вещи?</div>
            <div className="faq__a">Нет. В калькуляторе для каждого типа есть понятные диапазоны (мало / средне / много) с указанием количества — выбираете ближайший.</div>
          </div>
          <span className="faq__plus"><Icon name="plus" size={16}/></span>
        </div>
        <div className="faq__item">
          <span className="faq__n">04</span>
          <div>
            <div className="faq__q">Можно ли использовать свои органайзеры?</div>
            <div className="faq__a">Да. Главное — сохранить логику схемы: какие блоки нужны, что в них хранить, как они должны работать вместе.</div>
          </div>
          <span className="faq__plus"><Icon name="plus" size={16}/></span>
        </div>
      </div>
    </section>

    {/* FINAL */}
    <section className="finale">
      <div className="finale__inner">
        <div>
          <h3>Получите долгосрочный <b>порядок</b> в одном файле — навсегда.</h3>
          <p>149&nbsp;₽ один раз. Без подписок и тарифов. Открытая логика подбора.</p>
        </div>
        <div className="finale__cta">
          <button className="btn btn--accent">Начать расчёт <Icon name="arrow-right" size={14}/></button>
          <span className="tiny">VISA · MIR · СБП · 149₽</span>
        </div>
      </div>
    </section>
    <div className="foot">
      <span>© Уместно, 2026</span>
      <span>help@umestno-home.ru · Telegram · VK</span>
    </div>
  </div>
);

window.V1Saas = V1Saas;
