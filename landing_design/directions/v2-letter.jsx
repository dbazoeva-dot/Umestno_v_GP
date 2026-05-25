// V2 — Письмо от автора: single column, intimate, Newsreader serif

const V2Letter = () => (
  <div className="dir-v2">
    <div className="page">
      <div className="ribbon">
        <span><b>Уместно</b> · ru-ru · 2026</span>
        <div className="nav">
          <a href="#">читать</a>
          <a href="#">конфигуратор</a>
          <a href="#">письмо</a>
        </div>
        <span>149 ₽ · один раз</span>
      </div>

      <p className="hi">Здравствуйте,</p>
      <h1>я придумала <em>Уместно</em>, потому что сама часами собирала «правильный ящик».</h1>
      <p className="lede">Это короткое письмо о том, как из 30 вкладок с органайзерами получился сервис, который собирает схему за пару минут.</p>

      <div className="photo">
        <div className="frame">
          <div className="ph">photo · ящик с подписями</div>
          <div className="cap"><span>Тот самый комод, с которого всё началось.</span><span>04/2024</span></div>
        </div>
        <div className="pin"></div>
      </div>

      <p className="body dropcap">Когда я в очередной раз вывалила на пол весь верхний ящик комода, я поняла: проблема не в том, что мало органайзеров. Проблема в том, что <em>нет логики</em>. Я покупала отдельные коробочки — каждая красивая сама по себе — и ставила их в ящик как пазл. Половина не подходила, остальная половина быстро смешивалась с тем, что в ней лежать не должно.</p>

      <p className="body">Я попробовала сделать таблицу: что я храню, сколько этого, какие у меня вещи по размеру. И когда я свела всё в одну сетку, оказалось, что схема собирается сама — просто никто этого не делал за меня.</p>

      <div className="margin">
        <b>Главная мысль</b>
        Хорошее хранение — это не покупка органайзеров. Это правильно собранная конфигурация под ваши вещи и ваше пространство.
      </div>

      <p className="body">Так появилась идея: <em>что если этот расчёт можно сделать за две минуты?</em> Без таблиц, без 30 вкладок, без поездок в магазин «померить на месте». Просто ввести размеры, выбрать категории — и получить готовую схему с подписями и подобранными товарами под каждый блок.</p>

      <h2 style={{fontFamily: '"Newsreader", serif', fontSize: 38, fontStyle: 'italic', fontWeight: 500, margin: '48px 0 12px', letterSpacing: '-.015em', lineHeight: 1.08}}>Как это устроено</h2>
      <p className="body" style={{color: 'var(--ink-2)'}}>Три шага. Никаких подписок, регистраций и капчи. Один раз 149&nbsp;₽ — и файл с расчётом остаётся у&nbsp;вас.</p>

      <ol className="steps3">
        <li><div><b>Введите размеры</b><span>Ширина, глубина, высота — по внутренним размерам ящика. Замеряете один раз.</span></div></li>
        <li><div><b>Выберите, что хранить</b><span>Категории вещей и их объём — мало, средне, много. Без штучного пересчёта.</span></div></li>
        <li><div><b>Получите файл</b><span>Схема, подписи блоков, подобранные органайзеры под каждый блок. На почту.</span></div></li>
      </ol>

      <p className="body">Чтобы было понятнее — попробуйте прямо здесь, в письме. <a className="in" href="#">Введите примерные размеры</a> и посмотрите, как выглядит расчёт:</p>

      <div className="widget">
        <div className="widget__head">
          <h3>Ваш будущий ящик</h3>
          <span className="tag">черновик · обновляется на лету</span>
        </div>
        <div className="widget__row">
          <div className="widget__field"><label>ШИРИНА</label><div className="v">80<small>см</small></div></div>
          <div className="widget__field"><label>ГЛУБИНА</label><div className="v">45<small>см</small></div></div>
          <div className="widget__field"><label>ВЫСОТА</label><div className="v">15<small>см</small></div></div>
        </div>
        <div className="widget__cat"><span><em>Что хранить —</em> бельё и носки</span><span className="chev"><Icon name="chevron-right" size={16}/></span></div>
        <div className="widget__cta">
          <span className="price">Полная схема — <em>149 ₽</em></span>
          <button className="widget__btn">Собрать схему <Icon name="arrow-right" size={14}/></button>
        </div>
      </div>

      <h2 style={{fontFamily: '"Newsreader", serif', fontSize: 38, fontStyle: 'italic', fontWeight: 500, margin: '48px 0 12px', letterSpacing: '-.015em', lineHeight: 1.08}}>Что в итоге у вас на руках</h2>
      <p className="body" style={{color: 'var(--ink-2)'}}>Не просто список товаров. Четыре части одного решения.</p>
      <div className="result4">
        <div className="item"><span className="n">№ 01</span><div><h4>Схема хранения</h4><p>Наглядный план с размерами зон под каждую группу вещей.</p></div></div>
        <div className="item"><span className="n">№ 02</span><div><h4>Назначение блоков</h4><p>Для каждой зоны — что и почему лежит именно здесь, с учётом частоты использования.</p></div></div>
        <div className="item"><span className="n">№ 03</span><div><h4>Памятка по складыванию</h4><p>Короткие подсказки, как складывать и распределять вещи внутри блоков.</p></div></div>
        <div className="item"><span className="n">№ 04</span><div><h4>Подбор товаров</h4><p>Конкретные органайзеры под каждый блок схемы — по размерам и формату.</p></div></div>
      </div>

      <h2 style={{fontFamily: '"Newsreader", serif', fontSize: 38, fontStyle: 'italic', fontWeight: 500, margin: '48px 0 12px', letterSpacing: '-.015em', lineHeight: 1.08}}>Что говорят те, кто уже попробовал</h2>

      <div className="note">
        <p className="quote">«Я бы сама очень долго собирала это по частям. Здесь сразу стало понятно, что покупать и как это должно встать внутри.»</p>
        <div className="who">
          <img src="assets/review1-aftr.webp" alt="Анна" />
          <div><b>Анна, Москва</b><span>комод 80×45 · 4 зоны · сборка за час</span></div>
        </div>
        <div className="pair">
          <div><img src="assets/review1-bfr.webp" alt="До" /><span className="lbl">до</span></div>
          <div><img src="assets/review1-aftr.webp" alt="После" /><span className="lbl">после</span></div>
        </div>
      </div>

      <h2 style={{fontFamily: '"Newsreader", serif', fontSize: 38, fontStyle: 'italic', fontWeight: 500, margin: '48px 0 12px', letterSpacing: '-.015em', lineHeight: 1.08}}>Что чаще всего спрашивают</h2>
      <div className="qa">
        <div className="qa__row">
          <p className="q">Это просто подборка органайзеров?</p>
          <p className="a">Нет. Сначала собирается схема: какие зоны, что где хранить, какой формат подходит для каждой категории. И уже после этого — товары под конкретные блоки.</p>
        </div>
        <div className="qa__row">
          <p className="q">Нужно ли точно считать все вещи?</p>
          <p className="a">Нет. В калькуляторе есть понятные диапазоны (мало / средне / много) с указанием количества — выбираете ближайший.</p>
        </div>
        <div className="qa__row">
          <p className="q">Можно ли использовать свои органайзеры?</p>
          <p className="a">Да. Главное — сохранить логику схемы: какие блоки нужны, что в них хранить, как они работают вместе.</p>
        </div>
        <div className="qa__row">
          <p className="q">А если схема не подойдёт?</p>
          <p className="a">Напишите на help@umestno-home.ru — пересоберём или вернём деньги. Это честно.</p>
        </div>
      </div>

      <div className="sign">
        <p className="closing">С теплом,</p>
        <p className="name">Аня</p>
        <p className="role">основатель Уместно · ан­на@umestno-home.ru</p>
      </div>

      <div className="ps">
        <div>
          <b>P.S.</b>
          <h4>Если ещё не уверены — <em>попробуйте сейчас.</em></h4>
        </div>
        <button className="btn">Собрать схему за 149 ₽ <Icon name="arrow-right" size={14}/></button>
      </div>
    </div>
  </div>
);

window.V2Letter = V2Letter;
