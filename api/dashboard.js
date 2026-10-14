/**
 * Vercel Serverless Function: /api/dashboard
 * Painel Administrativo com Basic Auth e Visualização das Métricas do Funil
 */

module.exports = async function handler(req, res) {
  // 1. Basic Auth Verification
  const authHeader = req.headers.authorization;
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'acervo2026';

  function requireAuth() {
    res.setHeader('WWW-Authenticate', 'Basic realm="Acesso Restrito - Dashboard Funil Acervo Clinico"');
    res.status(401).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Acesso Restrito</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:50px;background:#0f172a;color:#fff;">
        <h2>Acesso Restrito</h2>
        <p>Você precisa de usuário e senha válidos para visualizar este dashboard.</p>
      </body>
      </html>
    `);
  }

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return requireAuth();
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [user, pass] = credentials.split(':');

    if (user !== adminUser || pass !== adminPass) {
      return requireAuth();
    }
  } catch (err) {
    return requireAuth();
  }

  // 2. Extração de Métricas do Vercel KV / Upstash Redis
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  let counts = {};
  let totalUniqueLeads = 0;
  let recentEvents = [];
  let isKvConnected = false;

  if (kvUrl && kvToken) {
    try {
      const pipeline = [
        ["HGETALL", "aci:funnel:counts"],
        ["SCARD", "aci:funnel:leads"],
        ["LRANGE", "aci:funnel:recent", "0", "49"]
      ];

      const kvRes = await fetch(`${kvUrl}/pipeline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${kvToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pipeline)
      });

      if (kvRes.ok) {
        const [countsData, scardData, recentData] = await kvRes.json();
        
        // Formatar HGETALL (array de pares [key, value, key, value] ou objeto)
        if (Array.isArray(countsData.result)) {
          for (let i = 0; i < countsData.result.length; i += 2) {
            counts[countsData.result[i]] = parseInt(countsData.result[i + 1], 10) || 0;
          }
        } else if (countsData.result && typeof countsData.result === 'object') {
          for (const k of Object.keys(countsData.result)) {
            counts[k] = parseInt(countsData.result[k], 10) || 0;
          }
        }

        totalUniqueLeads = scardData.result || 0;

        if (Array.isArray(recentData.result)) {
          recentEvents = recentData.result.map(item => {
            try { return typeof item === 'string' ? JSON.parse(item) : item; }
            catch(e) { return { event: 'unknown', time: Date.now() }; }
          });
        }
        isKvConnected = true;
      }
    } catch (e) {
      console.error('Error fetching KV data:', e);
    }
  }

  // Se a rota receber ?format=json, retorna os dados puros para polling
  if (req.query.format === 'json') {
    return res.status(200).json({
      isKvConnected,
      totalUniqueLeads,
      counts,
      recentEvents
    });
  }

  // Se for requisitado reset:
  if (req.query.action === 'reset' && kvUrl && kvToken) {
    try {
      await fetch(`${kvUrl}/pipeline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${kvToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([
          ["DEL", "aci:funnel:counts"],
          ["DEL", "aci:funnel:leads"],
          ["DEL", "aci:funnel:recent"]
        ])
      });
      return res.redirect('/dashboard');
    } catch (e) {}
  }

  // 3. Cálculos do Funil
  const pageviews = counts['pageview'] || 0;
  const scroll25 = counts['scroll_25'] || 0;
  const scroll50 = counts['scroll_50'] || 0;
  const scroll75 = counts['scroll_75'] || 0;
  const scroll100 = counts['scroll_100'] || 0;

  const viewHero = counts['view_section_hero'] || pageviews;
  const viewVideo = counts['click_video_demo'] || counts['view_section_preview'] || 0;
  const viewPricing = counts['view_section_pricing'] || scroll75;
  const viewFaq = counts['view_section_faq'] || scroll100;

  const clickBasic = counts['click_basic_cta'] || 0;
  const clickFeatured = counts['click_featured_cta'] || 0;
  const clickHeroCta = counts['click_hero_cta'] || 0;
  const clickFinalCta = counts['click_final_cta'] || 0;

  const upsellOpened = counts['upsell_opened'] || clickBasic;
  const upsellAccepted = counts['upsell_accepted'] || 0;
  const upsellDeclined = counts['upsell_declined'] || 0;

  function pct(num, total) {
    if (!total || total === 0) return '0%';
    return ((num / total) * 100).toFixed(1) + '%';
  }

  // 4. Renderização do HTML do Dashboard
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard do Funil — Acervo Clínico Infantil</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0B0F17;
      --card-bg: #151D2C;
      --card-border: #1E293B;
      --text: #F8FAFC;
      --muted: #94A3B8;
      --teal: #2A9D8F;
      --teal-glow: rgba(42, 157, 143, 0.25);
      --green: #10B981;
      --gold: #F59E0B;
      --red: #EF4444;
      --blue: #3B82F6;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 24px;
      min-height: 100vh;
    }
    .wrapper { max-width: 1200px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 28px;
    }
    .brand h1 {
      font-size: 22px;
      font-weight: 800;
      color: #FFF;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand h1 span { color: var(--teal); }
    .brand p { font-size: 13.5px; color: var(--muted); margin-top: 4px; }
    .header-actions { display: flex; align-items: center; gap: 12px; }
    .badge {
      font-size: 11.5px;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: 50px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .badge-live { background: rgba(16, 185, 129, 0.15); color: var(--green); border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-warn { background: rgba(245, 158, 11, 0.15); color: var(--gold); border: 1px solid rgba(245, 158, 11, 0.3); }
    .pulse-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; animation: pulse 1.8s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }
    .btn-action {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      color: var(--text);
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn-action:hover { background: #1E293B; border-color: #334155; }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 20px;
      position: relative;
      overflow: hidden;
    }
    .kpi-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; height: 3px;
      background: var(--accent, var(--teal));
    }
    .kpi-title { font-size: 12.5px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .kpi-val { font-size: 32px; font-weight: 800; color: #FFF; line-height: 1; margin-bottom: 6px; }
    .kpi-sub { font-size: 12.5px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
    .kpi-sub strong { color: var(--green); }

    /* Funnel Section */
    .dashboard-grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 24px;
      margin-bottom: 28px;
    }
    @media (max-width: 900px) {
      .dashboard-grid { grid-template-columns: 1fr; }
    }
    .panel {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 18px;
      padding: 24px;
    }
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .panel-header h2 { font-size: 16px; font-weight: 700; color: #FFF; display: flex; align-items: center; gap: 8px; }
    .panel-header span { font-size: 12px; color: var(--muted); }

    /* Funnel Progress Bars */
    .funnel-list { display: flex; flex-direction: column; gap: 16px; }
    .funnel-step {
      background: #0D131F;
      border: 1px solid #1E293B;
      border-radius: 12px;
      padding: 14px 16px;
      position: relative;
    }
    .step-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 13.5px;
      font-weight: 600;
    }
    .step-name { color: #E2E8F0; }
    .step-stats { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #FFF; }
    .step-stats span { color: var(--muted); margin-left: 6px; }
    .bar-bg {
      width: 100%;
      height: 8px;
      background: #1E293B;
      border-radius: 4px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      background: var(--bar-color, var(--teal));
      border-radius: 4px;
      transition: width 0.6s ease;
    }

    /* Upsell Special Box */
    .upsell-box {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(16, 185, 129, 0.08));
      border: 1px solid rgba(245, 158, 11, 0.25);
      border-radius: 14px;
      padding: 18px;
      margin-top: 18px;
    }
    .upsell-title { font-size: 14px; font-weight: 700; color: var(--gold); margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
    .upsell-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
    .upsell-row:last-child { margin-bottom: 0; }
    .upsell-row span { color: var(--muted); }
    .upsell-row strong { color: #FFF; font-family: 'JetBrains Mono', monospace; }

    /* Recent Events Feed */
    .events-feed { max-height: 480px; overflow-y: auto; padding-right: 4px; }
    .event-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      border-bottom: 1px solid #1E293B;
      font-size: 13px;
    }
    .event-item:last-child { border-bottom: none; }
    .event-icon {
      width: 28px; height: 28px;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      font-size: 14px;
    }
    .event-info { flex: 1; }
    .event-lead { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); }
    .event-desc { font-weight: 600; color: #FFF; margin-top: 2px; }
    .event-time { font-size: 11px; color: #64748B; margin-top: 2px; }

    /* KV Info Alert */
    .notice-box {
      background: rgba(30, 41, 59, 0.5);
      border: 1px dashed #334155;
      border-radius: 12px;
      padding: 14px 18px;
      font-size: 12.5px;
      color: #94A3B8;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 24px;
    }
    .notice-box code { color: #38BDF8; font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body>
  <div class="wrapper">
    <header>
      <div class="brand">
        <h1>📊 Acervo Clínico Infantil <span>• Funil de Leads</span></h1>
        <p>Painel de rastreamento de comportamento e conversão em tempo real</p>
      </div>
      <div class="header-actions">
        ${isKvConnected
          ? '<span class="badge badge-live"><span class="pulse-dot"></span> Vercel KV Conectado</span>'
          : '<span class="badge badge-warn"><span class="pulse-dot"></span> Modo Memória Local</span>'
        }
        <button onclick="location.reload()" class="btn-action">🔄 Atualizar</button>
        <a href="/api/dashboard?action=reset" onclick="return confirm('Deseja realmente zerar todos os dados do funil?')" class="btn-action" style="color:var(--red);">🗑️ Zerar Métricas</a>
      </div>
    </header>

    <!-- Top KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card" style="--accent: var(--teal);">
        <div class="kpi-title">Visitantes Únicos</div>
        <div class="kpi-val" id="val-leads">${totalUniqueLeads || pageviews}</div>
        <div class="kpi-sub">Total de visualizações: <strong>${pageviews}</strong></div>
      </div>

      <div class="kpi-card" style="--accent: var(--blue);">
        <div class="kpi-title">Chegaram na Oferta</div>
        <div class="kpi-val" id="val-pricing">${viewPricing}</div>
        <div class="kpi-sub">Taxa de alcance da oferta: <strong>${pct(viewPricing, pageviews)}</strong></div>
      </div>

      <div class="kpi-card" style="--accent: var(--gold);">
        <div class="kpi-title">Cliques Acervo Básico</div>
        <div class="kpi-val" id="val-basic">${clickBasic}</div>
        <div class="kpi-sub">Abriram pop-up de upsell: <strong>${upsellOpened}</strong></div>
      </div>

      <div class="kpi-card" style="--accent: var(--green);">
        <div class="kpi-title">Upsell +R$ 9,90 Aceito</div>
        <div class="kpi-val" id="val-upsell">${upsellAccepted}</div>
        <div class="kpi-sub">Conversão do Upsell: <strong>${pct(upsellAccepted, upsellOpened)}</strong></div>
      </div>

      <div class="kpi-card" style="--accent: #A855F7;">
        <div class="kpi-title">Cliques Acervo Completo</div>
        <div class="kpi-val" id="val-featured">${clickFeatured}</div>
        <div class="kpi-sub">Direto no card de R$ 37,90</div>
      </div>
    </div>

    <!-- Funnel Visual Progression & Realtime Feed -->
    <div class="dashboard-grid">
      <!-- Funnel Progress Column -->
      <div class="panel">
        <div class="panel-header">
          <h2>🎯 Etapas do Funil (Drop-off Rate)</h2>
          <span>Progressão dos visitantes</span>
        </div>

        <div class="funnel-list">
          <!-- Etapa 1 -->
          <div class="funnel-step">
            <div class="step-top">
              <span class="step-name">1. Acessaram a Página (Topo do Funil)</span>
              <div class="step-stats">${pageviews} <span>100%</span></div>
            </div>
            <div class="bar-bg">
              <div class="bar-fill" style="width: 100%; --bar-color: var(--teal);"></div>
            </div>
          </div>

          <!-- Etapa 2 -->
          <div class="funnel-step">
            <div class="step-top">
              <span class="step-name">2. Rolaram a tela (Engajamento > 25%)</span>
              <div class="step-stats">${scroll25} <span>${pct(scroll25, pageviews)}</span></div>
            </div>
            <div class="bar-bg">
              <div class="bar-fill" style="width: ${pct(scroll25, pageviews)}; --bar-color: #06B6D4;"></div>
            </div>
          </div>

          <!-- Etapa 3 -->
          <div class="funnel-step">
            <div class="step-top">
              <span class="step-name">3. Assistiram/Tocaram no Vídeo Demonstrativo</span>
              <div class="step-stats">${viewVideo} <span>${pct(viewVideo, pageviews)}</span></div>
            </div>
            <div class="bar-bg">
              <div class="bar-fill" style="width: ${pct(viewVideo, pageviews)}; --bar-color: var(--blue);"></div>
            </div>
          </div>

          <!-- Etapa 4 -->
          <div class="funnel-step">
            <div class="step-top">
              <span class="step-name">4. Chegaram na Metade (> 50% / Depoimentos)</span>
              <div class="step-stats">${scroll50} <span>${pct(scroll50, pageviews)}</span></div>
            </div>
            <div class="bar-bg">
              <div class="bar-fill" style="width: ${pct(scroll50, pageviews)}; --bar-color: #6366F1;"></div>
            </div>
          </div>

          <!-- Etapa 5 -->
          <div class="funnel-step">
            <div class="step-top">
              <span class="step-name">5. Visualizaram a Tabela de Preços e Oferta</span>
              <div class="step-stats">${viewPricing} <span>${pct(viewPricing, pageviews)}</span></div>
            </div>
            <div class="bar-bg">
              <div class="bar-fill" style="width: ${pct(viewPricing, pageviews)}; --bar-color: var(--gold);"></div>
            </div>
          </div>

          <!-- Etapa 6 -->
          <div class="funnel-step">
            <div class="step-top">
              <span class="step-name">6. Clicaram em Comprar (Básico ou Completo)</span>
              <div class="step-stats">${clickBasic + clickFeatured} <span>${pct(clickBasic + clickFeatured, pageviews)}</span></div>
            </div>
            <div class="bar-bg">
              <div class="bar-fill" style="width: ${pct(clickBasic + clickFeatured, pageviews)}; --bar-color: var(--green);"></div>
            </div>
          </div>
        </div>

        <!-- Análise Específica do Pop-up de Upsell -->
        <div class="upsell-box">
          <div class="upsell-title">⚡ Desempenho do Pop-up de Upsell (+R$ 9,90)</div>
          <div class="upsell-row">
            <span>Leads que clicaram no Básico e viram o Pop-up:</span>
            <strong>${upsellOpened} leads</strong>
          </div>
          <div class="upsell-row">
            <span>Aceitaram o upgrade para o Completo (+R$ 9,90):</span>
            <strong style="color:var(--green);">${upsellAccepted} (${pct(upsellAccepted, upsellOpened)})</strong>
          </div>
          <div class="upsell-row">
            <span>Recusaram e mantiveram o simples:</span>
            <strong style="color:var(--red);">${upsellDeclined} (${pct(upsellDeclined, upsellOpened)})</strong>
          </div>
        </div>
      </div>

      <!-- Live Events Stream Column -->
      <div class="panel">
        <div class="panel-header">
          <h2>⚡ Atividade Recente dos Leads</h2>
          <span id="live-timer">Tempo real</span>
        </div>

        <div class="events-feed">
          ${recentEvents.length === 0 ? '<p style="color:var(--muted);font-size:13px;text-align:center;padding:40px 0;">Nenhum evento registrado ainda.<br>Acesse o site para começar a gerar métricas.</p>' : ''}
          ${recentEvents.map(e => {
            let icon = '👀';
            let label = e.event;
            let color = 'rgba(148, 163, 184, 0.15)';

            if (e.event === 'pageview') { icon = '🌐'; label = 'Acessou o site'; color = 'rgba(42, 157, 143, 0.2)'; }
            else if (e.event.startsWith('scroll_')) { icon = '📜'; label = 'Rolou a página até ' + e.event.replace('scroll_', '') + '%'; color = 'rgba(59, 130, 246, 0.2)'; }
            else if (e.event === 'click_video_demo') { icon = '▶️'; label = 'Assistiu ao vídeo de demonstração'; color = 'rgba(168, 85, 247, 0.2)'; }
            else if (e.event === 'view_section_pricing') { icon = '🏷️'; label = 'Visualizou a seção de preços'; color = 'rgba(245, 158, 11, 0.2)'; }
            else if (e.event === 'click_basic_cta') { icon = '🛒'; label = 'Clicou no botão do Acervo Básico'; color = 'rgba(245, 158, 11, 0.25)'; }
            else if (e.event === 'upsell_opened') { icon = '🎁'; label = 'Abriu o pop-up de Upsell'; color = 'rgba(245, 158, 11, 0.3)'; }
            else if (e.event === 'upsell_accepted') { icon = '🔥'; label = 'Aceitou o Upsell de R$ 9,90!'; color = 'rgba(16, 185, 129, 0.3)'; }
            else if (e.event === 'upsell_declined') { icon = '❌'; label = 'Recusou o Upsell (manteve o simples)'; color = 'rgba(239, 68, 68, 0.2)'; }
            else if (e.event === 'click_featured_cta') { icon = '💎'; label = 'Clicou no Acervo Completo (R$ 37,90)'; color = 'rgba(16, 185, 129, 0.25)'; }
            else if (e.event === 'click_hero_cta') { icon = '👆'; label = 'Clicou no CTA do topo (Hero)'; color = 'rgba(42, 157, 143, 0.2)'; }
            else if (e.event === 'click_faq') { icon = '❓'; label = 'Leu dúvida no FAQ: ' + (e.meta && e.meta.question ? e.meta.question.substring(0, 30) + '...' : ''); color = 'rgba(148, 163, 184, 0.2)'; }

            const timeStr = new Date(e.time).toLocaleTimeString('pt-BR');

            return \`
              <div class="event-item">
                <div class="event-icon" style="background:\${color};">\${icon}</div>
                <div class="event-info">
                  <div class="event-lead">\${e.sessionId} \${e.screen ? '• ' + e.screen : ''}</div>
                  <div class="event-desc">\${label}</div>
                  <div class="event-time">\${timeStr} \${e.ref && e.ref !== 'direto' ? '• ref: ' + e.ref : ''}</div>
                </div>
              </div>
            \`;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Notice Box -->
    <div class="notice-box">
      <div>
        <strong>Conexão Vercel KV / Upstash:</strong>
        ${isKvConnected 
          ? 'Banco de dados ativo. Os dados são persistidos permanentemente na nuvem.'
          : 'Para persistência contínua, conecte o <code>Vercel KV</code> no painel da sua conta na Vercel (aba Storage > Create KV Database).'
        }
      </div>
      <div>
        <span>Rota protegida por <strong>Basic Auth</strong> (admin / acervo2026)</span>
      </div>
    </div>
  </div>

  <script>
    // Atualização automática em segundo plano a cada 8 segundos
    setInterval(function() {
      fetch('/api/dashboard?format=json')
        .then(res => res.json())
        .then(data => {
          if (!data || !data.counts) return;
          const c = data.counts;
          const pv = c.pageview || 0;
          const pr = c.view_section_pricing || c.scroll_75 || 0;
          const basic = c.click_basic_cta || 0;
          const upsell = c.upsell_accepted || 0;
          const feat = c.click_featured_cta || 0;
          const leads = data.totalUniqueLeads || pv;

          const elLeads = document.getElementById('val-leads');
          if (elLeads) elLeads.textContent = leads;
          const elPr = document.getElementById('val-pricing');
          if (elPr) elPr.textContent = pr;
          const elBasic = document.getElementById('val-basic');
          if (elBasic) elBasic.textContent = basic;
          const elUpsell = document.getElementById('val-upsell');
          if (elUpsell) elUpsell.textContent = upsell;
          const elFeat = document.getElementById('val-featured');
          if (elFeat) elFeat.textContent = feat;
        })
        .catch(() => {});
    }, 8000);
  </script>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
