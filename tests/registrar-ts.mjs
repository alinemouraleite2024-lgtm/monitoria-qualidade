// Permite rodar os testes com o Node puro (`node --test`), sem dependência nova.
//
// O Node já remove os tipos de arquivos .ts sozinho; o que ele não faz é resolver import sem
// extensão (`from './duracao'`), que é como o código do projeto importa — o Vite resolve isso no
// build. Este gancho tenta `.ts` quando a resolução padrão falha.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(especificador, contexto, proximo) {
    try {
      return proximo(especificador, contexto);
    } catch (erro) {
      if (especificador.startsWith('.')) {
        for (const ext of ['.ts', '/index.ts']) {
          try {
            return proximo(especificador + ext, contexto);
          } catch {
            // tenta a próxima
          }
        }
      }
      throw erro;
    }
  },
});
