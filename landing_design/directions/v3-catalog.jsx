// V3 — Каталог/Спецификация: IKEA/Vitsœ vibe, mono labels, precise grids

const V3Catalog = () => (
  <div className="dir-v3">
    <div className="top">
      <span className="id">CAT.UM.2026 / 01</span>
      <a href="#" className="logo">УМЕСТНО</a>
      <nav>
        <a href="#">Содержание</a>
        <a href="#">Конфигуратор</a>
        <a href="#">Принципы</a>
        <a href="#">FAQ</a>
      </nav>
      <button className="btn">Начать расчёт →</button>
    </div>

    {/* HERO */}
    <section className="hero">
      <div className="hero__head">
        <span className="cat">Издание 01 · Конфигуратор хранения</span>
        <div></div>
        <span className="yr"><span>Тираж</span><b>МСК · 26</b></span>
      </div>
      <h1>
        <span className="lo">Схема</span>
        <span className="lo"><em>ящика</em></span>
        <span className="lo">за 2 мин.</span>
      </h1>

      <div className="hero__sub">
        <div className="lede">Конфигуратор хранения для одного ящика. Введите размеры и категорию вещей — <b>Уместно</b> соберёт раскладку, подпишет каждый блок и подберёт совместимые между собой органайзеры.</div>
        <div className="stat"><span className="meta">Цена</span><span className="val"><b>149 ₽</b></span><span className="meta">один раз</span></div>
        <div className="stat"><span className="meta">Время</span><span className="val">2–3 мин</span><span className="meta">от ввода до файла</span></div>
        <div className="stat"><span className="meta">Файл</span><span className="val">.pdf · 1</span><span className="meta">остаётся у вас</span></div>
      </div>

      <div className="hero__photo">
        <div className="ph" style={{aspectRatio: '16/7'}}>photo · drawer 80×45 cm · top view</div>
        <div className="stamp"><div><b>149₽</b>один раз<br/>без подписки</div></div>
        <div className="callouts">
          <span className="callout">A <b>Трусы</b></span>
          <span className="callout">B <b>Носки</b></span>
          <span className="callout">C <b>Майки</b></span>
          <span className="callout">D <b>Аксессуары</b></span>
        </div>
      </div>

      <div className="hero__cta">
        <button className="btn">Собрать схему <span className="price">— 149 ₽</span></button>
        <a className="alt" href="#">Посмотреть пример →</a>
        <div className="specs">
          <div><b>149 ₽</b>один раз</div>
          <div><b>2–3 мин</b>на расчёт</div>
          <div><b>1 файл</b>навсегда</div>
        </div>
      </div>
    </section>

    {/* PROBLEMS */}
    <section className="sec">
      <div className="sec__head">
        <span className="n"><b>02</b> / 09</span>
        <h2>Когда хочется порядок,<br/>но приходится <em>собирать сложный пазл</em></h2>
        <span className="tag">— Глава 01</span>
      </div>
      <div className="ptable">
        <div className="prow">
          <span className="n">01.</span>
          <div className="ttl">На подбор уходит <em>слишком много</em> времени</div>
          <div className="desc">Нужно искать, сравнивать десятки карточек и держать в голове, что может подойти, а что нет.</div>
          <div className="ph">— ph: open tabs</div>
        </div>
        <div className="prow">
          <span className="n">02.</span>
          <div className="ttl">Сложно собрать <em>всё вместе</em></div>
          <div className="desc">Отдельные органайзеры выглядят подходяще, но неясно, как они будут работать друг с другом.</div>
          <div className="ph">— ph: mismatched</div>
        </div>
        <div className="prow">
          <span className="n">03.</span>
          <div className="ttl">Ящик заполнен, но хранить <em>всё равно неудобно</em></div>
          <div className="desc">Органайзеры занимают место, но не подходят под то, что вы храните на самом деле.</div>
          <div className="ph">— ph: messy</div>
        </div>
      </div>
    </section>

    {/* STEPS */}
    <section className="sec">
      <div className="sec__head">
        <span className="n"><b>03</b> / 09</span>
        <h2>Три шага.<br/>Никаких таблиц <em>и ручного сбора</em>.</h2>
        <span className="tag">— Метод</span>
      </div>
      <div className="diagram">
        <div className="cell">
          <div className="n">01</div>
          <h3>Введите размеры</h3>
          <p>Ширина, глубина, высота — по внутренним размерам пространства.</p>
          <div className="demo dir-ph">drawer outline / 80×45×15</div>
          <span className="lbl">fig. 01 — frame</span>
        </div>
        <div className="cell">
          <div className="n">02</div>
          <h3>Выберите категорию</h3>
          <p>Тип вещей и примерный объём — мало / средне / много.</p>
          <div className="demo dir-ph">checkbox list / category</div>
          <span className="lbl">fig. 02 — picker</span>
        </div>
        <div className="cell">
          <div className="n">03</div>
          <h3>Получите файл</h3>
          <p>Схема, подписи блоков, рекомендованные товары. На почту.</p>
          <div className="demo dir-ph">file / 4 blocks</div>
          <span className="lbl">fig. 03 — output</span>
        </div>
      </div>
    </section>

    {/* CONFIGURATOR — spec sheet */}
    <section className="sec">
      <div className="sec__head">
        <span className="n"><b>04</b> / 09</span>
        <h2>Конфигуратор</h2>
        <span className="tag">— Расчёт за 2–3 минуты</span>
      </div>
      <div className="spec">
        <div className="spec__form">
          <h3>Параметры пространства</h3>
          <div className="row"><span className="l">Тип пространства</span><div className="seg"><button className="on">ЯЩИК</button><button>ПОЛКА</button><button>СЕКЦИЯ</button></div></div>
          <div className="row"><span className="l">Ширина</span><span className="v">80<small>см</small></span></div>
          <div className="row"><span className="l">Глубина</span><span className="v">45<small>см</small></span></div>
          <div className="row"><span className="l">Высота</span><span className="v">15<small>см</small></span></div>
          <div className="row"><span className="l">Что хранить</span><span className="v">бельё, носки</span></div>
          <div className="row"><span className="l">Приоритет</span><div className="seg"><button className="on">УДОБНО</button><button>ВМЕСТНО</button><button>ЭКОНОМ</button></div></div>
          <button className="submit">Получить схему <span>149 ₽ →</span></button>
        </div>
        <div className="spec__result">
          <h4>// Рекомендуемая конфигурация</h4>
          <div className="schema">
            <div className="a"><span className="tg">A</span><div><span className="nm">Трусы</span><br/><span className="dm">26 × 22 см</span></div></div>
            <div className="b"><span className="tg">B</span><div><span className="nm">Носки</span><br/><span className="dm">20 × 22 см</span></div></div>
            <div className="c"><span className="tg">C</span><div><span className="nm">Майки</span><br/><span className="dm">22 × 45 см</span></div></div>
            <div className="d"><span className="tg">D</span><div><span className="nm">Аксессуары</span><br/><span className="dm">46 × 22 см</span></div></div>
          </div>
          <div className="table">
            <div className="r"><span className="b">A</span><span className="nm">Разделитель для трусов</span><span className="sz">26 × 22</span><span className="pr">440 ₽</span></div>
            <div className="r"><span className="b">B</span><span className="nm">Разделитель для носков</span><span className="sz">20 × 22</span><span className="pr">320 ₽</span></div>
            <div className="r"><span className="b">C</span><span className="nm">Коробка для маек</span><span className="sz">22 × 45</span><span className="pr">580 ₽</span></div>
            <div className="r"><span className="b">D</span><span className="nm">Лоток для аксессуаров</span><span className="sz">46 × 22</span><span className="pr">390 ₽</span></div>
          </div>
          <div className="totals">
            <div><div className="c">КОНФИГУРАЦИЯ</div><div className="v">4 блока / 11 ячеек</div></div>
            <div><div className="c">ПОДБОР</div><div className="v"><b>≈ 1 730 ₽</b></div></div>
          </div>
        </div>
      </div>
    </section>

    {/* RESULT INDEX */}
    <section className="sec">
      <div className="sec__head">
        <span className="n"><b>05</b> / 09</span>
        <h2>Что в итоговом файле</h2>
        <span className="tag">— 4 части</span>
      </div>
      <div className="idx">
        <div className="it">
          <span className="n">01.</span>
          <div><h4>Схема хранения</h4><p>План с размерами каждой зоны и подписями блоков. Можно открыть на телефоне в магазине.</p></div>
          <div className="ph">— ph</div>
        </div>
        <div className="it">
          <span className="n">02.</span>
          <div><h4>Назначение блоков</h4><p>Для каждой зоны — что лежит и почему именно здесь, с учётом частоты использования.</p></div>
          <div className="ph">— ph</div>
        </div>
        <div className="it">
          <span className="n">03.</span>
          <div><h4>Памятка по складыванию</h4><p>Короткие подсказки, как складывать и распределять вещи внутри блоков.</p></div>
          <div className="ph">— ph</div>
        </div>
        <div className="it">
          <span className="n">04.</span>
          <div><h4>Подобранные товары</h4><p>Конкретные органайзеры под каждый блок схемы — по размерам и формату.</p></div>
          <div className="ph">— ph</div>
        </div>
      </div>
    </section>

    {/* REVIEWS */}
    <section className="sec">
      <div className="sec__head">
        <span className="n"><b>06</b> / 09</span>
        <h2>Отчёты владельцев</h2>
        <span className="tag">— 3 из 5</span>
      </div>
      <div className="revrow">
        <div className="revcard">
          <div className="meta"><span>отчёт № 01</span><span>04 / 26</span></div>
          <div className="pair">
            <div><img src="assets/review1-bfr.webp" alt="до"/><span className="l">до</span></div>
            <div><img src="assets/review1-aftr.webp" alt="после"/><span className="l aft">после</span></div>
          </div>
          <q>Здесь сразу стало понятно, что покупать и как это должно встать внутри.</q>
          <div className="who"><b>Анна</b><span>Москва · 80×45</span></div>
        </div>
        <div className="revcard">
          <div className="meta"><span>отчёт № 02</span><span>03 / 26</span></div>
          <div className="pair">
            <div><img src="assets/review2-bfr.webp" alt="до"/><span className="l">до</span></div>
            <div><img src="assets/review2-aftr.webp" alt="после"/><span className="l aft">после</span></div>
          </div>
          <q>Сервис показал не товары, а саму логику хранения. Не уходит 10 минут на поиск нужной вещи.</q>
          <div className="who"><b>Елена</b><span>Владикавказ · 70×40</span></div>
        </div>
        <div className="revcard">
          <div className="meta"><span>отчёт № 03</span><span>03 / 26</span></div>
          <div className="pair">
            <div><img src="assets/review3-bfr.webp" alt="до"/><span className="l">до</span></div>
            <div><img src="assets/review3-aftr.webp" alt="после"/><span className="l aft">после</span></div>
          </div>
          <q>Сразу получил понятную схему и рекомендации, что купить. Удобно.</q>
          <div className="who"><b>Максим</b><span>СПб · 90×50</span></div>
        </div>
      </div>
    </section>

    {/* FAQ TABLE */}
    <section className="sec">
      <div className="sec__head">
        <span className="n"><b>07</b> / 09</span>
        <h2>Спецификация ответов</h2>
        <span className="tag">— help@umestno-home.ru</span>
      </div>
      <div className="faqt">
        <div className="row">
          <span className="n">Q.01</span>
          <span className="q">Что я получу после расчёта?</span>
          <span className="a">Схему хранения под ваши размеры и выбранные вещи: зоны, подписи блоков, рекомендации по складыванию и совместимые товары под каждый блок.</span>
        </div>
        <div className="row">
          <span className="n">Q.02</span>
          <span className="q">Это просто подборка органайзеров?</span>
          <span className="a">Нет. Сначала собирается схема: какие зоны, что и где хранить, какой формат подходит. И уже потом — товары под конкретные блоки.</span>
        </div>
        <div className="row">
          <span className="n">Q.03</span>
          <span className="q">Нужно ли точно считать все вещи?</span>
          <span className="a">Нет. В калькуляторе для каждого типа вещей есть понятные диапазоны (мало / средне / много) с указанием количества — выбираете ближайший.</span>
        </div>
        <div className="row">
          <span className="n">Q.04</span>
          <span className="q">Можно ли использовать свои органайзеры?</span>
          <span className="a">Да. Главное — сохранить логику схемы: какие блоки нужны, что в них хранить, как они работают вместе.</span>
        </div>
        <div className="row">
          <span className="n">Q.05</span>
          <span className="q">Что делать, если схема не подходит?</span>
          <span className="a">Напишите на help@umestno-home.ru — проверим вручную. Если ошибка с нашей стороны — пересоберём или вернём деньги.</span>
        </div>
      </div>
    </section>

    {/* ORDER */}
    <div className="order">
      <div className="order__l">
        <span className="order__lbl">— 08 / 09 · Заказ</span>
        <h3>Соберите свой <em>ящик</em></h3>
        <p>Один файл со схемой и подобранными товарами. Без подписок, тарифов и регистраций. Файл остаётся у вас навсегда.</p>
        <div style={{display: 'flex', gap: 20, fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '.08em', color: 'var(--ink-3)', textTransform: 'uppercase'}}>
          <span>VISA</span><span>MIR</span><span>СБП</span><span>—</span><span>Безопасно</span>
        </div>
      </div>
      <div className="order__r">
        <div className="l"><span>Схема хранения</span><b>входит</b></div>
        <div className="l"><span>Назначение блоков</span><b>входит</b></div>
        <div className="l"><span>Памятка</span><b>входит</b></div>
        <div className="l"><span>Подбор товаров</span><b>входит</b></div>
        <div className="l"><span>Доступ к файлу</span><b>навсегда</b></div>
        <div className="total"><span className="l1">Итого</span><span className="v1">149 ₽</span></div>
        <button className="submit">ОФОРМИТЬ ЗАКАЗ →</button>
      </div>
    </div>

    <div className="colophon">
      <span>© Уместно, 2026 · made with care</span>
      <span>tg / vk / pinterest · help@umestno-home.ru</span>
    </div>
  </div>
);

window.V3Catalog = V3Catalog;
