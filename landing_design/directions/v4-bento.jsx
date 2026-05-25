// V4 — Bento Product: cards-first showcase, Apple-style, warm palette

const V4Bento = () => (
  <div className="dir-v4">
    <div className="top">
      <a href="#" className="logo">уМестно.</a>
      <nav>
        <a href="#">Как работает</a>
        <a href="#">Принципы</a>
        <a href="#">Отзывы</a>
        <a href="#">FAQ</a>
      </nav>
      <button className="btn">Начать <b>149₽</b></button>
    </div>

    {/* HERO BENTO */}
    <section className="bento bento--hero">
      <div className="card card--big">
        <span className="pre">конфигуратор хранения · v1</span>
        <h1>Готовая схема ящика <em>за 2 минуты</em>, без таблиц и десятка карточек.</h1>
        <p className="lede">Введите размеры и категорию вещей. Уместно соберёт раскладку, подпишет каждую зону и подберёт совместимые между собой органайзеры.</p>
        <div className="row">
          <button className="btn">Собрать схему <b>· 149₽</b> <Icon name="arrow-right" size={14}/></button>
          <button className="ghost">Посмотреть пример <Icon name="arrow-up-right" size={14}/></button>
        </div>
      </div>
      <div className="card card--price">
        <span className="pre">— Цена</span>
        <div>
          <div className="v">149<small>₽</small></div>
          <p style={{margin: '10px 0 0', opacity: .9, fontSize: 14}}>Один раз. Без подписок и тарифов.</p>
        </div>
        <div className="row">
          <div><b>2–3 мин</b>на расчёт</div>
          <div><b>1 файл</b>на почту</div>
        </div>
      </div>
      <div className="card card--stat">
        <span className="pre">— За неделю</span>
        <div className="v">+218<small>схем</small></div>
        <p>Семьи, пары, переезжающие. Каждый ящик — индивидуальная конфигурация.</p>
      </div>

      <div className="card card--demo">
        <div>
          <span className="pre">— живой предпросмотр</span>
          <h2>Меняйте параметры — <em>схема пересобирается</em></h2>
          <p>Не нужно регистрироваться, чтобы прикинуть свой ящик. Введите размеры и категорию — увидите расположение блоков и список органайзеров.</p>
          <div className="quickform">
            <div className="lbl">// РАЗМЕРЫ ВАШЕГО ЯЩИКА</div>
            <div className="grid">
              <div>80<small>см</small></div>
              <div>45<small>см</small></div>
              <div>15<small>см</small></div>
            </div>
            <div className="sub"><span>Категория</span><b>бельё, носки →</b></div>
          </div>
        </div>
        <div className="preview">
          <span><b style={{display: 'block', fontFamily: 'Manrope', fontSize: 14, letterSpacing: '-.01em', marginBottom: 4}}>A · Трусы</b>26 × 22</span>
          <span><b style={{display: 'block', fontFamily: 'Manrope', fontSize: 14, letterSpacing: '-.01em', marginBottom: 4}}>B · Носки</b>20 × 22</span>
          <span><b style={{display: 'block', fontFamily: 'Manrope', fontSize: 14, letterSpacing: '-.01em', marginBottom: 4, color: '#fff'}}>C · Майки</b><span style={{color: 'rgba(255,255,255,.7)'}}>22 × 45</span></span>
          <span><b style={{display: 'block', fontFamily: 'Manrope', fontSize: 14, letterSpacing: '-.01em', marginBottom: 4}}>D · Аксессуары</b>46 × 22</span>
        </div>
      </div>
    </section>

    {/* PROBLEM */}
    <section className="sec">
      <div className="sec__hd">
        <div>
          <div className="pre">— проблема</div>
          <h2>Когда хочется порядок,<br/>но приходится <em>собирать пазл</em></h2>
        </div>
        <span className="meta">01 / 06</span>
      </div>
      <div className="bento bento--3">
        <div className="pcard">
          <span className="n">— 01 · ВРЕМЯ</span>
          <h3>На подбор уходит <em>слишком много</em> времени</h3>
          <p>30 вкладок, таблицы, поездки в магазин «померить на месте». Полдня — на один ящик.</p>
          <div className="vis dir-ph">tabs · table · ruler</div>
        </div>
        <div className="pcard">
          <span className="n">— 02 · СОЧЕТАЕМОСТЬ</span>
          <h3>Органайзеры <em>не дружат</em> друг с другом</h3>
          <p>Каждый сам по себе подходит, а в ящике — зоопарк. Что-то болтается, что-то мешает крышке.</p>
          <div className="vis dir-ph">mismatched grid</div>
        </div>
        <div className="pcard">
          <span className="n">— 03 · ПОЛЬЗА</span>
          <h3>Ящик заполнен, а <em>пользоваться неудобно</em></h3>
          <p>Категории смешиваются, частые вещи под редкими. Беспорядок возвращается через неделю.</p>
          <div className="vis dir-ph">mess</div>
        </div>
      </div>
    </section>

    {/* STEPS */}
    <section className="sec">
      <div className="sec__hd">
        <div>
          <div className="pre">— как это работает</div>
          <h2>Три шага — <em>и схема собрана</em></h2>
        </div>
        <span className="meta">02 / 06 · ~2 мин</span>
      </div>
      <div className="bento bento--steps">
        <div className="step4">
          <span className="n">01 — РАЗМЕРЫ</span>
          <h3>Введите внутренние размеры</h3>
          <p>Ширина, глубина, высота. Замеряете один раз — данные сохраняются.</p>
          <div className="demo dir-ph">drawer · 80×45×15</div>
        </div>
        <div className="step4 step4--2">
          <span className="n" style={{color: 'var(--sage)'}}>02 — КАТЕГОРИЯ</span>
          <h3>Что и сколько будете хранить</h3>
          <p>Тип вещей и примерный объём — мало / средне / много. Без штучного пересчёта.</p>
          <div className="demo dir-ph" style={{'--ph-bg': '#C8D2BB'}}>checkbox · category</div>
        </div>
        <div className="step4 step4--3">
          <span className="n">03 — СХЕМА + ТОВАРЫ</span>
          <h3>Получите файл на почту</h3>
          <p>Схема, подписи блоков, совместимые органайзеры под каждый блок. Один файл, навсегда.</p>
          <div className="demo dir-ph" style={{'--ph-bg': '#E8C0A4'}}>file · 4 blocks</div>
        </div>
      </div>
    </section>

    {/* RESULT */}
    <section className="sec">
      <div className="sec__hd">
        <div>
          <div className="pre">— что в файле</div>
          <h2>Четыре части <em>одного решения</em></h2>
        </div>
        <span className="meta">03 / 06</span>
      </div>
      <div className="bento bento--result">
        <div className="rb rb--a">
          <span className="pre">— 01 СХЕМА</span>
          <h4>Готовая раскладка с размерами каждого блока</h4>
          <p>Не общий совет, а конкретный план: что куда лежит и почему.</p>
          <div className="schemavis">
            <span><b style={{fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, color: 'rgba(0,0,0,.7)', display: 'block', letterSpacing: '-.01em'}}>A · Трусы</b>26 × 22</span>
            <span><b style={{fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, color: 'rgba(0,0,0,.7)', display: 'block', letterSpacing: '-.01em'}}>B · Носки</b>20 × 22</span>
            <span><b style={{fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, color: 'rgba(0,0,0,.7)', display: 'block', letterSpacing: '-.01em'}}>C · Майки</b>22 × 45</span>
            <span><b style={{fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, color: 'rgba(0,0,0,.7)', display: 'block', letterSpacing: '-.01em'}}>D · Аксес.</b>46 × 22</span>
          </div>
        </div>
        <div className="rb rb--b">
          <span className="pre">— 02 НАЗНАЧЕНИЕ</span>
          <h4>Подписан каждый блок</h4>
          <p>Для каждой зоны — что и почему лежит именно здесь, с учётом частоты использования.</p>
        </div>
        <div className="rb rb--c">
          <span className="pre">— 03 ПАМЯТКА</span>
          <h4>Как складывать и поддерживать</h4>
          <p>Подсказки по складыванию вещей внутри блоков — чтобы порядок не уезжал через неделю.</p>
        </div>
        <div className="rb rb--d">
          <span className="pre">— 04 ТОВАРЫ</span>
          <h4>Подбор под каждый блок схемы</h4>
          <p>Не общая выдача — конкретные органайзеры под ваши размеры и формат хранения.</p>
        </div>
        <div className="rb rb--e">
          <span className="pre">— ФАЙЛ</span>
          <h4>1 файл, остаётся у вас</h4>
          <p>Можно открыть перед покупкой, переслать партнёру, вернуться через год.</p>
        </div>
      </div>
    </section>

    {/* REVIEWS */}
    <section className="sec">
      <div className="sec__hd">
        <div>
          <div className="pre">— отзывы</div>
          <h2>Что говорят те, <em>кто уже попробовал</em></h2>
        </div>
        <span className="meta">04 / 06 · 5 историй</span>
      </div>
      <div className="bento bento--rev">
        <div className="revb">
          <div className="copy">
            <q>Я бы сама очень долго собирала это по частям. Здесь сразу стало понятно, что покупать и как это должно встать внутри.</q>
            <div className="who"><span className="av">А</span><div><b>Анна</b><span>Москва · 80×45</span></div></div>
          </div>
          <div className="pair">
            <div><img src="assets/review1-bfr.webp" alt="до"/><span className="lbl">До</span></div>
            <div><img src="assets/review1-aftr.webp" alt="после"/><span className="lbl aft">После</span></div>
          </div>
        </div>
        <div className="revb">
          <div className="copy">
            <q>Сервис показал не просто товары, а саму логику хранения. Наконец стало удобно пользоваться ящиком.</q>
            <div className="who"><span className="av">Е</span><div><b>Елена</b><span>Владикавказ · 70×40</span></div></div>
          </div>
          <div className="pair">
            <div><img src="assets/review2-bfr.webp" alt="до"/><span className="lbl">До</span></div>
            <div><img src="assets/review2-aftr.webp" alt="после"/><span className="lbl aft">После</span></div>
          </div>
        </div>
      </div>
    </section>

    {/* FAQ */}
    <section className="sec">
      <div className="sec__hd">
        <div>
          <div className="pre">— FAQ</div>
          <h2>Коротко о том, <em>как устроено</em></h2>
        </div>
        <span className="meta">05 / 06</span>
      </div>
      <div className="bento bento--faq">
        <div className="faqb"><span className="n">— 01</span><p className="q">Что я получу после расчёта?</p><p className="a">Схему хранения под ваши размеры: зоны, размеры блоков, рекомендации по складыванию и список совместимых органайзеров. Единым файлом.</p></div>
        <div className="faqb"><span className="n">— 02</span><p className="q">Это просто подборка органайзеров?</p><p className="a">Нет. Сначала собирается схема: какие зоны и форматы хранения нужны. Уже после — товары под конкретные блоки.</p></div>
        <div className="faqb"><span className="n">— 03</span><p className="q">Нужно точно считать все вещи?</p><p className="a">Нет. Понятные диапазоны: мало / средне / много с указанием количества — выбираете ближайший.</p></div>
        <div className="faqb"><span className="n">— 04</span><p className="q">Можно свои органайзеры?</p><p className="a">Да. Главное — сохранить логику схемы: какие блоки нужны и как они работают вместе.</p></div>
      </div>
    </section>

    {/* FINALE */}
    <div className="finale">
      <div>
        <h3>Получите долгосрочный <em>порядок</em> в одном файле — навсегда.</h3>
        <p>149&nbsp;₽ один раз. Без подписок и тарифов. Открытая логика подбора.</p>
      </div>
      <div className="cta">
        <button className="btn">Начать расчёт <Icon name="arrow-right" size={16}/></button>
        <span className="meta">VISA · MIR · СБП</span>
      </div>
    </div>

    <div className="foot">
      <span>© Уместно, 2026</span>
      <span>help@umestno-home.ru</span>
    </div>
  </div>
);

window.V4Bento = V4Bento;
