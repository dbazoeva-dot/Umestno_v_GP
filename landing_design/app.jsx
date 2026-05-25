// Уместно — main app shell

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "hero": "magazine",
  "accent": "terracotta",
  "density": "regular",
  "fontpair": "garamond",
  "stepTitleFont": "inherit",
  "showFloatingCTA": true
}/*EDITMODE-END*/;

const STEP_TITLE_FONTS = {
  'inherit':           { label: 'Как у пары шрифтов', f: null, w: 500, s: 'normal', ls: '-0.01em', size: 'var(--fs-2xl)', fvs: 'normal' },
  'garamond':          { label: 'EB Garamond, 500', f: '"EB Garamond", serif', w: 500, s: 'normal', ls: '-0.005em', size: 'var(--fs-2xl)', fvs: 'normal' },
  'garamond-it':       { label: 'EB Garamond italic, 500', f: '"EB Garamond", serif', w: 500, s: 'italic', ls: '-0.005em', size: 'var(--fs-2xl)', fvs: 'normal' },
  'inter-semi':        { label: 'Inter, 600', f: '"Inter", sans-serif', w: 600, s: 'normal', ls: '-0.015em', size: 'var(--fs-xl)', fvs: 'normal' },
  'inter-bold':        { label: 'Inter, 700', f: '"Inter", sans-serif', w: 700, s: 'normal', ls: '-0.02em', size: 'var(--fs-xl)', fvs: 'normal' },
  'commissioner-semi': { label: 'Commissioner Semi-Bold', f: '"Commissioner", sans-serif', w: 600, s: 'normal', ls: '-0.015em', size: 'var(--fs-xl)', fvs: '"FLAR" 0' },
  'cormorant':         { label: 'Cormorant Garamond, 500', f: '"Cormorant Garamond", serif', w: 500, s: 'normal', ls: '-0.005em', size: 'var(--fs-2xl)', fvs: 'normal' },
  'lora':              { label: 'Lora, 600', f: '"Lora", serif', w: 600, s: 'normal', ls: '-0.01em', size: 'var(--fs-xl)', fvs: 'normal' },
};

