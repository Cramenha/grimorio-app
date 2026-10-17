/*
 * Grimório do Aventureiro - Importador de fichas para o Roll20 (ficha "D&D 4E" do Roll20)
 *
 * Precisa do plano Roll20 Pro (API / "Mod Scripts"). Instalar UMA vez por jogo (só quem é GM):
 *   Configurações do jogo > Mod (API) Scripts > Novo Script > cole este arquivo inteiro > Salvar Script.
 *
 * Para importar uma ficha:
 *   1) No Grimório, na ficha, clique em "Copiar p/ Roll20" (ou baixe o arquivo .roll20.json e abra no Bloco de Notas).
 *   2) No Roll20 crie um Handout (Diário > + Handout), dê um nome (ex.: Drizzt) e cole o texto no campo de notas. Salve.
 *   3) No chat do Roll20 digite:   !grimorio-importar Drizzt
 * O script cria (ou atualiza) a personagem com todos os campos, os poderes, os talentos e o inventário.
 * Só o GM pode usar. Para ver os comandos: !grimorio-ajuda
 */
on('ready', function () {
  'use strict';
  var VERSAO = 1;

  function gerarUUID() {
    var a = 0, b = [];
    return (function () {
      var c = (new Date()).getTime() + 0, d = c === a; a = c;
      for (var e = new Array(8), f = 7; 0 <= f; f--) { e[f] = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'.charAt(c % 64); c = Math.floor(c / 64); }
      c = e.join('');
      if (d) { for (f = 11; 0 <= f && 63 === b[f]; f--) b[f] = 0; b[f]++; } else for (f = 0; 12 > f; f++) b[f] = Math.floor(64 * Math.random());
      for (f = 0; 12 > f; f++) c += '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'.charAt(b[f]);
      return c;
    })();
  }
  var novoRowId = function () { return gerarUUID().replace(/_/g, 'Z'); };

  function aviso(playerid, texto) {
    var p = getObj('player', playerid);
    var quem = p ? p.get('displayname') : 'gm';
    sendChat('Grimório', '/w "' + quem + '" ' + texto);
  }

  function limparHtml(h) {
    return String(h || '')
      .replace(/<br\s*\/?>/gi, '').replace(/<\/p>/gi, '').replace(/<[^>]+>/g, '')
      .replace(/&nbsp;| /g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); })
      .replace(/&amp;/g, '&').trim();
  }
  function lerJson(texto) {
    try { return JSON.parse(texto); } catch (e1) {
      try { return JSON.parse(texto.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")); } catch (e2) { return null; }
    }
  }

  // nome de habilidade (token action) a partir do nome do poder: só letras/números/espaço/traço, até 48 caracteres
  function nomeHab(s) {
    return 'Poder-' + String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 _-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 42);
  }

  function achaAtributo(charid, nome) {
    return findObjs({ _type: 'attribute', _characterid: charid, name: nome })[0];
  }

  function importar(dados, playerid) {
    var nome = dados.nome || 'Personagem importada';
    var existentes = findObjs({ _type: 'character', name: nome });
    var char = existentes[0];
    var criada = !char;
    if (!char) char = createObj('character', { name: nome, archived: false, controlledby: playerid, inplayerjournals: playerid });
    var cid = char.id;
    var fila = [];
    var contagem = { atributos: 0, poderes: 0, habilidades: 0, linhas: 0 };

    // ao atualizar, apaga o que este importador cria em listas (linhas repetidas e habilidades do Grimório)
    if (!criada) {
      findObjs({ _type: 'attribute', _characterid: cid }).forEach(function (a) {
        if (/^repeating_(feats|race-feats|class-feats|inventory)_/.test(a.get('name'))) a.remove();
      });
      findObjs({ _type: 'ability', _characterid: cid }).forEach(function (a) {
        if (/^(Talento|Item|Poder)-/.test(a.get('name'))) a.remove();
      });
    }

    function setAttr(nomeAttr, valor) {
      fila.push(function () {
        var cur = valor, max;
        if (valor !== null && typeof valor === 'object') { cur = valor.c; max = valor.m; }
        var a = achaAtributo(cid, nomeAttr);
        if (a) { a.set('current', cur); if (max !== undefined) a.set('max', max); }
        else { var o = { name: nomeAttr, current: cur, characterid: cid }; if (max !== undefined) o.max = max; createObj('attribute', o); }
        contagem.atributos++;
      });
    }
    Object.keys(dados.atributos || {}).forEach(function (k) { setAttr(k, dados.atributos[k]); });

    (dados.poderes || []).slice(0, 100).forEach(function (p, i) {
      var n = i + 1;
      setAttr('power-' + n + '-name', p.nome); setAttr('power-' + n + '-action', p.acao); setAttr('power-' + n + '-range', p.alcance);
      setAttr('power-' + n + '-level', p.nivel); setAttr('power-' + n + '-useage', p.uso); setAttr('power-' + n + '-macro', p.macro);
      setAttr('power-' + n + '-used', 0); setAttr('power-' + n + '-toggle', 'on');
      contagem.poderes++;
      // ação de token (botão ao clicar no token): roda a macro já configurada no slot do poder
      if (p.macro) {
        var habNome = nomeHab(p.nome), acaoHab = '#@{power-' + n + '-macro}';
        fila.push(function () {
          var ab = findObjs({ _type: 'ability', _characterid: cid, name: habNome })[0];
          if (ab) ab.set('action', acaoHab); else createObj('ability', { characterid: cid, name: habNome, action: acaoHab, istokenaction: true });
          contagem.habilidades++;
        });
      }
    });

    function linhas(secao, campo, lista) {
      (lista || []).forEach(function (texto) {
        fila.push(function () { createObj('attribute', { name: 'repeating_' + secao + '_' + novoRowId() + '_' + campo, current: texto, characterid: cid }); contagem.linhas++; });
      });
    }
    linhas('feats', 'feat', dados.talentos);
    linhas('class-feats', 'class-feat', dados.classeFeats);
    linhas('race-feats', 'race-feat', dados.racaFeats);
    (dados.inventario || []).forEach(function (it) {
      fila.push(function () {
        var rid = novoRowId();
        createObj('attribute', { name: 'repeating_inventory_' + rid + '_inventory-name', current: it.nome, characterid: cid });
        createObj('attribute', { name: 'repeating_inventory_' + rid + '_inventory-quantity', current: it.qtd, characterid: cid });
        createObj('attribute', { name: 'repeating_inventory_' + rid + '_inventory-value', current: it.valor, characterid: cid });
        contagem.linhas++;
      });
    });
    (dados.habilidades || []).forEach(function (h) {
      fila.push(function () {
        var ab = findObjs({ _type: 'ability', _characterid: cid, name: h.nome })[0];
        if (ab) ab.set('action', h.macro); else createObj('ability', { characterid: cid, name: h.nome, action: h.macro, istokenaction: false });
        contagem.habilidades++;
      });
    });
    if (dados.bio) fila.push(function () { char.set('bio', String(dados.bio).replace(/\n/g, '<br>')); });

    // executa em pequenos lotes para não travar o jogo
    var i = 0;
    (function passo() {
      var fim = Math.min(i + 40, fila.length);
      for (; i < fim; i++) { try { fila[i](); } catch (e) { log('Grimório importador: ' + e); } }
      if (i < fila.length) { setTimeout(passo, 60); return; }
      aviso(playerid, (criada ? 'Personagem criada: ' : 'Personagem atualizada: ') + nome + '. Campos: ' + contagem.atributos + ', poderes: ' + contagem.poderes +
        ', habilidades: ' + contagem.habilidades + ', linhas de texto/inventário: ' + contagem.linhas + '. Abra a ficha (aba do Diário) e confira.' +
        (dados.avisos && dados.avisos.length ? ' Avisos do Grimório: ' + dados.avisos.slice(0, 3).join(' | ') : ''));
    })();
  }

  on('chat:message', function (msg) {
    if (msg.type !== 'api') return;
    var cmd = msg.content.split(/\s+/)[0].toLowerCase();
    if (cmd === '!grimorio-ajuda') {
      aviso(msg.playerid, 'Comandos: !grimorio-importar NomeDoHandout (cria ou atualiza a personagem a partir do JSON colado nas notas do handout).');
      return;
    }
    if (cmd !== '!grimorio-importar') return;
    if (!playerIsGM(msg.playerid)) { aviso(msg.playerid, 'Só o GM pode importar fichas.'); return; }
    var nomeHandout = msg.content.replace(/^!grimorio-importar\s*/i, '').trim();
    if (!nomeHandout) { aviso(msg.playerid, 'Use: !grimorio-importar NomeDoHandout'); return; }
    var hs = findObjs({ _type: 'handout', name: nomeHandout });
    if (!hs.length) { aviso(msg.playerid, 'Não achei um handout chamado "' + nomeHandout + '". Confira o nome (maiúsculas e espaços).'); return; }
    hs[0].get('notes', function (notas) {
      var texto = limparHtml(notas);
      var dados = lerJson(texto);
      if (!dados || dados.formato !== 'grimorio-roll20') {
        aviso(msg.playerid, 'O texto do handout não é uma ficha do Grimório. Cole o conteúdo de "Copiar p/ Roll20" nas notas do handout, sem editar.');
        return;
      }
      if (dados.versao > VERSAO) { aviso(msg.playerid, 'Esta ficha foi gerada por uma versão mais nova do Grimório. Atualize este script.'); return; }
      importar(dados, msg.playerid);
    });
  });
  log('Grimório do Aventureiro: importador carregado (!grimorio-importar).');
});
