# Backup e restauração da base

> A persistência do MonitorIA é `localStorage`. Isso significa que **toda a operação vive em um
> navegador, em uma máquina**, sem cópia em servidor nenhum. Não existe "restaurar do sistema":
> se a chave for apagada, o dado acabou.
>
> Este procedimento é a única rede de proteção que existe hoje.

## Quando executar

- **Antes de qualquer publicação** que mexa em modelo de dados, catálogo ou migração.
- **Toda sexta-feira**, ao fim da operação da semana.
- Antes de limpar cache, trocar de navegador ou formatar a máquina.

## O risco que justifica o procedimento

`initializeDatabase()` ([App.tsx](../src/App.tsx)) apaga **todas** as chaves `pm2_*` sempre que
`DATABASE_VERSION` muda:

```js
if (currentVersion !== String(DATABASE_VERSION)) {
  for (...) if (key.startsWith('pm2_')) localStorage.removeItem(key);
}
```

`pm2_monitorings` está nesse conjunto. Subir `DATABASE_VERSION` apaga todas as monitorias
registradas — sem aviso e sem confirmação. Nenhuma mudança de catálogo ou de modelo precisa
mexer nessa constante; se alguma proposta pedir isso, ela está errada.

---

## Backup

1. Abrir https://monitoria-qualidade.vercel.app normalmente, já logada.
2. Pressionar **F12** e abrir a aba **Console**.
3. Colar o bloco abaixo e pressionar Enter.

```js
(() => {
  const dados = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('pm2_')) dados[k] = localStorage.getItem(k);
  }
  let monitorias = 0;
  try { monitorias = JSON.parse(dados['pm2_monitorings'] || '[]').length; } catch (e) {}
  const meta = {
    exportadoEm: new Date().toISOString(),
    origem: location.origin,
    versaoBanco: localStorage.getItem('pm2_database_version'),
    chaves: Object.keys(dados).length,
    monitorias,
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ meta, dados }, null, 2)], { type: 'application/json' }));
  a.download = 'monitoria-backup-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';
  a.click();
  console.table(meta);
  return meta;
})()
```

4. **Conferir a tabela impressa no console.** Se `monitorias` vier `0` ou `chaves` vier muito
   baixo, algo está errado — não prosseguir com nenhuma publicação e avisar.
5. Guardar o arquivo em `ORGANIZAÇÃO/3 - MONITORIA/BACKUPS/`. Por estar no OneDrive, ele sai
   da máquina — que é o ponto.

### O que fica no arquivo

Todas as chaves `pm2_*`: monitorias, critérios, usuários, colaboradoras, áreas, alocações,
metas, agenda, feriados, demandas, comunicados, catálogos, marca e configurações.

---

## Restauração

Só executar com o backup em mãos e com certeza de que a base atual está perdida ou incorreta —
**a restauração sobrescreve o que estiver gravado**.

1. Abrir o sistema, **F12**, aba **Console**.
2. Colar o bloco abaixo. Ele abre um seletor de arquivo.

```js
(() => {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    try {
      const b = JSON.parse(await inp.files[0].text());
      if (!b || !b.dados || !b.dados.pm2_monitorings) {
        console.error('Arquivo não parece um backup válido do MonitorIA. Nada foi alterado.');
        return;
      }
      Object.entries(b.dados).forEach(([k, v]) => localStorage.setItem(k, v));
      console.log('Restaurado de', b.meta && b.meta.exportadoEm, '·', b.meta && b.meta.monitorias, 'monitorias');
      location.reload();
    } catch (e) {
      console.error('Falha ao restaurar:', e.message, '— nada foi alterado.');
    }
  };
  inp.click();
})()
```

3. Selecionar o arquivo. A página recarrega sozinha ao final.
4. Conferir em **Monitorias** se a contagem bate com a do backup.

A restauração valida o arquivo antes de escrever: se não houver `pm2_monitorings`, ela recusa e
não altera nada.

---

## Limite conhecido

Backup manual depende de alguém lembrar. Enquanto a persistência for `localStorage`, é o que
existe — automatizar exige backend, que é a mesma dependência do NPS operacional descrito em
[VISAO-PRODUTO.md](VISAO-PRODUTO.md).
