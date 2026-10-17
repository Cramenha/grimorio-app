/*
 * Grimório do Aventureiro - importador para o Roll20 (roda no navegador, sem plano Pro).
 * Adiciona o botão "Grimório" dentro do Roll20; cole a ficha copiada do Grimório (ou escolha o arquivo .roll20.json)
 * e clique em Importar. Cria ou atualiza a personagem com os campos da ficha "D&D 4E" do Roll20, os poderes,
 * os talentos, o inventário e as macros (habilidades).
 */
(function () {
  'use strict';
  if (window.__grimorioRoll20) return;
  window.__grimorioRoll20 = true;
  var VERSAO = 1;
  var espera = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  function campanha() {
    return window.Campaign || (window.d20 && window.d20.Campaign) || null;
  }

  // mesmo gerador de ids de linha que o Roll20 usa nas seções repetidas
  var gerarUUID = (function () {
    var a = 0, b = [];
    return function () {
      var c = (new Date()).getTime() + 0, d = c === a; a = c;
      for (var e = new Array(8), f = 7; 0 <= f; f--) { e[f] = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'.charAt(c % 64); c = Math.floor(c / 64); }
      c = e.join('');
      if (d) { for (f = 11; 0 <= f && 63 === b[f]; f--) b[f] = 0; b[f]++; } else for (f = 0; 12 > f; f++) b[f] = Math.floor(64 * Math.random());
      for (f = 0; 12 > f; f++) c += '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'.charAt(b[f]);
      return c;
    };
  })();
  var novoRowId = function () { return gerarUUID().replace(/_/g, 'Z'); };

  // nome de habilidade (token action) a partir do nome do poder: só letras/números/espaço/traço, até 48 caracteres
  function nomeHab(s) {
    return 'Poder-' + String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 _-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 42);
  }

  function lerJson(txt) {
    txt = String(txt || '').trim();
    try { return JSON.parse(txt); } catch (e1) {
      try { return JSON.parse(txt.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")); } catch (e2) { return null; }
    }
  }

  // ------------------------------------------------------------------ importação (usa as coleções da página do Roll20)
  async function importar(dados, log) {
    var C = campanha();
    if (!C || !C.characters) throw new Error('Abra um jogo do Roll20 (a tela do editor) antes de importar.');
    if (!dados || dados.formato !== 'grimorio-roll20') throw new Error('Este texto não é uma ficha do Grimório. Use "Copiar p/ Roll20" na ficha.');
    if (dados.versao > VERSAO) throw new Error('A ficha foi gerada por uma versão mais nova do Grimório. Atualize a extensão.');

    var nome = dados.nome || 'Personagem importada';
    var char = C.characters.find(function (c) { return c.get('name') === nome; });
    var criada = !char;
    if (!char) {
      log('Criando a personagem "' + nome + '"...');
      char = C.characters.create({ name: nome, avatar: '', bio: '', gmnotes: '', archived: false, inplayerjournals: '', controlledby: '', defaulttoken: '' });
      await espera(600);
    } else {
      log('Atualizando a personagem "' + nome + '"...');
      char.attribs.models.slice().forEach(function (a) { if (/^repeating_(feats|race-feats|class-feats|inventory)_/.test(a.get('name'))) a.destroy(); });
      char.abilities.models.slice().forEach(function (a) { if (/^(Talento|Item|Poder)-/.test(a.get('name'))) a.destroy(); });
      await espera(300);
    }

    var fila = [];
    var cont = { atributos: 0, poderes: 0, habilidades: 0, linhas: 0 };
    function setAttr(nomeAttr, valor) {
      fila.push(function () {
        var cur = valor, max;
        if (valor !== null && typeof valor === 'object') { cur = valor.c; max = valor.m; }
        var dadosAttr = { name: nomeAttr, current: cur };
        if (max !== undefined) dadosAttr.max = max;
        var a = char.attribs.find(function (x) { return x.get('name') === nomeAttr; });
        if (a) a.save(dadosAttr); else char.attribs.create(dadosAttr);
        cont.atributos++;
      });
    }
    Object.keys(dados.atributos || {}).forEach(function (k) { setAttr(k, dados.atributos[k]); });
    (dados.poderes || []).slice(0, 100).forEach(function (p, i) {
      var n = i + 1;
      setAttr('power-' + n + '-name', p.nome); setAttr('power-' + n + '-action', p.acao); setAttr('power-' + n + '-range', p.alcance);
      setAttr('power-' + n + '-level', p.nivel); setAttr('power-' + n + '-useage', p.uso); setAttr('power-' + n + '-macro', p.macro);
      setAttr('power-' + n + '-used', 0); setAttr('power-' + n + '-toggle', 'on');
      cont.poderes++;
      // ação de token (botão ao clicar no token): roda a macro já configurada no slot do poder
      if (p.macro) {
        var habNome = nomeHab(p.nome), acaoHab = '#@{power-' + n + '-macro}';
        fila.push(function () {
          var ab = char.abilities.find(function (x) { return x.get('name') === habNome; });
          if (ab) ab.save({ action: acaoHab, istokenaction: true }); else char.abilities.create({ name: habNome, action: acaoHab, istokenaction: true });
          cont.habilidades++;
        });
      }
    });
    function linhas(secao, campo, lista) {
      (lista || []).forEach(function (texto) {
        fila.push(function () { char.attribs.create({ name: 'repeating_' + secao + '_' + novoRowId() + '_' + campo, current: texto }); cont.linhas++; });
      });
    }
    linhas('feats', 'feat', dados.talentos);
    linhas('class-feats', 'class-feat', dados.classeFeats);
    linhas('race-feats', 'race-feat', dados.racaFeats);
    (dados.inventario || []).forEach(function (it) {
      fila.push(function () {
        var rid = novoRowId();
        char.attribs.create({ name: 'repeating_inventory_' + rid + '_inventory-name', current: it.nome });
        char.attribs.create({ name: 'repeating_inventory_' + rid + '_inventory-quantity', current: it.qtd });
        char.attribs.create({ name: 'repeating_inventory_' + rid + '_inventory-value', current: it.valor });
        cont.linhas++;
      });
    });
    (dados.habilidades || []).forEach(function (h) {
      fila.push(function () {
        var ab = char.abilities.find(function (x) { return x.get('name') === h.nome; });
        if (ab) ab.save({ action: h.macro }); else char.abilities.create({ name: h.nome, action: h.macro, istokenaction: false });
        cont.habilidades++;
      });
    });
    if (dados.bio) fila.push(function () { char.save({ bio: String(dados.bio).replace(/\n/g, '<br>') }); });

    // em lotes pequenos, para não sobrecarregar a conexão com o Roll20
    for (var i = 0; i < fila.length; i += 25) {
      for (var j = i; j < Math.min(i + 25, fila.length); j++) { try { fila[j](); } catch (e) { console.warn('Grimório:', e); } }
      log('Gravando... ' + Math.min(i + 25, fila.length) + ' de ' + fila.length);
      await espera(120);
    }
    var resumo = (criada ? 'Personagem criada: ' : 'Personagem atualizada: ') + nome + '. Campos: ' + cont.atributos + ', poderes: ' + cont.poderes +
      ', habilidades: ' + cont.habilidades + ', linhas de texto/inventário: ' + cont.linhas + '.';
    return { resumo: resumo, avisos: dados.avisos || [] };
  }

  // ------------------------------------------------------------------ interface (botão flutuante + janelinha)
  function montarInterface() {
    if (document.getElementById('grimorio-r20-botao')) return;
    var botao = document.createElement('button');
    botao.id = 'grimorio-r20-botao';
    botao.textContent = '📖 Grimório';
    botao.title = 'Importar ficha do Grimório do Aventureiro';
    botao.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99998;padding:6px 12px;border:2px solid #2b1d0e;border-radius:6px;background:#8e1b1b;color:#fff;font:600 13px sans-serif;cursor:pointer;opacity:.85;';
    document.body.appendChild(botao);

    var painel = document.createElement('div');
    painel.id = 'grimorio-r20-painel';
    painel.style.cssText = 'display:none;position:fixed;left:12px;bottom:52px;z-index:99999;width:440px;max-width:92vw;background:#f3e8cc;color:#2b1d0e;border:2px solid #2b1d0e;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.6);padding:12px;font:13px sans-serif;';
    painel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b style="font-size:15px">Importar ficha do Grimório</b><span id="grimorio-r20-fechar" style="cursor:pointer;font-size:18px">✕</span></div>' +
      '<div style="margin-bottom:6px">1) No Grimório, clique em <b>Copiar p/ Roll20</b>. 2) Cole aqui (ou escolha o arquivo .roll20.json). 3) Importar.</div>' +
      '<textarea id="grimorio-r20-texto" rows="6" style="width:100%;box-sizing:border-box;font:11px monospace;color:#000;background:#fff" placeholder="Cole a ficha aqui"></textarea>' +
      '<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><input type="file" id="grimorio-r20-arq" accept=".json,application/json" style="flex:1;font-size:11px"><button id="grimorio-r20-ok" style="padding:5px 14px;border:2px solid #2b1d0e;border-radius:6px;background:#2f6b34;color:#fff;font-weight:600;cursor:pointer">Importar</button></div>' +
      '<div id="grimorio-r20-status" style="margin-top:8px;white-space:pre-wrap;min-height:1.2em"></div>';
    document.body.appendChild(painel);

    var status = painel.querySelector('#grimorio-r20-status');
    var log = function (t, erro) { status.textContent = t; status.style.color = erro ? '#a00' : '#2b1d0e'; };
    botao.onclick = function () { painel.style.display = painel.style.display === 'none' ? 'block' : 'none'; };
    painel.querySelector('#grimorio-r20-fechar').onclick = function () { painel.style.display = 'none'; };
    painel.querySelector('#grimorio-r20-arq').onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      var leitor = new FileReader();
      leitor.onload = function () { painel.querySelector('#grimorio-r20-texto').value = leitor.result; log('Arquivo carregado. Clique em Importar.'); };
      leitor.readAsText(f);
    };
    var ok = painel.querySelector('#grimorio-r20-ok');
    ok.onclick = async function () {
      var dados = lerJson(painel.querySelector('#grimorio-r20-texto').value);
      if (!dados) { log('Não consegui ler o texto. Cole a ficha inteira, sem editar.', true); return; }
      ok.disabled = true;
      try {
        var r = await importar(dados, log);
        log(r.resumo + '\nAbra a personagem no Diário e confira. Se os campos não aparecerem, confira se o jogo usa a ficha "D&D 4E".' + (r.avisos.length ? '\nAvisos: ' + r.avisos.slice(0, 3).join(' | ') : ''));
      } catch (e) { log('Erro: ' + e.message, true); console.error(e); }
      ok.disabled = false;
    };
  }

  window.grimorioRoll20 = { importar: importar, lerJson: lerJson };
  if (typeof document !== 'undefined' && document.body) {
    // o editor do Roll20 carrega aos poucos: tenta de novo até a tela do jogo existir
    var tentativas = 0;
    var t = setInterval(function () {
      tentativas++;
      if (campanha() || tentativas > 60) { clearInterval(t); montarInterface(); }
    }, 1000);
  }
})();
