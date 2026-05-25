// Main canvas — four contrasting directions for Уместно

const W = 1180;

const App = () => (
  <DesignCanvas>
    <DCSection
      id="hero-directions"
      title="Уместно — четыре направления"
      subtitle="Все варианты в тёплой палитре (беж/терракот), но с принципиально разной визуальной ДНК. Открой любую плитку в фокус-режим для деталей."
    >
      <DCArtboard id="v1" label="01 · Warm SaaS" width={W} height={5040}>
        <V1Saas />
      </DCArtboard>
      <DCArtboard id="v2" label="02 · Письмо от автора" width={W} height={5240}>
        <V2Letter />
      </DCArtboard>
      <DCArtboard id="v3" label="03 · Каталог / Спецификация" width={W} height={6320}>
        <V3Catalog />
      </DCArtboard>
      <DCArtboard id="v4" label="04 · Bento Product" width={W} height={5160}>
        <V4Bento />
      </DCArtboard>
    </DCSection>
  </DesignCanvas>
);

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
