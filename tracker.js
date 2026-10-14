/**
 * Acervo Clínico Infantil — Funnel Analytics Tracker
 * Rastreia as etapas dos leads em tempo real pelo funil de conversão.
 */
(function() {
  'use strict';

  // Gerar ou recuperar ID exclusivo da sessão do lead
  var SESSION_KEY = 'aci_lead_session';
  var sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = 'lead_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    try { sessionStorage.setItem(SESSION_KEY, sessionId); } catch(e){}
  }

  // Cache de eventos disparados para evitar duplicidade na mesma sessão
  var firedEvents = {};

  function sendEvent(eventName, metadata) {
    if (firedEvents[eventName]) return;
    firedEvents[eventName] = true;

    var payload = {
      sessionId: sessionId,
      event: eventName,
      timestamp: Date.now(),
      path: window.location.pathname,
      referrer: document.referrer || 'direto',
      screen: window.innerWidth + 'x' + window.innerHeight,
      metadata: metadata || {}
    };

    try {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function(err) {
        console.warn('[Tracker] Send error:', err);
      });
    } catch(err) {
      console.warn('[Tracker] Fetch error:', err);
    }
  }

  // 1. Pageview inicial
  sendEvent('pageview', { title: document.title });

  // 2. Scroll Depth Tracker (25%, 50%, 75%, 100%)
  var scrollMilestones = { 25: false, 50: false, 75: false, 100: false };
  function checkScroll() {
    var winHeight = window.innerHeight;
    var docHeight = Math.max(
      document.body.scrollHeight, document.documentElement.scrollHeight,
      document.body.offsetHeight, document.documentElement.offsetHeight
    );
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var scrollPercent = Math.min(100, Math.round(((scrollTop + winHeight) / docHeight) * 100));

    if (scrollPercent >= 25 && !scrollMilestones[25]) {
      scrollMilestones[25] = true;
      sendEvent('scroll_25');
    }
    if (scrollPercent >= 50 && !scrollMilestones[50]) {
      scrollMilestones[50] = true;
      sendEvent('scroll_50');
    }
    if (scrollPercent >= 75 && !scrollMilestones[75]) {
      scrollMilestones[75] = true;
      sendEvent('scroll_75');
    }
    if (scrollPercent >= 95 && !scrollMilestones[100]) {
      scrollMilestones[100] = true;
      sendEvent('scroll_100');
    }
  }

  window.addEventListener('scroll', function() {
    requestAnimationFrame(checkScroll);
  }, { passive: true });

  // 3. Rastreamento de seções visíveis (IntersectionObserver)
  if ('IntersectionObserver' in window) {
    var sectionObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var id = entry.target.id;
          if (id) {
            sendEvent('view_section_' + id);
          }
        }
      });
    }, { threshold: 0.25 });

    var targetSections = ['hero', 'preview', 'categories', 'urgency-block', 'testimonials', 'value-stack', 'recap-valor', 'pricing', 'guarantee', 'faq', 'final-cta'];
    targetSections.forEach(function(secId) {
      var el = document.getElementById(secId);
      if (el) sectionObserver.observe(el);
    });
  }

  // 4. Rastreamento de cliques e conversões do funil
  document.addEventListener('DOMContentLoaded', function() {
    // Clique no CTA Hero
    var heroCta = document.querySelector('#hero .btn-primary');
    if (heroCta) {
      heroCta.addEventListener('click', function() {
        sendEvent('click_hero_cta');
      });
    }

    // Clique no Vídeo de Demonstração
    var videoThumb = document.getElementById('gif-thumb');
    if (videoThumb) {
      videoThumb.addEventListener('click', function() {
        sendEvent('click_video_demo');
      });
    }

    // Clique em "Quero o Acervo básico"
    var basicBtns = document.querySelectorAll('.btn-open-upsell');
    basicBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        sendEvent('click_basic_cta');
        sendEvent('upsell_opened');
      });
    });

    // Clique em "QUERO O ACESSO COMPLETO" (Pop-up Upsell)
    var upsellAccept = document.getElementById('btn-upsell-complete');
    if (upsellAccept) {
      upsellAccept.addEventListener('click', function() {
        sendEvent('upsell_accepted');
      });
    }

    // Clique em "não, quero o acervo simples" (Pop-up Recusa)
    var upsellDecline = document.getElementById('btn-upsell-decline');
    if (upsellDecline) {
      upsellDecline.addEventListener('click', function() {
        sendEvent('upsell_declined');
      });
    }

    // Clique direto no Acervo Completo (Pricing card destaque)
    var featuredBtn = document.querySelector('.pricing-card.featured a.btn-primary');
    if (featuredBtn) {
      featuredBtn.addEventListener('click', function() {
        sendEvent('click_featured_cta');
      });
    }

    // Clique nas dúvidas frequentes (FAQ)
    var faqQuestions = document.querySelectorAll('.faq-question');
    faqQuestions.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var text = btn.innerText.replace('+', '').trim();
        sendEvent('click_faq', { question: text });
      });
    });

    // Clique no CTA Final
    var finalCta = document.querySelector('#final-cta .btn');
    if (finalCta) {
      finalCta.addEventListener('click', function() {
        sendEvent('click_final_cta');
      });
    }
  });

})();
