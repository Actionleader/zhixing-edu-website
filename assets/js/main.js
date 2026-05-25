/**
 * 知行教育中心 - Main JavaScript
 * Mobile nav, smooth scroll, map lazy-load, form validation, back-to-top
 */
(function () {
  'use strict';

  // ===== Mobile Navigation =====
  var navToggle = document.getElementById('navToggle');
  var siteNav = document.getElementById('siteNav');
  var navLinks = siteNav ? siteNav.querySelectorAll('a') : [];

  function closeNav() {
    if (siteNav) siteNav.classList.remove('active');
    if (navToggle) navToggle.classList.remove('active');
    document.body.style.overflow = '';
  }

  function openNav() {
    if (siteNav) siteNav.classList.add('active');
    if (navToggle) navToggle.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  if (navToggle && siteNav) {
    navToggle.addEventListener('click', function () {
      if (siteNav.classList.contains('active')) {
        closeNav();
      } else {
        openNav();
      }
    });

    // Close nav when a link is clicked
    navLinks.forEach(function (link) {
      link.addEventListener('click', closeNav);
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && siteNav.classList.contains('active')) {
        closeNav();
      }
    });
  }

  // ===== Sticky Header Shadow =====
  var header = document.querySelector('.site-header');
  if (header) {
    var lastScroll = 0;
    window.addEventListener('scroll', function () {
      var scrollY = window.scrollY;
      if (scrollY > 10) {
        header.style.boxShadow = '0 2px 16px rgba(26, 60, 94, 0.08)';
      } else {
        header.style.boxShadow = '';
      }
      lastScroll = scrollY;
    }, { passive: true });
  }

  // ===== Back to Top Button =====
  var backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 500) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    }, { passive: true });

    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ===== FAQ Accordion =====
  var faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(function (item) {
    var question = item.querySelector('.faq-question');
    if (question) {
      question.addEventListener('click', function () {
        // Close siblings
        faqItems.forEach(function (sibling) {
          if (sibling !== item) {
            sibling.classList.remove('open');
          }
        });
        // Toggle current
        item.classList.toggle('open');
      });
    }
  });

  // ===== Lazy Load Google Map =====
  var mapContainer = document.getElementById('mapContainer');
  if (mapContainer) {
    // Create intersection observer
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var iframe = document.createElement('iframe');
            iframe.src = 'https://maps.google.com/maps?q=%E5%B0%96%E6%B2%99%E5%92%80%E5%BB%A3%E6%9D%B1%E9%81%93188%E8%99%9F%E6%B8%AF%E6%99%AF%E5%8C%AF%E5%95%86%E5%A0%B4104%E8%88%96&z=17&output=embed';
            iframe.width = '100%';
            iframe.height = '300';
            iframe.style.border = 'none';
            iframe.allowFullscreen = '';
            iframe.loading = 'lazy';
            iframe.referrerPolicy = 'no-referrer-when-downgrade';
            iframe.title = '知行教育中心位置';
            mapContainer.appendChild(iframe);
            observer.unobserve(mapContainer);
          }
        });
      }, { rootMargin: '200px' });

      observer.observe(mapContainer);
    }
  }

  // ===== Form Validation =====
  var contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      var name = document.getElementById('form-name');
      var phone = document.getElementById('form-phone');
      var email = document.getElementById('form-email');
      var message = document.getElementById('form-message');
      var errors = [];

      if (!name || !name.value.trim()) {
        errors.push('請填寫姓名');
      }
      if (!phone || !phone.value.trim()) {
        errors.push('請填寫聯絡電話');
      }
      if (email && email.value.trim()) {
        var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email.value.trim())) {
          errors.push('請填寫正確的電郵地址');
        }
      }
      if (!message || !message.value.trim()) {
        errors.push('請填寫訊息');
      }

      if (errors.length > 0) {
        e.preventDefault();
        alert(errors.join('\n'));
      }
      // If no errors, Netlify handles the submission
    });
  }

  // ===== Highlight current page in nav =====
  var currentPath = window.location.pathname;
  navLinks.forEach(function (link) {
    var href = link.getAttribute('href');
    if (href === currentPath || (href !== '/' && currentPath.startsWith(href.replace('index.html', '')))) {
      link.classList.add('active');
    }
  });

})();

/* ===== Hero Carousel ===== */
(function() {
  const carousel = document.getElementById('heroCarousel');
  if (!carousel) return;

  const slides = carousel.querySelectorAll('.hero-carousel__slide');
  const dots = carousel.querySelectorAll('.hero-carousel__dot');
  let current = 0;
  let interval;

  function showSlide(n) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = (n + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
  }

  function nextSlide() { showSlide(current + 1); }

  // Auto-rotate every 4 seconds
  interval = setInterval(nextSlide, 4000);

  // Dot click handlers
  dots.forEach(function(dot) {
    dot.addEventListener('click', function() {
      showSlide(parseInt(this.dataset.slide));
      clearInterval(interval);
      interval = setInterval(nextSlide, 4000);
    });
  });

  // Pause on hover
  carousel.addEventListener('mouseenter', function() { clearInterval(interval); });
  carousel.addEventListener('mouseleave', function() { interval = setInterval(nextSlide, 4000); });
})();

/* ===== Promo Carousel ===== */
(function() {
  const carousel = document.getElementById('promoCarousel');
  if (!carousel) return;

  const slides = carousel.querySelectorAll('.promo-carousel__slide');
  const dots = carousel.querySelectorAll('.promo-carousel__dot');
  if (slides.length <= 1) return; // No rotation needed for single slide
  let current = 0;
  let interval;

  function showSlide(n) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = (n + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
  }

  function nextSlide() { showSlide(current + 1); }

  interval = setInterval(nextSlide, 5000);

  dots.forEach(function(dot) {
    dot.addEventListener('click', function() {
      showSlide(parseInt(this.dataset.slide));
      clearInterval(interval);
      interval = setInterval(nextSlide, 5000);
    });
  });

  carousel.addEventListener('mouseenter', function() { clearInterval(interval); });
  carousel.addEventListener('mouseleave', function() { interval = setInterval(nextSlide, 5000); });
})();
