/* ================================================================
   ACERVO CLÍNICO INFANTIL — LANDING PAGE SCRIPTS
   ================================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     CONFIGURAÇÕES CENTRALIZADAS
     ---------------------------------------------------------- */
  const CONFIG = {
    // URL de checkout — PENDENTE: substituir pela URL real da Hotmart
    checkoutUrl: '#checkout',

    // URL de checkout com desconto (popup) — PENDENTE
    checkoutDiscountUrl: '#checkout',

    // Contador: defina a data/hora real de encerramento da oferta
    // PENDENTE: data real não fornecida. Usando duração fixa de 7h a partir do carregamento.
    countdownDurationMs: 7 * 60 * 60 * 1000, // 7 horas

    // Pop-up de saída: exibir apenas uma vez por sessão
    exitPopupDelay: 3000, // ms antes de ativar o listener
  };


  /* ----------------------------------------------------------
     COUNTDOWN TIMER (100% FUNCIONAL E SINCRONIZADO)
     ---------------------------------------------------------- */
  function initCountdown() {
    const STORAGE_KEY = 'aci_countdown_end';
    const DEFAULT_DURATION_MS = (6 * 3600 + 59 * 60 + 54) * 1000; // 06:59:54
    let endTime;

    // Recupera ou define o horário de término
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        endTime = parseInt(stored, 10);
      }
      // Se não existir ou se já expirou, define nova contagem para manter urgência viva
      if (!endTime || isNaN(endTime) || endTime <= Date.now()) {
        endTime = Date.now() + DEFAULT_DURATION_MS;
        sessionStorage.setItem(STORAGE_KEY, endTime.toString());
      }
    } catch (e) {
      endTime = Date.now() + DEFAULT_DURATION_MS;
    }

    // Busca todos os cronômetros da página
    const timerElements = [
      document.getElementById('countdown-top'),
      document.getElementById('countdown-offer'),
      document.getElementById('countdown-mobile'),
      ...Array.from(document.querySelectorAll('.countdown-timer'))
    ].filter((el, idx, arr) => el && arr.indexOf(el) === idx);

    function formatTime(ms) {
      const totalSeconds = Math.max(0, Math.floor(ms / 1000));
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      return (
        String(hours).padStart(2, '0') + ':' +
        String(minutes).padStart(2, '0') + ':' +
        String(seconds).padStart(2, '0')
      );
    }

    function updateTimer() {
      const now = Date.now();
      let remaining = Math.max(0, endTime - now);

      if (remaining === 0) {
        // Se zerar, reseta para 23 minutos para não desarmar a oferta
        endTime = Date.now() + 23 * 60 * 1000;
        try { sessionStorage.setItem(STORAGE_KEY, endTime.toString()); } catch (e) {}
        remaining = 23 * 60 * 1000;
      }

      const formatted = formatTime(remaining);

      timerElements.forEach((el) => {
        if (el) el.textContent = formatted;
      });
    }

    // Executa imediatamente e depois a cada 1 segundo
    updateTimer();
    setInterval(updateTimer, 1000);
  }


  /* ----------------------------------------------------------
     CAROUSEL DE DEPOIMENTOS
     ---------------------------------------------------------- */
  function initCarousel() {
    const track = document.getElementById('carousel-track');
    const prevBtn = document.getElementById('carousel-prev');
    const nextBtn = document.getElementById('carousel-next');
    const dotsContainer = document.getElementById('carousel-dots');
    const carousel = document.getElementById('testimonial-carousel');

    if (!track || !prevBtn || !nextBtn) return;

    const slides = track.querySelectorAll('.carousel__slide');
    const total = slides.length;
    if (total === 0) return;

    let current = 0;
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    // Criar dots
    if (dotsContainer) {
      dotsContainer.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const dot = document.createElement('button');
        dot.classList.add('carousel__dot');
        dot.setAttribute('aria-label', `Ir para depoimento ${i + 1}`);
        if (i === 0) dot.classList.add('active');
        dot.addEventListener('click', () => {
          goTo(i);
          resetAutoplay();
        });
        dotsContainer.appendChild(dot);
      }
    }

    function goTo(index) {
      current = ((index % total) + total) % total;
      track.style.transform = `translateX(-${current * 100}%)`;
      updateDots();
    }

    function updateDots() {
      if (!dotsContainer) return;
      const dots = dotsContainer.querySelectorAll('.carousel__dot');
      dots.forEach((d, i) => d.classList.toggle('active', i === current));
    }

    prevBtn.addEventListener('click', () => {
      goTo(current - 1);
      resetAutoplay();
    });

    nextBtn.addEventListener('click', () => {
      goTo(current + 1);
      resetAutoplay();
    });

    // Keyboard navigation
    if (carousel) {
      carousel.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { goTo(current - 1); resetAutoplay(); }
        if (e.key === 'ArrowRight') { goTo(current + 1); resetAutoplay(); }
      });
    }

    // Touch/swipe support
    track.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      currentX = startX;
      isDragging = true;
    }, { passive: true });

    track.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currentX = e.touches[0].clientX;
    }, { passive: true });

    track.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      const diff = startX - currentX;
      if (Math.abs(diff) > 40) {
        if (diff > 0) goTo(current + 1);
        else goTo(current - 1);
        resetAutoplay();
      }
    }, { passive: true });

    // Auto-play (pause no hover)
    let autoplayInterval = setInterval(() => goTo(current + 1), 5000);

    function resetAutoplay() {
      clearInterval(autoplayInterval);
      autoplayInterval = setInterval(() => goTo(current + 1), 5000);
    }

    if (carousel) {
      carousel.addEventListener('mouseenter', () => clearInterval(autoplayInterval));
      carousel.addEventListener('mouseleave', () => resetAutoplay());
    }
  }


  /* ----------------------------------------------------------
     FAQ ACCORDION
     ---------------------------------------------------------- */
  function initFAQ() {
    const items = document.querySelectorAll('.faq__item');

    items.forEach((item) => {
      const question = item.querySelector('.faq__question');
      const answer = item.querySelector('.faq__answer');

      if (!question || !answer) return;

      question.addEventListener('click', () => {
        const isOpen = item.classList.contains('active');

        // Fecha todos os outros
        items.forEach((other) => {
          other.classList.remove('active');
          const otherQ = other.querySelector('.faq__question');
          if (otherQ) otherQ.setAttribute('aria-expanded', 'false');
        });

        // Abre/fecha o atual
        if (!isOpen) {
          item.classList.add('active');
          question.setAttribute('aria-expanded', 'true');
        }
      });

      // Keyboard: Enter/Space
      question.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          question.click();
        }
      });
    });
  }


  /* ----------------------------------------------------------
     EXIT POPUP
     ---------------------------------------------------------- */
  function initExitPopup() {
    const popup = document.getElementById('exit-popup');
    const overlay = document.getElementById('exit-popup-overlay');
    const closeBtn = document.getElementById('exit-popup-close');
    const dismissBtn = document.getElementById('exit-popup-dismiss');

    if (!popup) return;

    const STORAGE_KEY = 'aci_exit_popup_shown';
    let popupShown = sessionStorage.getItem(STORAGE_KEY) === 'true';
    let listenerActive = false;

    function showPopup() {
      if (popupShown) return;
      popupShown = true;
      sessionStorage.setItem(STORAGE_KEY, 'true');
      popup.classList.add('active');
      document.body.style.overflow = 'hidden';

      // Focus trap
      const firstFocusable = popup.querySelector('button, a, [tabindex]');
      if (firstFocusable) firstFocusable.focus();
    }

    function hidePopup() {
      popup.classList.remove('active');
      document.body.style.overflow = '';
    }

    // Desktop: mouse leave no topo da viewport
    function onMouseLeave(e) {
      if (e.clientY <= 5 && !popupShown) {
        showPopup();
      }
    }

    // Ativa o listener após um delay
    setTimeout(() => {
      if (!popupShown) {
        document.addEventListener('mouseleave', onMouseLeave);
        listenerActive = true;
      }
    }, CONFIG.exitPopupDelay);

    // Mobile: scroll up rápido ou back button (fallback com timer)
    if ('ontouchstart' in window) {
      let lastScrollY = window.scrollY;
      let scrollUpCount = 0;

      window.addEventListener('scroll', () => {
        if (popupShown) return;

        const currentY = window.scrollY;
        if (currentY < lastScrollY && currentY > 300) {
          scrollUpCount++;
          if (scrollUpCount > 15) {
            showPopup();
          }
        } else {
          scrollUpCount = 0;
        }
        lastScrollY = currentY;
      }, { passive: true });
    }

    // Fechar popup
    if (closeBtn) closeBtn.addEventListener('click', hidePopup);
    if (dismissBtn) dismissBtn.addEventListener('click', hidePopup);
    if (overlay) overlay.addEventListener('click', hidePopup);

    // Esc key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && popup.classList.contains('active')) {
        hidePopup();
      }
    });
  }


  /* ----------------------------------------------------------
     SCROLL SUAVE PARA ÂNCORAS
     ---------------------------------------------------------- */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        if (targetId === '#' || targetId === '#checkout') return;

        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          const topBarHeight = document.querySelector('.top-bar')?.offsetHeight || 0;
          const targetPosition = target.getBoundingClientRect().top + window.scrollY - topBarHeight - 10;
          window.scrollTo({ top: targetPosition, behavior: 'smooth' });
        }
      });
    });
  }


  /* ----------------------------------------------------------
     BOTÕES DE CHECKOUT
     ---------------------------------------------------------- */
  function initCheckoutButtons() {
    // Todos os botões com href="#checkout"
    document.querySelectorAll('a[href="#checkout"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();

        if (CONFIG.checkoutUrl && CONFIG.checkoutUrl !== '#checkout') {
          window.open(CONFIG.checkoutUrl, '_blank');
        } else {
          // Scroll para a seção de oferta se checkout não configurado
          const oferta = document.getElementById('oferta');
          if (oferta) {
            const topBarHeight = document.querySelector('.top-bar')?.offsetHeight || 0;
            const pos = oferta.getBoundingClientRect().top + window.scrollY - topBarHeight - 10;
            window.scrollTo({ top: pos, behavior: 'smooth' });
          }
          console.info('[Acervo Clínico Infantil] URL de checkout pendente. Configure CONFIG.checkoutUrl com a URL real da Hotmart.');
        }
      });
    });
  }


  /* ----------------------------------------------------------
     ANIMAÇÕES DE ENTRADA (Intersection Observer)
     ---------------------------------------------------------- */
  function initScrollAnimations() {
    const elements = document.querySelectorAll(
      '.pain-card, .bonus-card, .demo__step, .deliverables__main-card, ' +
      '.guarantee__inner, .faq__item, .value-table'
    );

    elements.forEach((el) => el.classList.add('fade-in'));

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
      );

      elements.forEach((el) => observer.observe(el));
    } else {
      // Fallback: mostrar tudo
      elements.forEach((el) => el.classList.add('visible'));
    }
  }


  /* ----------------------------------------------------------
     STAGGER ANIMATIONS (delay para cards em grid)
     ---------------------------------------------------------- */
  function initStaggerAnimations() {
    const grids = document.querySelectorAll('.pain-points__grid, .bonuses__grid');

    grids.forEach((grid) => {
      const children = grid.children;
      Array.from(children).forEach((child, index) => {
        child.style.transitionDelay = `${index * 80}ms`;
      });
    });
  }


  /* ----------------------------------------------------------
     IMAGE ERROR HANDLING
     ---------------------------------------------------------- */
  function initImageErrorHandling() {
    document.querySelectorAll('img').forEach((img) => {
      img.addEventListener('error', () => {
        img.style.opacity = '0.3';
        img.style.filter = 'grayscale(100%)';
        img.alt = 'Imagem indisponível — ' + (img.alt || 'recurso visual');
      });
    });
  }


  /* ----------------------------------------------------------
     MOBILE STICKY BAR (Alta Conversão)
     ---------------------------------------------------------- */
  function initMobileStickyBar() {
    const stickyBar = document.getElementById('mobile-sticky-bar');
    const hero = document.getElementById('hero');
    const offer = document.getElementById('oferta');

    if (!stickyBar) return;

    function handleScroll() {
      const scrollY = window.scrollY;
      const heroBottom = hero ? hero.offsetTop + hero.offsetHeight : 400;
      const offerTop = offer ? offer.offsetTop : 999999;
      const offerBottom = offer ? offerTop + offer.offsetHeight : 999999;

      // Exibe quando passar do hero e oculta quando o usuário já estiver na seção de oferta
      if (scrollY > heroBottom && (scrollY < offerTop - 100 || scrollY > offerBottom)) {
        stickyBar.classList.add('visible');
      } else {
        stickyBar.classList.remove('visible');
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }


  /* ----------------------------------------------------------
     LIGHTBOX PARA DEPOIMENTOS (Zoom no print para leitura clara)
     ---------------------------------------------------------- */
  function initTestimonialZoom() {
    const images = document.querySelectorAll('.testimonial-real-img');
    if (images.length === 0) return;

    // Cria overlay dinâmico
    const lightbox = document.createElement('div');
    lightbox.className = 'testimonial-lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-label', 'Visualização do depoimento');
    lightbox.innerHTML = `
      <div class="testimonial-lightbox__backdrop"></div>
      <div class="testimonial-lightbox__content">
        <button class="testimonial-lightbox__close" aria-label="Fechar">&times;</button>
        <img src="" alt="Depoimento ampliado" class="testimonial-lightbox__img">
      </div>
    `;
    document.body.appendChild(lightbox);

    const lightboxImg = lightbox.querySelector('.testimonial-lightbox__img');
    const closeBtn = lightbox.querySelector('.testimonial-lightbox__close');
    const backdrop = lightbox.querySelector('.testimonial-lightbox__backdrop');

    function openLightbox(src, alt) {
      lightboxImg.src = src;
      lightboxImg.alt = alt || 'Depoimento de psicóloga ampliado';
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
      lightboxImg.src = '';
    }

    images.forEach((img) => {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', () => openLightbox(img.src, img.alt));
    });

    closeBtn.addEventListener('click', closeLightbox);
    backdrop.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox.classList.contains('active')) closeLightbox();
    });
  }


  /* ----------------------------------------------------------
     INIT
     ---------------------------------------------------------- */
  function init() {
    initCountdown();
    initCarousel();
    initFAQ();
    initExitPopup();
    initSmoothScroll();
    initCheckoutButtons();
    initScrollAnimations();
    initStaggerAnimations();
    initImageErrorHandling();
    initMobileStickyBar();
    initTestimonialZoom();
  }

  // Garante que o DOM está pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
