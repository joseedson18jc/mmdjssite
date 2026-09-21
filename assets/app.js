(function () {
  'use strict';

  var PRECO_FAIXA = 80;
  var PRECO_PACK = 180;

  function mmss(sec) {
    if (!isFinite(sec) || sec < 0) { return '0:00'; }
    var s = Math.floor(sec);
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  /* ---------------- players ---------------- */

  var cards = Array.prototype.slice.call(document.querySelectorAll('.track'));
  var atual = null;

  var mini = document.getElementById('mini');
  var miniPlay = document.getElementById('mini-play');
  var miniTitle = document.getElementById('mini-title');
  var miniArtist = document.getElementById('mini-artist');
  var miniCur = document.getElementById('mini-cur');
  var miniDur = document.getElementById('mini-dur');
  var miniBar = document.getElementById('mini-bar');
  var miniFill = document.getElementById('mini-fill');

  var ICON_PLAY = '<svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8 13 8l-8.5 5.2V2.8z" fill="#fff"/></svg>';
  var ICON_PAUSE = '<svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.5" width="3.5" height="11" fill="#fff"/><rect x="9" y="2.5" width="3.5" height="11" fill="#fff"/></svg>';

  function pintaOnda(card, prog) {
    var barras = card.querySelectorAll('.wave i');
    var corte = Math.round(prog * barras.length);
    for (var i = 0; i < barras.length; i++) {
      var deveria = i < corte;
      if (barras[i].classList.contains('on') !== deveria) {
        barras[i].classList.toggle('on', deveria);
      }
    }
  }

  function atualizaMini(card, audio) {
    if (atual !== card) { return; }
    var dur = audio.duration || 0;
    var prog = dur ? audio.currentTime / dur : 0;
    miniCur.textContent = mmss(audio.currentTime);
    miniDur.textContent = mmss(dur);
    miniFill.style.width = (prog * 100).toFixed(2) + '%';
    miniPlay.innerHTML = audio.paused ? ICON_PLAY : ICON_PAUSE;
    miniPlay.setAttribute('aria-label', audio.paused ? 'Tocar' : 'Pausar');
  }

  cards.forEach(function (card) {
    var audio = card.querySelector('audio');
    var botao = card.querySelector('[data-act="play"]');
    var onda = card.querySelector('[data-act="seek"]');
    var cur = card.querySelector('[data-cur]');
    var dur = card.querySelector('[data-dur]');
    if (!audio) { return; }

    function sincroniza() {
      var d = audio.duration || 0;
      var prog = d ? audio.currentTime / d : 0;
      if (cur) { cur.textContent = mmss(audio.currentTime); }
      pintaOnda(card, prog);
      atualizaMini(card, audio);
    }

    audio.addEventListener('loadedmetadata', function () {
      if (dur) { dur.textContent = mmss(audio.duration); }
      sincroniza();
    });
    audio.addEventListener('timeupdate', sincroniza);

    audio.addEventListener('play', function () {
      cards.forEach(function (outro) {
        if (outro === card) { return; }
        var a = outro.querySelector('audio');
        if (a && !a.paused) { a.pause(); }
      });
      atual = card;
      miniTitle.textContent = card.dataset.title;
      miniArtist.innerHTML = card.dataset.artist;
      mini.classList.add('on');
      document.body.style.paddingBottom = '72px';
      botao.innerHTML = ICON_PAUSE;
      botao.setAttribute('aria-label', 'Pausar ' + card.dataset.title);
      sincroniza();
    });

    audio.addEventListener('pause', function () {
      botao.innerHTML = ICON_PLAY;
      botao.setAttribute('aria-label', 'Tocar ' + card.dataset.title);
      atualizaMini(card, audio);
    });

    audio.addEventListener('ended', function () {
      audio.currentTime = 0;
      sincroniza();
    });

    audio.addEventListener('error', function () {
      var aviso = card.querySelector('.track-foot .grow');
      if (aviso && !aviso.dataset.erro) {
        aviso.dataset.erro = '1';
        aviso.textContent = 'Não foi possível carregar o áudio desta faixa.';
        aviso.style.fontSize = '12px';
        aviso.style.color = '#B03500';
      }
    });

    botao.addEventListener('click', function () {
      if (audio.paused) { audio.play(); } else { audio.pause(); }
    });

    onda.addEventListener('click', function (e) {
      var r = onda.getBoundingClientRect();
      var p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      audio.currentTime = p * (audio.duration || 0);
      sincroniza();
    });
  });

  miniPlay.addEventListener('click', function () {
    if (!atual) { return; }
    var a = atual.querySelector('audio');
    if (a.paused) { a.play(); } else { a.pause(); }
  });

  miniBar.addEventListener('click', function (e) {
    if (!atual) { return; }
    var a = atual.querySelector('audio');
    var r = miniBar.getBoundingClientRect();
    var p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    a.currentTime = p * (a.duration || 0);
  });

  /* ---------------- carrinho ---------------- */

  var itens = [];
  var scrim = document.getElementById('scrim');
  var drawer = document.getElementById('drawer');
  var corpo = document.getElementById('cart-body');
  var contador = document.getElementById('cart-count');
  var abrir = document.getElementById('cart-open');
  var fechar = document.getElementById('cart-close');

  function brl(v) {
    return 'R$ ' + v.toFixed(2).replace('.', ',');
  }

  function desenha() {
    contador.textContent = String(itens.length);
    contador.hidden = itens.length === 0;

    if (!itens.length) {
      corpo.innerHTML = '<p class="empty">Seu carrinho está vazio.<br>Escolha uma faixa no catálogo.</p>';
      return;
    }

    var html = '';
    itens.forEach(function (it, i) {
      html += '<div class="ci">' + it.capa +
        '<div class="ci-main"><b>' + it.titulo + '</b><span>' + it.artista + '</span></div>' +
        '<div class="ci-side"><b>' + brl(it.preco) + '</b>' +
        '<button type="button" data-remove="' + i + '">Remover</button></div></div>';
    });

    var total = itens.reduce(function (s, it) { return s + it.preco; }, 0);
    var temPack = itens.some(function (it) { return it.pack; });
    if (!temPack && itens.length >= 2) {
      html += '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:4px;border:1px solid #FF5500;background:#FFF4EF">' +
        '<div style="flex-grow:1"><div style="font-size:13px;font-weight:600">Leve o pack Tribal inteiro por ' + brl(PRECO_PACK) + '</div>' +
        '<div style="font-size:12px;color:#7A2500;margin-top:2px">São 12 faixas pelo preço de duas e meia.</div></div>' +
        '<button class="btn btn-primary btn-sm" type="button" data-swap="1">Trocar</button></div>';
    }

    html += '<div class="totals">' +
      '<div><span>Subtotal · ' + itens.length + (itens.length === 1 ? ' item' : ' itens') + '</span><span>' + brl(total) + '</span></div>' +
      '<div class="grand"><span>Total</span><span>' + brl(total) + '</span></div></div>';

    corpo.innerHTML = html;
  }

  function adiciona(it) {
    if (itens.some(function (x) { return x.id === it.id; })) { abreCarrinho(); return; }
    itens.push(it);
    desenha();
    abreCarrinho();
  }

  function abreCarrinho() {
    drawer.classList.add('on');
    scrim.classList.add('on');
    drawer.setAttribute('aria-hidden', 'false');
    fechar.focus();
  }

  function fechaCarrinho() {
    drawer.classList.remove('on');
    scrim.classList.remove('on');
    drawer.setAttribute('aria-hidden', 'true');
    abrir.focus();
  }

  abrir.addEventListener('click', abreCarrinho);
  fechar.addEventListener('click', fechaCarrinho);
  scrim.addEventListener('click', fechaCarrinho);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('on')) { fechaCarrinho(); }
  });

  corpo.addEventListener('click', function (e) {
    var rm = e.target.closest('[data-remove]');
    if (rm) {
      itens.splice(Number(rm.dataset.remove), 1);
      desenha();
      return;
    }
    if (e.target.closest('[data-swap]')) {
      itens = [{ id: 'pack', titulo: 'Pack Tribal · 12 faixas', artista: 'M &amp; M', preco: PRECO_PACK, pack: true, capa: capaPack() }];
      desenha();
    }
  });

  function capaPack() {
    return '<div class="cover" style="background:#0F1512">' +
      '<svg width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">' +
      '<circle cx="150" cy="60" r="70" stroke="#FF5500" stroke-width="3" fill="none" opacity=".4"/>' +
      '<circle cx="150" cy="60" r="44" fill="#FF5500" opacity=".5"/></svg>' +
      '<span class="c-brand">M &amp; M</span>' +
      '<span class="c-title" style="font-size:11px">PACK<br>TRIBAL</span>' +
      '<span class="c-foot">12 FAIXAS</span></div>';
  }

  document.addEventListener('click', function (e) {
    var add = e.target.closest('[data-act="add"]');
    if (add) {
      var card = add.closest('.track');
      adiciona({
        id: card.dataset.track,
        titulo: card.dataset.title,
        artista: card.dataset.artist,
        preco: PRECO_FAIXA,
        capa: card.querySelector('.cover').outerHTML
      });
      return;
    }
    if (e.target.closest('[data-act="add-pack"]')) {
      adiciona({ id: 'pack', titulo: 'Pack Tribal · 12 faixas', artista: 'M &amp; M', preco: PRECO_PACK, pack: true, capa: capaPack() });
    }
  });

  document.getElementById('checkout').addEventListener('click', function () {
    if (!itens.length) { abreCarrinho(); return; }
    window.alert('Checkout ainda não conectado.\n\nPróximo passo: ligar este botão a uma Stripe Checkout Session criada no servidor, com Pix, cartão e boleto. O prompt no repositório new-project descreve o fluxo inteiro.');
  });

  desenha();
})();