const App = () => {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // apply accent theme (controls --u-accent etc via [data-accent])
  React.useEffect(()=>{
    document.documentElement.setAttribute('data-accent', t.accent === 'sage' ? 'sage' : '');
  }, [t.accent]);

  // font-pair theme
  React.useEffect(()=>{
    document.documentElement.setAttribute('data-fontpair', t.fontpair === 'current' ? '' : t.fontpair);
  }, [t.fontpair]);

  // density → vary section padding
  React.useEffect(()=>{
    const pad = t.density === 'compact' ? '56px' : t.density === 'comfy' ? '104px' : '76px';
    document.documentElement.style.setProperty('--u-section-pad', pad);
  }, [t.density]);

  // step card title font (decoupled from main pair)
  React.useEffect(()=>{
    const cfg = STEP_TITLE_FONTS[t.stepTitleFont] || STEP_TITLE_FONTS['inherit'];
    const r = document.documentElement.style;
    if (cfg.f){ r.setProperty('--f-step-title', cfg.f); } else { r.removeProperty('--f-step-title'); }
    r.setProperty('--fw-step-title', cfg.w);
    r.setProperty('--fst-step-title', cfg.s);
    r.setProperty('--ls-step-title', cfg.ls);
    r.setProperty('--fs-step-title', cfg.size);
    r.setProperty('--fvs-step-title', cfg.fvs || 'normal');
  }, [t.stepTitleFont]);

  const Hero = t.hero === 'wizard' ? HeroWizard : t.hero === 'editorial' ? HeroEditorial : t.hero === 'poster' ? HeroPoster : t.hero === 'cover' ? HeroCover : t.hero === 'annotated' ? HeroAnnotated : t.hero === 'relief' ? HeroRelief : t.hero === 'arch' ? HeroArch : t.hero === 'magazine' ? HeroMagazine : t.hero === 'fold' ? HeroFold : HeroSplit;

  return (
    <>
      <Header />
      <main>
        <Hero accent={t.accent}/>
        <Problem />
        <HowItWorks />
        <Configurator />
        <Result />
        <Logic />
        <Interlude />
        <Reviews />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />

      <TweaksPanel>
        <TweakSection label="Hero вариант" />
        <TweakSelect
          label="Layout"
          value={t.hero}
          options={[
            {value:'fold', label:'Fold — в один экран, 2 шрифта'},
            {value:'magazine', label:'Magazine — журнальный разворот'},
            {value:'arch', label:'Arch — вертикальное фото-арка'},
            {value:'relief', label:'Relief — «без…» как hero'},
            {value:'annotated', label:'Annotated — фото с аннотациями'},
            {value:'split', label:'Split — текст + фото'},
            {value:'poster', label:'Poster — типографика'},
            {value:'cover', label:'Cover — фото full-bleed'},
            {value:'wizard', label:'Wizard — шаги'},
            {value:'editorial', label:'Editorial — full-bleed арка'},
          ]}
          onChange={v => setTweak('hero', v)}
        />
        <div style={{fontSize:'var(--fs-2xs)', color:'rgba(41,38,27,.55)', lineHeight:1.5, marginTop:-4}}>
          {t.hero==='fold' && '— Абов-фолд editorial. Два шрифта, всё видно в браузере сразу.'}
          {t.hero==='magazine' && '— House of Honey / Symbol / Solace. HUGE заголовок + фото.'}
          {t.hero==='arch' && '— Вертикальное фото-арка + editorial-копия. Pinterest-mood.'}
          {t.hero==='relief' && '— Трио «без…» как manifesto-центр. Эмоция вбивает сразу.'}
          {t.hero==='annotated' && '— Фото-схема с editorial-аннотациями. Музейный/тех-каталог.'}
          {t.hero==='split' && '— Текст + фото справа. Классический.'}
          {t.hero==='poster' && '— Огромный заголовок-постер, фото — мелкая Fig. в углу.'}
          {t.hero==='cover' && '— Фото на весь блок, текст поверх. Magazine cover.'}
          {t.hero==='wizard' && '— Шаги расчёта на первом экране. Сразу к делу.'}
          {t.hero==='editorial' && '— Full-bleed фото, текст-плашка. Pinterest-моод.'}
        </div>

        <TweakSection label="Палитра" />
        <TweakRadio
          label="Главный акцент"
          value={t.accent}
          options={[
            {value:'terracotta', label:'Терракота'},
            {value:'sage', label:'Шалфей'},
          ]}
          onChange={v => setTweak('accent', v)}
        />

        <TweakSection label="Шрифты" />
        <TweakSelect
          label="Пара"
          value={t.fontpair}
          options={[
            {value:'garamond', label:'EB Garamond + Inter'},
            {value:'commissioner', label:'Commissioner + Inter'},
            {value:'current', label:'Cormorant Garamond + Manrope'},
            {value:'fraunces', label:'Fraunces + Inter Tight'},
            {value:'dm', label:'DM Serif Display + DM Sans'},
            {value:'lora', label:'Lora + Karla'},
          ]}
          onChange={v => setTweak('fontpair', v)}
        />
        <TweakSelect
          label="Заголовки карточек шагов"
          value={t.stepTitleFont}
          options={Object.keys(STEP_TITLE_FONTS).map(k => ({value:k, label: STEP_TITLE_FONTS[k].label}))}
          onChange={v => setTweak('stepTitleFont', v)}
        />

        <TweakSection label="Ритм страницы" />
        <TweakRadio
          label="Плотность"
          value={t.density}
          options={['compact', 'regular', 'comfy']}
          onChange={v => setTweak('density', v)}
        />
      </TweaksPanel>
    </>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
